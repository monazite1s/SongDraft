/** 编辑创意简报：覆盖 payload 并清空确认状态（编辑后需重新确认）。 */
import { z } from "zod";

import { getCurrentUser } from "@/modules/auth/queries";
import { BriefService } from "@/modules/projects/brief-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; briefId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const { id, briefId } = await context.params;
    return apiSuccess(await new BriefService().update(user, z.string().uuid().parse(id), z.string().uuid().parse(briefId), await request.json()));
  } catch (error) {
    return apiError(error);
  }
}
