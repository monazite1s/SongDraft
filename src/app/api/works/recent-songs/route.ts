/** 最近歌曲（侧栏「最近歌曲」）：每项目代表版本（主版本/最新版本），按项目最近排序。 */
import { getCurrentUser } from "@/modules/auth/queries";
import { GenerationService } from "@/modules/generation/generation-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || 5);
    return apiSuccess(await new GenerationService().listRecentSongs(user, limit));
  } catch (error) {
    return apiError(error);
  }
}
