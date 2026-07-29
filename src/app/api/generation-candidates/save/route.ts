/**
 * 候选保存为正式版本（docs/SPEC.md §7.4 / §8.4）。
 *
 * 鉴权 → GenerationService.saveCandidates：将选中未保存候选事务转为 demo_versions +
 * demo_assets，回填 savedVersionId，首个设为主版本。跨用户/跨项目候选会被拒绝。
 */
import { getCurrentUser } from "@/modules/auth/queries";
import { GenerationService } from "@/modules/generation/generation-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const result = await new GenerationService().saveCandidates(user, await request.json());
    return apiSuccess(result, 201);
  } catch (error) {
    return apiError(error);
  }
}
