/** 公开分享页数据：按 Token + 当前登录用户白名单授权返回可播放 Demo（无管理权限）。 */
import { z } from "zod";

import { getCurrentUser } from "@/modules/auth/queries";
import { ShareService } from "@/modules/sharing/share-service";
import { apiError, apiSuccess } from "@/shared/http/api-response";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try { const [{ token }, user] = await Promise.all([context.params, getCurrentUser()]); return apiSuccess(await new ShareService().getPublic(z.string().min(20).max(128).parse(token), user)); }
  catch (error) { return apiError(error); }
}
