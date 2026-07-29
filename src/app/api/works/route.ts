/** 创作库项目列表（带灵感数/歌曲数，/works 页用）。 */
import { getCurrentUser } from "@/modules/auth/queries";
import { ProjectService } from "@/modules/projects/project-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") || 1);
    const pageSize = Number(url.searchParams.get("pageSize") || 12);
    const query = url.searchParams.get("query") ?? "";
    const sortParam = url.searchParams.get("sort");
    const sort = sortParam === "created" ? "created" : "updated";
    return apiSuccess(await new ProjectService().listWithCounts(user.id, page, pageSize, query, sort));
  } catch (error) {
    return apiError(error);
  }
}
