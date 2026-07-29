/** 确认创意简报：写入确认时间，生成链路据此读取已确认简报。 */
import { z } from "zod";

import { getCurrentUser } from "@/modules/auth/queries";
import { BriefService } from "@/modules/projects/brief-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

export async function POST(_request: Request, context: { params: Promise<{ id: string; briefId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const { id, briefId } = await context.params;
    return apiSuccess(await new BriefService().confirm(user, z.string().uuid().parse(id), z.string().uuid().parse(briefId)));
  } catch (error) {
    return apiError(error);
  }
}
