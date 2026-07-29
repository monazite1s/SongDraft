/**
 * 歌词模型适配器（docs/technical-design.md §3、§6）
 *
 * LyricAssistant 统一契约；真实模式走 DeepSeek chat/completions + JSON Output，
 * 无 Key 或 TEXT_PROVIDER_MODE=mock 时使用确定性 Mock，不得伪装为真实 Provider。
 */
import type { ArtistProfile } from "@/modules/artists/artist-types";
import { z } from "zod";

import { buildLyricSystemPrompt } from "@/modules/ai/prompts";
import { DomainError } from "@/shared/errors/domain-error";

export interface CreativeContext {
  artistId: string | null;
  eventIds: string[];
  emotion: string;
  singingMode: "chorus" | "solo";
  executionKind: "simulated" | "real_external";
}

export type CreativeStreamEvent =
  | { type: "thinking"; text: string }
  | { type: "message_delta"; delta: string }
  | { type: "lyrics_replace"; lyrics: string }
  | { type: "lyrics_delta"; delta: string }
  | { type: "context"; context: CreativeContext }
  | { type: "complete"; projectId: string; messageId: string }
  | { type: "error"; message: string; retryable: boolean };

export interface CreativeChatInput {
  projectId: string;
  artist: ArtistProfile | null;
  message: string;
  eventIds: string[];
  currentLyrics?: string | null;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface AssistantDraft {
  message: string;
  lyrics: string | null;
  context: CreativeContext;
}

export interface LyricAssistant {
  createDraft(input: CreativeChatInput): Promise<AssistantDraft>;
}

function buildLyrics(artist: ArtistProfile | null, eventTitle: string, message: string) {
  const wish = message.replace(/[@#]/g, "").trim().slice(0, 30) || "把共同的回忆唱给你听";
  const subject = artist?.name ?? "远方的你";
  const chorus = artist ? `${artist.fandomName} 的声音，汇成最亮的星系\n${artist.slogan}` : "让每一句心声，汇成最亮的星系\n穿过夜色以后，我们仍然相信";
  return `《把光唱给你》\n\n[主歌 A]\n从第一声呼喊走到今天\n我们把微小的心愿写成诗篇\n${eventTitle} 的灯光再次亮起\n每一步都有彼此留在身边\n\n[预副歌]\n${wish}\n让熟悉的名字穿过人海\n\n[副歌]\n${subject}，向前走吧，我们都在这里\n${chorus}\n这一次让全场，把约定唱给你听\n\n[桥段]\n不是短暂相遇，是年复一年的回应\n等下一次灯亮，我们还会并肩同行`;
}

export class MockLyricAssistant implements LyricAssistant {
  async createDraft(input: CreativeChatInput): Promise<AssistantDraft> {
    const context: CreativeContext = { artistId: input.artist?.id ?? null, eventIds: input.eventIds, emotion: "温暖坚定", singingMode: "chorus", executionKind: "simulated" };
    const event = input.artist?.events.find((item) => input.eventIds.includes(item.id)) ?? input.artist?.events[0];
    const asksForRevision = Boolean(input.currentLyrics) && /(修改|更|副歌|坚定|温柔|押韵|合唱)/.test(input.message);
    const lyrics = asksForRevision
      ? `${input.currentLyrics!.replace("[副歌]", "[副歌 · 全场合唱]")}\n\n（本轮根据“${input.message.slice(0, 24)}”强化了合唱表达。）`
      : buildLyrics(input.artist, event?.title ?? "这次相遇", input.message);
    const message = asksForRevision
      ? `我已经按你的意见调整歌词，并把副歌处理得更适合全场合唱。右侧正在同步最新版本。`
      : input.artist ? `我以「${event?.title ?? "共同回忆"}」为背景整理了一版歌词，重点保留简单易唱的副歌和 ${input.artist.fandomName} 的专属记忆。` : "我已经根据创作提示整理了一版完整歌词，并强化了段落结构和副歌记忆点。";
    return { message, lyrics, context };
  }
}

const deepSeekDraftSchema = z.object({
  message: z.string().min(1).max(2_000),
  lyrics: z.string().max(10_000).nullable(),
  context: z.object({
    emotion: z.string().min(1).max(80).default("温暖坚定"),
    singingMode: z.enum(["chorus", "solo"]).default("chorus"),
  }),
});

/** DeepSeek V4 Flash：系统 Prompt + 历史消息 + 结构化 user payload → Zod 校验 JSON。 */
export class DeepSeekLyricAssistant implements LyricAssistant {
  constructor(
    private readonly apiKey = process.env.DEEPSEEK_API_KEY,
    private readonly baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    private readonly model = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
  ) {}

  async createDraft(input: CreativeChatInput): Promise<AssistantDraft> {
    if (!this.apiKey) throw new DomainError("PROVIDER_NOT_CONFIGURED", 503, "DeepSeek 尚未配置");
    const artistContext = input.artist ? {
      id: input.artist.id,
      name: input.artist.name,
      fandomName: input.artist.fandomName,
      slogan: input.artist.slogan,
      summary: input.artist.summary,
      genres: input.artist.genres,
      selectedEvents: input.artist.events.filter((event) => input.eventIds.includes(event.id)),
    } : null;
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model: this.model,
        thinking: { type: "disabled" },
        temperature: 0.75,
        max_tokens: 2_800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildLyricSystemPrompt() },
          ...(input.history ?? []).slice(-20).map((message) => ({ role: message.role, content: message.content.slice(0, 4_000) })),
          { role: "user", content: JSON.stringify({ artist: artistContext, request: input.message, currentLyrics: input.currentLyrics ?? null }) },
        ],
      }),
    });
    if (!response.ok) throw new DomainError("UPSTREAM_ERROR", 502, response.status === 401 ? "DeepSeek 认证失败" : "歌词服务暂时不可用，请稍后重试");
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new DomainError("UPSTREAM_INVALID_RESPONSE", 502, "歌词服务返回内容无效");
    let parsed: unknown;
    try { parsed = JSON.parse(content); } catch { throw new DomainError("UPSTREAM_INVALID_RESPONSE", 502, "歌词服务返回内容无效"); }
    const validated = deepSeekDraftSchema.safeParse(parsed);
    if (!validated.success) throw new DomainError("UPSTREAM_INVALID_RESPONSE", 502, "歌词服务返回内容无效");
    const draft = validated.data;
    return {
      message: draft.message,
      lyrics: draft.lyrics,
      context: { artistId: input.artist?.id ?? null, eventIds: input.eventIds, emotion: draft.context.emotion, singingMode: draft.context.singingMode, executionKind: "real_external" },
    };
  }
}

/** 按环境变量选择 DeepSeek 或透明 Mock（失败不回退伪装）。 */
export function getLyricAssistant(): LyricAssistant {
  return process.env.NODE_ENV !== "test" && process.env.DEEPSEEK_API_KEY && process.env.TEXT_PROVIDER_MODE !== "mock" ? new DeepSeekLyricAssistant() : new MockLyricAssistant();
}
