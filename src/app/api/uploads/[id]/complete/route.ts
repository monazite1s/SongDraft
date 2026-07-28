import { z } from "zod";

import { getObjectStorage } from "@/infrastructure/storage/factory";
import { getCurrentUser } from "@/modules/auth/queries";
import { DrizzleUploadRepository } from "@/modules/inspiration/upload-repository";
import { UploadService } from "@/modules/inspiration/upload-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const { id } = await context.params;
    const uploadId = z.string().uuid().parse(id);
    const service = new UploadService(new DrizzleUploadRepository(), getObjectStorage());
    return apiSuccess(await service.complete(user.id, uploadId));
  } catch (error) {
    return apiError(error);
  }
}
