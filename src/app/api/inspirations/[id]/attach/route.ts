import { getCurrentUser } from "@/modules/auth/queries";
import { InspirationService } from "@/modules/inspirations/inspiration-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

/** 用户选择项目后，将已持久化的灵感挂入新项目或已有项目。 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const { id } = await params;
    const record = await new InspirationService().attach(user, id, await request.json());
    return apiSuccess(record);
  } catch (error) {
    return apiError(error);
  }
}
