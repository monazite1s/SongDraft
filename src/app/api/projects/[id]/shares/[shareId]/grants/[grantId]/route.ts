/** Owner 撤销某访问者的分享授权，撤销后该访问者再访问将被拒绝。 */
import { z } from "zod";

import { getCurrentUser } from "@/modules/auth/queries";
import { ShareService } from "@/modules/sharing/share-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; shareId: string; grantId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const { shareId, grantId } = await context.params;
    return apiSuccess(await new ShareService().revokeGrant(user, z.string().uuid().parse(shareId), z.string().uuid().parse(grantId)));
  } catch (error) { return apiError(error); }
}
