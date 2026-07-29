/** 生成创意简报：读取项目素材 → AI/Mock → 写入 creative_briefs（新 revision）。 */
import { z } from "zod";

import { getCurrentUser } from "@/modules/auth/queries";
import { BriefService } from "@/modules/projects/brief-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const { id } = await context.params;
    return apiSuccess(await new BriefService().generate(user, z.string().uuid().parse(id)), 201);
  } catch (error) {
    return apiError(error);
  }
}
