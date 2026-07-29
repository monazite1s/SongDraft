/** 删除指定版本：cascade 删资产，主版本自动迁移，子节点 parent 上移。 */
import { z } from "zod";

import { getCurrentUser } from "@/modules/auth/queries";
import { GenerationService } from "@/modules/generation/generation-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; versionId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const { id, versionId } = await context.params;
    await new GenerationService().delete(user, z.string().uuid().parse(id), z.string().uuid().parse(versionId));
    return apiSuccess({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
