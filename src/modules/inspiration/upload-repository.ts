import { and, eq, isNull } from "drizzle-orm";

import { getDatabase } from "@/infrastructure/db/client";
import { inspirationAssets, inspirationRecords, projects } from "@/infrastructure/db/schema";
import { getInspirationRepository } from "@/modules/inspirations/inspiration-repository";
import { attachMockAsset, getProjectRepository } from "@/modules/projects/project-repository";

export interface UploadAsset {
  id: string;
  projectId: string | null;
  recordId: string | null;
  ownerId: string;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  status: "pending" | "uploading" | "ready" | "failed" | "deleted";
}

export interface UploadRepository {
  isOwnedProject(projectId: string, ownerId: string): Promise<boolean>;
  isOwnedRecord(recordId: string, ownerId: string): Promise<boolean>;
  createPending(asset: UploadAsset & { kind: "audio" | "image" | "video"; originalName: string }): Promise<void>;
  findOwned(uploadId: string, ownerId: string): Promise<UploadAsset | null>;
  markReady(uploadId: string): Promise<void>;
}

export class DrizzleUploadRepository implements UploadRepository {
  async isOwnedProject(projectId: string, ownerId: string) {
    const [project] = await getDatabase()
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId), isNull(projects.deletedAt)))
      .limit(1);
    return Boolean(project);
  }

  async isOwnedRecord(recordId: string, ownerId: string) {
    const [record] = await getDatabase()
      .select({ id: inspirationRecords.id })
      .from(inspirationRecords)
      .where(and(eq(inspirationRecords.id, recordId), eq(inspirationRecords.ownerId, ownerId), isNull(inspirationRecords.deletedAt)))
      .limit(1);
    return Boolean(record);
  }

  async createPending(asset: UploadAsset & { kind: "audio" | "image" | "video"; originalName: string }) {
    await getDatabase().insert(inspirationAssets).values({
      id: asset.id,
      projectId: asset.projectId,
      recordId: asset.recordId,
      ownerId: asset.ownerId,
      kind: asset.kind,
      objectKey: asset.objectKey,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      status: "uploading",
    });
  }

  async findOwned(uploadId: string, ownerId: string): Promise<UploadAsset | null> {
    const [asset] = await getDatabase()
      .select({
        id: inspirationAssets.id,
        projectId: inspirationAssets.projectId,
        recordId: inspirationAssets.recordId,
        ownerId: inspirationAssets.ownerId,
        objectKey: inspirationAssets.objectKey,
        mimeType: inspirationAssets.mimeType,
        sizeBytes: inspirationAssets.sizeBytes,
        status: inspirationAssets.status,
      })
      .from(inspirationAssets)
      .where(and(eq(inspirationAssets.id, uploadId), eq(inspirationAssets.ownerId, ownerId)))
      .limit(1);
    if (!(asset?.projectId || asset?.recordId) || !asset.objectKey || !asset.mimeType || !asset.sizeBytes) return null;
    return { ...asset, objectKey: asset.objectKey, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes };
  }

  async markReady(uploadId: string) {
    await getDatabase().update(inspirationAssets).set({ status: "ready", updatedAt: new Date() }).where(eq(inspirationAssets.id, uploadId));
  }
}

type MockUpload = UploadAsset & { kind: "audio" | "image" | "video"; originalName: string };
const songDraftUploadStore = globalThis as typeof globalThis & {
  __songDraftUploads?: Map<string, MockUpload>;
};
const mockUploads = songDraftUploadStore.__songDraftUploads ??= new Map<string, MockUpload>();

export class MockUploadRepository implements UploadRepository {
  async isOwnedProject(projectId: string, ownerId: string) { return Boolean(await getProjectRepository().findOwned(projectId, ownerId)); }
  async isOwnedRecord(recordId: string, ownerId: string) { return Boolean(await getInspirationRepository().findOwned(recordId, ownerId)); }
  async createPending(asset: UploadAsset & { kind: "audio" | "image" | "video"; originalName: string }) { mockUploads.set(asset.id, asset); }
  async findOwned(uploadId: string, ownerId: string) { const asset = mockUploads.get(uploadId); return asset?.ownerId === ownerId ? asset : null; }
  async markReady(uploadId: string) {
    const asset = mockUploads.get(uploadId);
    if (!asset) return;
    asset.status = "ready";
    if (asset.projectId) {
      attachMockAsset({ projectId: asset.projectId, id: asset.id, kind: asset.kind, content: null, included: true, status: "ready", originalName: asset.originalName, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes, objectKey: asset.objectKey });
    }
  }
}

export function getUploadRepository(): UploadRepository { return process.env.DATABASE_URL ? new DrizzleUploadRepository() : new MockUploadRepository(); }

/** Mock：列出某灵感记录下的上传（供 attach 时挂到项目）。 */
export function listMockUploadsForRecord(recordId: string, ownerId: string): MockUpload[] {
  return [...mockUploads.values()].filter((u) => u.recordId === recordId && u.ownerId === ownerId);
}

/** Mock：把 record 作用域的 ready 上传挂到项目 assets（灵感 attach → 制作台回填）。 */
export function linkMockRecordUploadsToProject(recordId: string, projectId: string, ownerId: string) {
  for (const upload of listMockUploadsForRecord(recordId, ownerId)) {
    if (upload.status !== "ready") continue;
    upload.projectId = projectId;
    attachMockAsset({
      projectId,
      id: upload.id,
      kind: upload.kind,
      content: null,
      included: true,
      status: "ready",
      originalName: upload.originalName,
      mimeType: upload.mimeType,
      sizeBytes: upload.sizeBytes,
      objectKey: upload.objectKey,
    });
  }
}
