import { and, count, desc, eq, ilike, inArray, isNull, isNotNull, ne, or, sql } from "drizzle-orm";

import { getDatabase } from "@/infrastructure/db/client";
import { inspirationAssets, inspirationRecordVersions, inspirationRecords, profiles, projects } from "@/infrastructure/db/schema";
import type { AuthUser } from "@/modules/auth/types";
import { ProjectService } from "@/modules/projects/project-service";
import { getProjectRepository } from "@/modules/projects/project-repository";
import type { InspirationAttachment } from "./attachment-schema";
import type { InspirationSnapshot, InspirationSnapshotReason } from "./inspiration-schema";
import type {
  AutosaveResult,
  InspirationDetail,
  InspirationListFilters,
  InspirationListPage,
  InspirationRecord,
  InspirationRecordVersion,
} from "./inspiration-types";
import { summarizeSnapshot } from "./snapshot";

export interface SnapshotWrite {
  snapshot: InspirationSnapshot;
  contentHash: string;
  summary: string | null;
  reason: InspirationSnapshotReason;
}

export interface InspirationRepository {
  create(owner: AuthUser, write: SnapshotWrite): Promise<InspirationRecord>;
  findOwned(recordId: string, ownerId: string): Promise<InspirationRecord | null>;
  saveSnapshot(recordId: string, ownerId: string, write: SnapshotWrite): Promise<AutosaveResult | null>;
  attach(recordId: string, owner: AuthUser, destination: InspirationAttachment): Promise<InspirationRecord | null>;
  listPage(ownerId: string, filters: InspirationListFilters): Promise<InspirationListPage>;
  findDetail(recordId: string, ownerId: string): Promise<InspirationDetail | null>;
  updateMeta(recordId: string, ownerId: string, patch: { title?: string | null }): Promise<InspirationRecord | null>;
  softDelete(recordId: string, ownerId: string): Promise<boolean>;
  listVersions(recordId: string, ownerId: string): Promise<InspirationRecordVersion[]>;
  restoreVersion(recordId: string, ownerId: string, versionId: string): Promise<InspirationRecord | null>;
}

type RecordRow = typeof inspirationRecords.$inferSelect;

function mapRecord(row: RecordRow): InspirationRecord {
  return {
    id: row.id,
    ownerId: row.ownerId,
    projectId: row.projectId,
    title: row.title,
    primaryKind: row.primaryKind,
    summary: row.summary,
    tags: row.tags,
    currentSnapshot: row.currentSnapshot as InspirationSnapshot,
    currentContentHash: row.currentContentHash,
    versionCount: row.versionCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function projectSeedFromRecord(record: InspirationRecord) {
  const snapshot = record.currentSnapshot;
  const lyrics = snapshot.primaryKind === "text" && snapshot.text?.inspirationType === "lyric"
    ? snapshot.text.content
    : undefined;
  return { description: record.summary ?? undefined, lyrics };
}

function mapVersionRow(row: typeof inspirationRecordVersions.$inferSelect): InspirationRecordVersion {
  return {
    id: row.id,
    recordId: row.recordId,
    versionNo: row.versionNo,
    snapshot: row.snapshot as InspirationSnapshot,
    contentHash: row.contentHash,
    reason: row.reason,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

export class DrizzleInspirationRepository implements InspirationRepository {
  async create(owner: AuthUser, write: SnapshotWrite) {
    return getDatabase().transaction(async (tx) => {
      await tx.insert(profiles).values({
        id: owner.id,
        email: owner.email,
        displayName: owner.displayName,
      }).onConflictDoUpdate({
        target: profiles.id,
        set: { email: owner.email, displayName: owner.displayName, updatedAt: new Date() },
      });

      const [record] = await tx.insert(inspirationRecords).values({
        ownerId: owner.id,
        title: write.snapshot.title || null,
        primaryKind: write.snapshot.primaryKind,
        summary: write.summary,
        tags: write.snapshot.tags,
        currentSnapshot: write.snapshot,
        currentContentHash: write.contentHash,
      }).returning();
      if (!record) throw new Error("Failed to create inspiration record");

      await tx.insert(inspirationRecordVersions).values({
        recordId: record.id,
        versionNo: 1,
        snapshot: write.snapshot,
        contentHash: write.contentHash,
        reason: "manual",
        createdBy: owner.id,
      });
      return mapRecord(record);
    });
  }

  async findOwned(recordId: string, ownerId: string) {
    const [record] = await getDatabase().select().from(inspirationRecords).where(and(
      eq(inspirationRecords.id, recordId),
      eq(inspirationRecords.ownerId, ownerId),
      isNull(inspirationRecords.deletedAt),
    )).limit(1);
    return record ? mapRecord(record) : null;
  }

  async saveSnapshot(recordId: string, ownerId: string, write: SnapshotWrite) {
    return getDatabase().transaction(async (tx) => {
      // A row lock serializes two autosave requests so version numbers stay monotonic.
      await tx.execute(sql`select id from inspiration_records where id = ${recordId} and owner_id = ${ownerId} for update`);
      const [record] = await tx.select().from(inspirationRecords).where(and(
        eq(inspirationRecords.id, recordId),
        eq(inspirationRecords.ownerId, ownerId),
        isNull(inspirationRecords.deletedAt),
      )).limit(1);
      if (!record) return null;
      if (record.currentContentHash === write.contentHash) {
        return { record: mapRecord(record), versionCreated: false };
      }

      const nextVersionNo = record.versionCount + 1;
      await tx.insert(inspirationRecordVersions).values({
        recordId,
        versionNo: nextVersionNo,
        snapshot: write.snapshot,
        contentHash: write.contentHash,
        reason: write.reason,
        createdBy: ownerId,
      });
      const [updated] = await tx.update(inspirationRecords).set({
        title: write.snapshot.title || null,
        summary: write.summary,
        tags: write.snapshot.tags,
        currentSnapshot: write.snapshot,
        currentContentHash: write.contentHash,
        versionCount: nextVersionNo,
        updatedAt: new Date(),
      }).where(eq(inspirationRecords.id, recordId)).returning();
      if (!updated) throw new Error("Failed to update inspiration record");
      return { record: mapRecord(updated), versionCreated: true };
    });
  }

  async attach(recordId: string, owner: AuthUser, destination: InspirationAttachment) {
    return getDatabase().transaction(async (tx) => {
      // Locking prevents two save-to-project actions from splitting one record.
      await tx.execute(sql`select id from inspiration_records where id = ${recordId} and owner_id = ${owner.id} for update`);
      const [record] = await tx.select().from(inspirationRecords).where(and(
        eq(inspirationRecords.id, recordId),
        eq(inspirationRecords.ownerId, owner.id),
        isNull(inspirationRecords.deletedAt),
      )).limit(1);
      if (!record) return null;

      let projectId: string;
      if (destination.destination === "existing_project") {
        const [project] = await tx.select({ id: projects.id }).from(projects).where(and(
          eq(projects.id, destination.projectId),
          eq(projects.ownerId, owner.id),
          isNull(projects.deletedAt),
        )).limit(1);
        if (!project) return null;
        projectId = project.id;
      } else {
        const seed = projectSeedFromRecord(mapRecord(record));
        const [project] = await tx.insert(projects).values({
          ownerId: owner.id,
          title: destination.title,
          description: seed.description ?? null,
          currentLyrics: seed.lyrics ?? null,
          creativeContext: {},
        }).returning({ id: projects.id });
        if (!project) throw new Error("Failed to create project for inspiration");
        projectId = project.id;
      }

      const now = new Date();
      await tx.update(inspirationAssets).set({ projectId, updatedAt: now }).where(and(
        eq(inspirationAssets.recordId, recordId),
        eq(inspirationAssets.ownerId, owner.id),
        ne(inspirationAssets.status, "deleted"),
      ));
      await tx.update(projects).set({ updatedAt: now }).where(eq(projects.id, projectId));
      const [updated] = await tx.update(inspirationRecords).set({ projectId, updatedAt: now }).where(eq(inspirationRecords.id, recordId)).returning();
      return updated ? mapRecord(updated) : null;
    });
  }

  /** 灵感库分页查询：服务端筛选 + 项目名一次 JOIN，不加载完整 snapshot。 */
  async listPage(ownerId: string, filters: InspirationListFilters): Promise<InspirationListPage> {
    const page = Number.isFinite(filters.page) ? Math.max(1, Math.floor(filters.page as number)) : 1;
    const pageSize = Number.isFinite(filters.pageSize) ? Math.min(50, Math.max(1, Math.floor(filters.pageSize as number))) : 20;
    const conds = [eq(inspirationRecords.ownerId, ownerId), isNull(inspirationRecords.deletedAt)];
    if (filters.query?.trim()) {
      const q = `%${filters.query.trim()}%`;
      conds.push(or(ilike(inspirationRecords.title, q), ilike(inspirationRecords.summary, q)) as ReturnType<typeof eq>);
    }
    if (filters.kinds?.length) conds.push(inArray(inspirationRecords.primaryKind, filters.kinds));
    if (filters.attached === "attached") conds.push(isNotNull(inspirationRecords.projectId));
    if (filters.attached === "unattached") conds.push(isNull(inspirationRecords.projectId));
    if (filters.tags?.length) conds.push(sql`${inspirationRecords.tags} @> ${JSON.stringify(filters.tags)}::jsonb`);
    const where = and(...conds);
    const orderCol = filters.sort === "created" ? inspirationRecords.createdAt : inspirationRecords.updatedAt;
    const db = getDatabase();
    const [rows, totalRows] = await Promise.all([
      db.select({
        id: inspirationRecords.id,
        title: inspirationRecords.title,
        primaryKind: inspirationRecords.primaryKind,
        summary: inspirationRecords.summary,
        tags: inspirationRecords.tags,
        projectId: inspirationRecords.projectId,
        projectName: projects.title,
        versionCount: inspirationRecords.versionCount,
        createdAt: inspirationRecords.createdAt,
        updatedAt: inspirationRecords.updatedAt,
      }).from(inspirationRecords)
        .leftJoin(projects, eq(projects.id, inspirationRecords.projectId))
        .where(where)
        .orderBy(desc(orderCol))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ value: count() }).from(inspirationRecords).where(where),
    ]);
    const total = Number(totalRows[0]?.value ?? 0);
    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        primaryKind: row.primaryKind,
        summary: row.summary,
        tags: row.tags,
        projectId: row.projectId,
        projectName: row.projectName,
        versionCount: row.versionCount,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findDetail(recordId: string, ownerId: string): Promise<InspirationDetail | null> {
    const record = await this.findOwned(recordId, ownerId);
    if (!record) return null;
    const versions = await this.listVersions(recordId, ownerId);
    return { record, versions };
  }

  async updateMeta(recordId: string, ownerId: string, patch: { title?: string | null }): Promise<InspirationRecord | null> {
    if (patch.title === undefined) return this.findOwned(recordId, ownerId);
    const [row] = await getDatabase().update(inspirationRecords)
      .set({ title: patch.title, updatedAt: new Date() })
      .where(and(eq(inspirationRecords.id, recordId), eq(inspirationRecords.ownerId, ownerId), isNull(inspirationRecords.deletedAt)))
      .returning();
    return row ? mapRecord(row) : null;
  }

  async softDelete(recordId: string, ownerId: string): Promise<boolean> {
    const [row] = await getDatabase().update(inspirationRecords)
      .set({ deletedAt: new Date() })
      .where(and(eq(inspirationRecords.id, recordId), eq(inspirationRecords.ownerId, ownerId), isNull(inspirationRecords.deletedAt)))
      .returning();
    return Boolean(row);
  }

  async listVersions(recordId: string, ownerId: string): Promise<InspirationRecordVersion[]> {
    const record = await this.findOwned(recordId, ownerId);
    if (!record) return [];
    const rows = await getDatabase().select().from(inspirationRecordVersions)
      .where(eq(inspirationRecordVersions.recordId, recordId))
      .orderBy(desc(inspirationRecordVersions.versionNo));
    return rows.map(mapVersionRow);
  }

  /** 恢复历史快照：将记录当前内容指回目标快照（内容已有版本行，去重模型下不新增行，不删历史）。 */
  async restoreVersion(recordId: string, ownerId: string, versionId: string): Promise<InspirationRecord | null> {
    return getDatabase().transaction(async (tx) => {
      await tx.execute(sql`select id from inspiration_records where id = ${recordId} and owner_id = ${ownerId} for update`);
      const [target] = await tx.select().from(inspirationRecordVersions)
        .where(and(eq(inspirationRecordVersions.id, versionId), eq(inspirationRecordVersions.recordId, recordId)))
        .limit(1);
      if (!target) return null;
      const snapshot = target.snapshot as InspirationSnapshot;
      const [updated] = await tx.update(inspirationRecords).set({
        title: snapshot.title || null,
        summary: summarizeSnapshot(snapshot),
        tags: snapshot.tags,
        currentSnapshot: snapshot,
        currentContentHash: target.contentHash,
        updatedAt: new Date(),
      }).where(eq(inspirationRecords.id, recordId)).returning();
      return updated ? mapRecord(updated) : null;
    });
  }
}

const songDraftInspirationStore = globalThis as typeof globalThis & {
  __songDraftInspirationRecords?: Map<string, InspirationRecord>;
  __songDraftInspirationVersions?: Map<string, InspirationRecordVersion[]>;
};
const globalMockRecords = songDraftInspirationStore.__songDraftInspirationRecords ??= new Map<string, InspirationRecord>();
const globalMockVersions = songDraftInspirationStore.__songDraftInspirationVersions ??= new Map<string, InspirationRecordVersion[]>();

/**
 * Mock mode uses a process-level store so separate Route Handler instances see
 * the same capture. Tests pass an isolated map to avoid cross-test coupling.
 */
export class MockInspirationRepository implements InspirationRepository {
  constructor(
    private readonly records: Map<string, InspirationRecord> = globalMockRecords,
    private readonly versions: Map<string, InspirationRecordVersion[]> = globalMockVersions,
  ) {}

  async create(owner: AuthUser, write: SnapshotWrite) {
    const now = new Date().toISOString();
    const record: InspirationRecord = {
      id: crypto.randomUUID(),
      ownerId: owner.id,
      projectId: null,
      title: write.snapshot.title || null,
      primaryKind: write.snapshot.primaryKind,
      summary: write.summary,
      tags: [...write.snapshot.tags],
      currentSnapshot: structuredClone(write.snapshot),
      currentContentHash: write.contentHash,
      versionCount: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(record.id, record);
    this.versions.set(record.id, [{
      id: crypto.randomUUID(),
      recordId: record.id,
      versionNo: 1,
      snapshot: structuredClone(write.snapshot),
      contentHash: write.contentHash,
      reason: write.reason,
      createdBy: owner.id,
      createdAt: now,
    }]);
    return structuredClone(record);
  }

  async findOwned(recordId: string, ownerId: string) {
    const record = this.records.get(recordId);
    return record?.ownerId === ownerId ? structuredClone(record) : null;
  }

  async saveSnapshot(recordId: string, ownerId: string, write: SnapshotWrite) {
    const record = this.records.get(recordId);
    if (!record || record.ownerId !== ownerId) return null;
    if (record.currentContentHash === write.contentHash) {
      return { record: structuredClone(record), versionCreated: false };
    }
    record.title = write.snapshot.title || null;
    record.summary = write.summary;
    record.tags = [...write.snapshot.tags];
    record.currentSnapshot = structuredClone(write.snapshot);
    record.currentContentHash = write.contentHash;
    record.versionCount += 1;
    record.updatedAt = new Date().toISOString();
    const list = this.versions.get(recordId) ?? [];
    list.push({
      id: crypto.randomUUID(),
      recordId,
      versionNo: record.versionCount,
      snapshot: structuredClone(write.snapshot),
      contentHash: write.contentHash,
      reason: write.reason,
      createdBy: ownerId,
      createdAt: record.updatedAt,
    });
    this.versions.set(recordId, list);
    return { record: structuredClone(record), versionCreated: true };
  }

  async attach(recordId: string, owner: AuthUser, destination: InspirationAttachment) {
    const record = this.records.get(recordId);
    if (!record || record.ownerId !== owner.id) return null;
    let projectId: string;
    if (destination.destination === "existing_project") {
      const project = await getProjectRepository().findOwned(destination.projectId, owner.id);
      if (!project) return null;
      projectId = project.id;
    } else {
      const seed = projectSeedFromRecord(record);
      const project = await new ProjectService().create(owner, {
        title: destination.title,
        description: seed.description,
        lyrics: seed.lyrics,
      });
      projectId = project.id;
    }
    record.projectId = projectId;
    record.updatedAt = new Date().toISOString();
    return structuredClone(record);
  }

  async listPage(ownerId: string, filters: InspirationListFilters): Promise<InspirationListPage> {
    const page = Number.isFinite(filters.page) ? Math.max(1, Math.floor(filters.page as number)) : 1;
    const pageSize = Number.isFinite(filters.pageSize) ? Math.min(50, Math.max(1, Math.floor(filters.pageSize as number))) : 20;
    let items = [...this.records.values()].filter((r) => r.ownerId === ownerId);
    if (filters.query?.trim()) {
      const q = filters.query.trim().toLowerCase();
      items = items.filter((r) => (r.title?.toLowerCase().includes(q) || r.summary?.toLowerCase().includes(q)));
    }
    if (filters.kinds?.length) items = items.filter((r) => filters.kinds!.includes(r.primaryKind));
    if (filters.attached === "attached") items = items.filter((r) => Boolean(r.projectId));
    if (filters.attached === "unattached") items = items.filter((r) => !r.projectId);
    if (filters.tags?.length) items = items.filter((r) => filters.tags!.every((t) => r.tags.includes(t)));
    items.sort((a, b) => (filters.sort === "created" ? b.createdAt : b.updatedAt).localeCompare(filters.sort === "created" ? a.createdAt : a.updatedAt));
    const total = items.length;
    const paged = items.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
    const out = await Promise.all(paged.map(async (r) => {
      let projectName: string | null = null;
      if (r.projectId) {
        const project = await getProjectRepository().findOwned(r.projectId, ownerId);
        projectName = project?.title ?? null;
      }
      return { id: r.id, title: r.title, primaryKind: r.primaryKind, summary: r.summary, tags: [...r.tags], projectId: r.projectId, projectName, versionCount: r.versionCount, createdAt: r.createdAt, updatedAt: r.updatedAt };
    }));
    return { items: out, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findDetail(recordId: string, ownerId: string): Promise<InspirationDetail | null> {
    const record = await this.findOwned(recordId, ownerId);
    if (!record) return null;
    const versions = (this.versions.get(recordId) ?? []).map((v) => structuredClone(v)).sort((a, b) => b.versionNo - a.versionNo);
    return { record, versions };
  }

  async updateMeta(recordId: string, ownerId: string, patch: { title?: string | null }): Promise<InspirationRecord | null> {
    const record = this.records.get(recordId);
    if (!record || record.ownerId !== ownerId) return null;
    if (patch.title !== undefined) {
      record.title = patch.title;
      record.updatedAt = new Date().toISOString();
    }
    return structuredClone(record);
  }

  async softDelete(recordId: string, ownerId: string): Promise<boolean> {
    const record = this.records.get(recordId);
    if (!record || record.ownerId !== ownerId) return false;
    this.records.delete(recordId);
    this.versions.delete(recordId);
    return true;
  }

  async listVersions(recordId: string, ownerId: string): Promise<InspirationRecordVersion[]> {
    const record = this.records.get(recordId);
    if (!record || record.ownerId !== ownerId) return [];
    return (this.versions.get(recordId) ?? []).map((v) => structuredClone(v)).sort((a, b) => b.versionNo - a.versionNo);
  }

  async restoreVersion(recordId: string, ownerId: string, versionId: string): Promise<InspirationRecord | null> {
    const record = this.records.get(recordId);
    if (!record || record.ownerId !== ownerId) return null;
    const target = (this.versions.get(recordId) ?? []).find((v) => v.id === versionId);
    if (!target) return null;
    record.title = target.snapshot.title || null;
    record.summary = summarizeSnapshot(target.snapshot);
    record.tags = [...target.snapshot.tags];
    record.currentSnapshot = structuredClone(target.snapshot);
    record.currentContentHash = target.contentHash;
    record.updatedAt = new Date().toISOString();
    return structuredClone(record);
  }
}

export function getInspirationRepository(): InspirationRepository {
  return process.env.DATABASE_URL ? new DrizzleInspirationRepository() : new MockInspirationRepository();
}
