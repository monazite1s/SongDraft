import { getCurrentUser } from "@/modules/auth/queries";
import { InspirationService } from "@/modules/inspirations/inspiration-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

/** 创建首条灵感记录：客户端已有实质输入后才落库。 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const record = await new InspirationService().create(user, await request.json());
    return apiSuccess(record, 201);
  } catch (error) {
    return apiError(error);
  }
}
