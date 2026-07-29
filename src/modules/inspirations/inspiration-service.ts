import type { AuthUser } from "@/modules/auth/types";
import { DomainError } from "@/shared/errors/domain-error";
import { inspirationAttachmentSchema } from "./attachment-schema";
import {
  autosaveInspirationRecordSchema,
  createInspirationRecordSchema,
  type InspirationSnapshot,
} from "./inspiration-schema";
import { getInspirationRepository, type InspirationRepository } from "./inspiration-repository";
import { hashSnapshot, summarizeSnapshot } from "./snapshot";

export class InspirationService {
  constructor(private readonly repository: InspirationRepository = getInspirationRepository()) {}

  async create(owner: AuthUser, input: unknown) {
    const { snapshot } = createInspirationRecordSchema.parse(input);
    return this.repository.create(owner, this.toSnapshotWrite(snapshot, "manual"));
  }

  async autosave(ownerId: string, recordId: string, input: unknown) {
    const { snapshot, reason } = autosaveInspirationRecordSchema.parse(input);
    const existing = await this.repository.findOwned(recordId, ownerId);
    if (!existing) throw new DomainError("NOT_FOUND", 404, "灵感记录不存在或无权访问");
    if (existing.primaryKind !== snapshot.primaryKind) {
      throw new DomainError("PRIMARY_KIND_IMMUTABLE", 409, "不能改变已有灵感记录的主类型");
    }
    const result = await this.repository.saveSnapshot(recordId, ownerId, this.toSnapshotWrite(snapshot, reason));
    if (!result) throw new DomainError("NOT_FOUND", 404, "灵感记录不存在或无权访问");
    return result;
  }

  async attach(owner: AuthUser, recordId: string, input: unknown) {
    const destination = inspirationAttachmentSchema.parse(input);
    const existing = await this.repository.findOwned(recordId, owner.id);
    if (!existing) throw new DomainError("NOT_FOUND", 404, "灵感记录不存在或无权访问");
    if (existing.projectId) {
      const sameProject = destination.destination === "existing_project" && destination.projectId === existing.projectId;
      if (sameProject) return existing;
      throw new DomainError("ALREADY_ATTACHED", 409, "该灵感已保存到项目，不能直接移动");
    }
    const attached = await this.repository.attach(recordId, owner, destination);
    if (!attached) {
      throw new DomainError("PROJECT_NOT_FOUND", 404, "目标项目不存在或无权访问");
    }
    return attached;
  }

  private toSnapshotWrite(snapshot: InspirationSnapshot, reason: "autosave" | "manual") {
    return {
      snapshot,
      contentHash: hashSnapshot(snapshot),
      summary: summarizeSnapshot(snapshot),
      reason,
    } as const;
  }
}
