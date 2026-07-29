import { getObjectStorage } from "@/infrastructure/storage/factory";
import { getCurrentUser } from "@/modules/auth/queries";
import { getUploadRepository } from "@/modules/inspiration/upload-repository";
import { UploadService } from "@/modules/inspiration/upload-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const service = new UploadService(getUploadRepository(), getObjectStorage());
    return apiSuccess(await service.createIntent(user.id, await request.json()), 201);
  } catch (error) {
    return apiError(error);
  }
}
