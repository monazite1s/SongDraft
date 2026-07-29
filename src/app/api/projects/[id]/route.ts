import { z } from "zod";

import { getCurrentUser } from "@/modules/auth/queries";
import { ProjectService } from "@/modules/projects/project-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const { id } = await context.params;
    return apiSuccess(await new ProjectService().get(user.id, z.string().uuid().parse(id)));
  } catch (error) { return apiError(error); }
}

/** 软删除项目（设置 deletedAt；列表查询已过滤）。仅 owner 可删除。 */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const { id } = await context.params;
    await new ProjectService().delete(user.id, z.string().uuid().parse(id));
    return apiSuccess({ ok: true });
  } catch (error) { return apiError(error); }
}
