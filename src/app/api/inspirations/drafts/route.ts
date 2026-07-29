import { z } from "zod";

import { getCurrentUser } from "@/modules/auth/queries";
import { createInspirationDraft } from "@/modules/inspirations/inspiration-draft";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

/** 为音频/图片采集创建私有草稿，作为后续上传的 owner。 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const { primaryKind } = z.object({ primaryKind: z.enum(["audio", "image"]) }).parse(await request.json());
    return apiSuccess(await createInspirationDraft(user, primaryKind), 201);
  } catch (error) {
    return apiError(error);
  }
}
