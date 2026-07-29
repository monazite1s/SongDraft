/** Owner 列出某分享链接的访问授权（白名单审计）。 */
import { z } from "zod";

import { getCurrentUser } from "@/modules/auth/queries";
import { ShareService } from "@/modules/sharing/share-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

export async function GET(_request: Request, context: { params: Promise<{ id: string; shareId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const { shareId } = await context.params;
    return apiSuccess(await new ShareService().listGrants(user, z.string().uuid().parse(shareId)));
  } catch (error) { return apiError(error); }
}
