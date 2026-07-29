/**
 * Demo 生成入口（docs/development-state.md · MiniMax）
 * 鉴权 → 限流（10 分钟 5 次）→ GenerationService.generate；maxDuration=300 适配上游超时。
 */
import { getCurrentUser } from "@/modules/auth/queries";
import { GenerationService } from "@/modules/generation/generation-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

export const runtime = "nodejs";
export const maxDuration = 300;

const generationRateStore = globalThis as typeof globalThis & { __songDraftGenerationAttempts?: Map<string, number[]> };
const generationAttempts = generationRateStore.__songDraftGenerationAttempts ??= new Map<string, number[]>();

function checkGenerationRateLimit(userId: string) {
  const now = Date.now();
  const recent = (generationAttempts.get(userId) ?? []).filter((time) => now - time < 10 * 60_000);
  if (recent.length >= 5) throw new DomainError("RATE_LIMITED", 429, "生成请求过于频繁，请稍后再试");
  recent.push(now); generationAttempts.set(userId, recent);
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    checkGenerationRateLimit(user.id);
    return apiSuccess(await new GenerationService().generate(user, await request.json()), 201);
  } catch (error) { return apiError(error); }
}
