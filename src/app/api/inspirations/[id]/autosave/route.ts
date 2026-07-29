import { getCurrentUser } from "@/modules/auth/queries";
import { InspirationService } from "@/modules/inspirations/inspiration-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

/**
 * 灵感自动保存：服务端计算权威 contentHash；
 * 快照未变时不新增历史版本，客户端可安全重试。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const { id } = await params;
    const result = await new InspirationService().autosave(user.id, id, await request.json());
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
