/** 项目列表 / 创建（制作台首次保存、创作库分页）。 */
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
    return apiSuccess(await new ProjectService().listPage(user.id, page, pageSize));
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    return apiSuccess(await new ProjectService().create(user, await request.json()), 201);
  } catch (error) { return apiError(error); }
}
