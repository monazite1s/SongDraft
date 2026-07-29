/** 恢复灵感历史快照：将记录当前内容指回目标快照，不删除后续历史。 */
import { z } from "zod";

import { getCurrentUser } from "@/modules/auth/queries";
import { InspirationService } from "@/modules/inspirations/inspiration-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

export async function POST(_request: Request, context: { params: Promise<{ id: string; versionId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const { id, versionId } = await context.params;
    return apiSuccess(await new InspirationService().restoreVersion(user.id, z.string().uuid().parse(id), z.string().uuid().parse(versionId)));
  } catch (error) {
    return apiError(error);
  }
}
