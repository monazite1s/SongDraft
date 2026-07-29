/**
 * 歌词精修 SSE 入口（docs/development-state.md · DeepSeek）
 * 鉴权 → 限流 → ConversationService.respond → 将结果分片为 CreativeStreamEvent。
 * 前端永不接触 Provider Key；当前为完成后分片，非上游 Token 直通。
 */
import { z } from "zod";

import { getCurrentUser } from "@/modules/auth/queries";
import { ConversationService } from "@/modules/conversations/conversation-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError } from "@/shared/http/api-response";

const inputSchema = z.object({
  projectId: z.string().uuid().optional(),
  artistId: z.string().max(80).nullable().optional(),
  message: z.string().trim().min(1).max(5_000),
  eventIds: z.array(z.string().max(80)).max(8).optional(),
  currentLyrics: z.string().max(10_000).nullable().optional(),
});

const attempts = new Map<string, number[]>();
function checkRateLimit(userId: string) {
  const now = Date.now();
  const recent = (attempts.get(userId) ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= 30) throw new DomainError("RATE_LIMITED", 429, "请求过于频繁，请稍后再试");
  recent.push(now); attempts.set(userId, recent);
}

function encodeSse(event: unknown) { return `data: ${JSON.stringify(event)}\n\n`; }

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    checkRateLimit(user.id);
    const result = await new ConversationService().respond(user, inputSchema.parse(await request.json()));
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(encodeSse({ type: "thinking", text: "正在整理艺人资料和应援情感…" })));
        const chunks = result.message.match(/.{1,8}/gu) ?? [result.message];
        for (const delta of chunks) {
          controller.enqueue(encoder.encode(encodeSse({ type: "message_delta", delta })));
          await new Promise((resolve) => setTimeout(resolve, 18));
        }
        if (result.lyrics) controller.enqueue(encoder.encode(encodeSse({ type: "lyrics_replace", lyrics: result.lyrics })));
        controller.enqueue(encoder.encode(encodeSse({ type: "context", context: result.context })));
        controller.enqueue(encoder.encode(encodeSse({ type: "complete", projectId: result.projectId, messageId: result.messageId })));
        controller.close();
      },
    });
    return new Response(stream, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-store", connection: "keep-alive", "x-accel-buffering": "no" } });
  } catch (error) { return apiError(error); }
}
