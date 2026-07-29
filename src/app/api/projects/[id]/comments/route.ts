import { z } from "zod";

import { getCurrentUser } from "@/modules/auth/queries";
import { ShareService } from "@/modules/sharing/share-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await getCurrentUser(); if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录"); const { id } = await context.params; return apiSuccess(await new ShareService().listComments(user, z.string().uuid().parse(id))); }
  catch (error) { return apiError(error); }
}

const createSchema = z.object({ versionId: z.string().uuid(), content: z.string().trim().min(1).max(1000), atMs: z.number().int().min(0).nullable().optional() });

/** Owner 在歌曲详情页按音频时间点发表评论（docs/SPEC.md 评论规则；owner 视角，无需 share token）。 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [user, { id }, input] = await Promise.all([getCurrentUser(), context.params, request.json()]);
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const body = createSchema.parse(input);
    return apiSuccess(await new ShareService().ownerComment(user, z.string().uuid().parse(id), body), 201);
  } catch (error) { return apiError(error); }
}
