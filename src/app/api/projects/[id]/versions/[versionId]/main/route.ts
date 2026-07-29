/** 将指定版本设为主版本（制作台「应用」数据侧）。 */
import { z } from "zod";

import { getCurrentUser } from "@/modules/auth/queries";
import { GenerationService } from "@/modules/generation/generation-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

export async function POST(_request: Request, context: { params: Promise<{ id: string; versionId: string }> }) {
  try { const user = await getCurrentUser(); if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录"); const { id, versionId } = await context.params; return apiSuccess(await new GenerationService().setMain(user, z.string().uuid().parse(id), z.string().uuid().parse(versionId))); }
  catch (error) { return apiError(error); }
}
