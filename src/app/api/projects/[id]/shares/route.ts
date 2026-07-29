/** 所有者创建 / 列出分享链接。 */
import { z } from "zod";

import { getCurrentUser } from "@/modules/auth/queries";
import { ShareService } from "@/modules/sharing/share-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

const inputSchema = z.object({ versionId: z.string().uuid(), allowComments: z.boolean().optional(), expiresAt: z.string().datetime().nullable().optional() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const { id } = await context.params;
    return apiSuccess(await new ShareService().create(user, z.string().uuid().parse(id), inputSchema.parse(await request.json())), 201);
  } catch (error) { return apiError(error); }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await getCurrentUser(); if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录"); const { id } = await context.params; return apiSuccess(await new ShareService().list(user, z.string().uuid().parse(id))); }
  catch (error) { return apiError(error); }
}
