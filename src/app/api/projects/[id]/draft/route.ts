/** 制作台草稿更新：歌词、描述、创作上下文等。 */
import { z } from "zod";

import { getCurrentUser } from "@/modules/auth/queries";
import { ProjectService } from "@/modules/projects/project-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const { id } = await context.params;
    return apiSuccess(await new ProjectService().updateDraft(user.id, z.string().uuid().parse(id), await request.json()));
  } catch (error) { return apiError(error); }
}
