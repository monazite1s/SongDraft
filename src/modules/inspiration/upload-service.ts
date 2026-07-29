/**
 * 灵感素材上传流程（docs/SPEC.md：先持久化再关联项目）
 *
 * createIntent：校验项目所有权 → 生成 objectKey → 签发上传 URL → 记 pending。
 * complete：head 校验对象大小/类型 → 标记 ready。
 * 入口：POST /api/uploads/intents → PUT 存储 → POST /api/uploads/[id]/complete。
 */
import type { ObjectStorage } from "@/infrastructure/storage/contracts";
import { createObjectKey } from "@/infrastructure/storage/object-key";
import { DomainError } from "@/shared/errors/domain-error";
import { createUploadIntentSchema, getUploadScope, type CreateUploadIntentInput } from "./upload-schema";
import type { UploadRepository } from "./upload-repository";

export class UploadService {
  constructor(
    private readonly repository: UploadRepository,
    private readonly storage: ObjectStorage,
  ) {}

  /** 创建上传意图并返回短时签名 URL（客户端直传，不经应用服务器中转文件体）。 */
  async createIntent(ownerId: string, unknownInput: unknown) {
    const input = createUploadIntentSchema.parse(unknownInput) as CreateUploadIntentInput;
    const scope = getUploadScope(input);
    const isOwned = scope.type === "project"
      ? await this.repository.isOwnedProject(scope.id, ownerId)
      : await this.repository.isOwnedRecord(scope.id, ownerId);
    if (!isOwned) {
      throw new DomainError("NOT_FOUND", 404, "上传归属不存在或无权访问");
    }

    // The caller can reserve an ID in its snapshot before upload; ownership is still verified above.
    const id = input.assetId ?? crypto.randomUUID();
    const objectKey = createObjectKey({
      environment: process.env.NODE_ENV === "production" ? "prod" : "dev",
      userId: ownerId,
      scope,
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
      projectId: scope.type === "project" ? scope.id : null,
      recordId: scope.type === "record" ? scope.id : null,
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

  /** 上传完成后校验存储对象并落为 ready 素材。 */
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
