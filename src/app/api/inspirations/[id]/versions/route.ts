/** 灵感记录的真实快照历史（版本时间线）。 */
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
    return apiSuccess(await new InspirationService().listVersions(user.id, z.string().uuid().parse(id)));
  } catch (error) {
    return apiError(error);
  }
}
