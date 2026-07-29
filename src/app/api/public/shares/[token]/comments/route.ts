/** 公开分享页发表评论（可绑定 atMs 时间点，docs/SPEC.md 评论规则）。 */
import { z } from "zod";

import { getCurrentUser } from "@/modules/auth/queries";
import { ShareService } from "@/modules/sharing/share-service";
import { apiError, apiSuccess } from "@/shared/http/api-response";

const inputSchema = z.object({ content: z.string().trim().min(1).max(1000), guestName: z.string().trim().min(1).max(40).optional(), atMs: z.number().int().min(0).nullable().optional() });

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try { const [{ token }, user, input] = await Promise.all([context.params, getCurrentUser(), request.json()]); return apiSuccess(await new ShareService().comment(z.string().min(20).max(128).parse(token), inputSchema.parse(input), user), 201); }
  catch (error) { return apiError(error); }
}
