import type { AuthUser } from "@/modules/auth/types";
import { DomainError } from "@/shared/errors/domain-error";
import { inspirationAttachmentSchema } from "./attachment-schema";
import {
  autosaveInspirationRecordSchema,
  createInspirationRecordSchema,
  type InspirationSnapshot,
} from "./inspiration-schema";
import { getInspirationRepository, type InspirationRepository } from "./inspiration-repository";
import { inspirationListQuerySchema, inspirationMetaSchema, type InspirationListQuery } from "./inspiration-query";
import { hashSnapshot, summarizeSnapshot } from "./snapshot";

export class InspirationService {
  constructor(private readonly repository: InspirationRepository = getInspirationRepository()) {}

  async create(owner: AuthUser, input: unknown) {
    const { snapshot } = createInspirationRecordSchema.parse(input);
    return this.repository.create(owner, this.toSnapshotWrite(snapshot, "manual"));
  }

  /** 灵感库分页查询（服务端筛选/排序/分页）。 */
  async list(ownerId: string, input: unknown) {
    const filters = inspirationListQuerySchema.parse(input);
    return this.repository.listPage(ownerId, filters satisfies InspirationListQuery);
  }

  /** 灵感详情：记录 + 版本历史。 */
  async getDetail(ownerId: string, recordId: string) {
    const detail = await this.repository.findDetail(recordId, ownerId);
    if (!detail) throw new DomainError("NOT_FOUND", 404, "灵感记录不存在或无权访问");
    return detail;
  }

  /** 更新标题等非版本化元信息。 */
  async updateMeta(ownerId: string, recordId: string, input: unknown) {
    const patch = inspirationMetaSchema.parse(input);
    const updated = await this.repository.updateMeta(recordId, ownerId, patch);
    if (!updated) throw new DomainError("NOT_FOUND", 404, "灵感记录不存在或无权访问");
    return updated;
  }

  /** 软删除（已归档项目的素材不立即清理）。 */
  async remove(ownerId: string, recordId: string) {
    const ok = await this.repository.softDelete(recordId, ownerId);
    if (!ok) throw new DomainError("NOT_FOUND", 404, "灵感记录不存在或无权访问");
    return { id: recordId, deleted: true };
  }

  /** 项目详情页：按项目归属列出关联灵感。 */
  async listByProject(ownerId: string, projectId: string) {
    return this.repository.listByProject(ownerId, projectId);
  }

  /** 版本时间线（只显真实变化快照，按版本号倒序）。 */
  async listVersions(ownerId: string, recordId: string) {
    const owned = await this.repository.findOwned(recordId, ownerId);
    if (!owned) throw new DomainError("NOT_FOUND", 404, "灵感记录不存在或无权访问");
    return this.repository.listVersions(recordId, ownerId);
  }

  /** 恢复历史快照：将记录当前内容指回目标快照，不删除后续历史。 */
  async restoreVersion(ownerId: string, recordId: string, versionId: string) {
    const restored = await this.repository.restoreVersion(recordId, ownerId, versionId);
    if (!restored) throw new DomainError("NOT_FOUND", 404, "灵感记录或版本不存在");
    return restored;
  }

  async autosave(ownerId: string, recordId: string, input: unknown) {
    const { snapshot, reason } = autosaveInspirationRecordSchema.parse(input);
    const existing = await this.repository.findOwned(recordId, ownerId);
    if (!existing) throw new DomainError("NOT_FOUND", 404, "灵感记录不存在或无权访问");
    // 一条灵感可同时含 text/audio/image 多个槽位；primaryKind 随当前主类型变化，不再锁定。
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
