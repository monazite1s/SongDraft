import { and, eq, isNull, ne, sql } from "drizzle-orm";

import { getDatabase } from "@/infrastructure/db/client";
import { inspirationAssets, inspirationRecordVersions, inspirationRecords, profiles, projects } from "@/infrastructure/db/schema";
import type { AuthUser } from "@/modules/auth/types";
import { ProjectService } from "@/modules/projects/project-service";
import { getProjectRepository } from "@/modules/projects/project-repository";
import type { InspirationAttachment } from "./attachment-schema";
import type { InspirationSnapshot, InspirationSnapshotReason } from "./inspiration-schema";
import type { AutosaveResult, InspirationRecord } from "./inspiration-types";

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
}

const songDraftInspirationStore = globalThis as typeof globalThis & {
  __songDraftInspirationRecords?: Map<string, InspirationRecord>;
};
const globalMockRecords = songDraftInspirationStore.__songDraftInspirationRecords ??= new Map<string, InspirationRecord>();

/**
 * Mock mode uses a process-level store so separate Route Handler instances see
 * the same capture. Tests pass an isolated map to avoid cross-test coupling.
 */
export class MockInspirationRepository implements InspirationRepository {
  constructor(private readonly records: Map<string, InspirationRecord> = globalMockRecords) {}

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
}

export function getInspirationRepository(): InspirationRepository {
  return process.env.DATABASE_URL ? new DrizzleInspirationRepository() : new MockInspirationRepository();
}
