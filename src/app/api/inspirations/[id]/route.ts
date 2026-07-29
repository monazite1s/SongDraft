/** 灵感记录：详情 / 更新元信息 / 软删除。 */
import { z } from "zod";

import { getCurrentUser } from "@/modules/auth/queries";
import { InspirationService } from "@/modules/inspirations/inspiration-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const { id } = await context.params;
    return apiSuccess(await new InspirationService().getDetail(user.id, z.string().uuid().parse(id)));
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const { id } = await context.params;
    return apiSuccess(await new InspirationService().updateMeta(user.id, z.string().uuid().parse(id), await request.json()));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const { id } = await context.params;
    return apiSuccess(await new InspirationService().remove(user.id, z.string().uuid().parse(id)));
  } catch (error) {
    return apiError(error);
  }
}
