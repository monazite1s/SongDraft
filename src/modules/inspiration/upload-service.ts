import type { ObjectStorage } from "@/infrastructure/storage/contracts";
import { createObjectKey } from "@/infrastructure/storage/object-key";
import { DomainError } from "@/shared/errors/domain-error";
import { createUploadIntentSchema, type CreateUploadIntentInput } from "./upload-schema";
import type { UploadRepository } from "./upload-repository";

export class UploadService {
  constructor(
    private readonly repository: UploadRepository,
    private readonly storage: ObjectStorage,
  ) {}

  async createIntent(ownerId: string, unknownInput: unknown) {
    const input = createUploadIntentSchema.parse(unknownInput) as CreateUploadIntentInput;
    if (!(await this.repository.isOwnedProject(input.projectId, ownerId))) {
      throw new DomainError("NOT_FOUND", 404, "项目不存在");
    }

    const id = crypto.randomUUID();
    const objectKey = createObjectKey({
      environment: process.env.NODE_ENV === "production" ? "prod" : "dev",
      userId: ownerId,
      projectId: input.projectId,
      kind: input.kind,
      filename: input.filename,
      objectId: id,
    });
    const upload = await this.storage.createUpload({
      objectKey,
      contentType: input.mimeType,
      sizeBytes: input.sizeBytes,
      expiresInSeconds: 600,
    });
    await this.repository.createPending({
      id,
      projectId: input.projectId,
      ownerId,
      kind: input.kind,
      originalName: input.filename,
      objectKey,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      status: "uploading",
    });
    return { uploadId: id, objectKey, ...upload };
  }

  async complete(ownerId: string, uploadId: string) {
    const asset = await this.repository.findOwned(uploadId, ownerId);
    if (!asset) throw new DomainError("NOT_FOUND", 404, "上传记录不存在");
    if (asset.status === "ready") return asset;

    const stored = await this.storage.head(asset.objectKey);
    if (!stored || stored.sizeBytes !== asset.sizeBytes || stored.contentType !== asset.mimeType) {
      throw new DomainError("UPLOAD_INVALID", 422, "存储对象校验失败");
    }
    await this.repository.markReady(uploadId);
    return { ...asset, status: "ready" as const };
  }
}
