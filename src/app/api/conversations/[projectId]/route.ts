/** 读取项目创作对话历史（精修歌词上下文）。 */
import { z } from "zod";

import { getCurrentUser } from "@/modules/auth/queries";
import { ConversationService } from "@/modules/conversations/conversation-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const { projectId } = await context.params;
    return apiSuccess(await new ConversationService().get(user, z.string().uuid().parse(projectId)));
  } catch (error) { return apiError(error); }
}
