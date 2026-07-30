/**
 * 候选音频播放地址：按所有权重签 COS URL，避免 session 缓存的签名过期后无法播放。
 */
import { z } from "zod";

import { getCurrentUser } from "@/modules/auth/queries";
import { GenerationService } from "@/modules/generation/generation-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const { id } = await context.params;
    const result = await new GenerationService().resolveCandidateAudio(user, z.string().uuid().parse(id));
    if (!result) throw new DomainError("NOT_FOUND", 404, "候选音频不存在或无权访问");
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
