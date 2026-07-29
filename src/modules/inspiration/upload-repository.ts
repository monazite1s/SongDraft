import { and, eq, isNull } from "drizzle-orm";

import { getDatabase } from "@/infrastructure/db/client";
import { inspirationAssets, projects } from "@/infrastructure/db/schema";
import { attachMockAsset, getProjectRepository } from "@/modules/projects/project-repository";

export interface UploadAsset {
  id: string;
  projectId: string;
  ownerId: string;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  status: "pending" | "uploading" | "ready" | "failed" | "deleted";
}

export interface UploadRepository {
  isOwnedProject(projectId: string, ownerId: string): Promise<boolean>;
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

  async createPending(asset: UploadAsset & { kind: "audio" | "image" | "video"; originalName: string }) {
    await getDatabase().insert(inspirationAssets).values({
      id: asset.id,
      projectId: asset.projectId,
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
        ownerId: inspirationAssets.ownerId,
        objectKey: inspirationAssets.objectKey,
        mimeType: inspirationAssets.mimeType,
        sizeBytes: inspirationAssets.sizeBytes,
        status: inspirationAssets.status,
      })
      .from(inspirationAssets)
      .where(and(eq(inspirationAssets.id, uploadId), eq(inspirationAssets.ownerId, ownerId)))
      .limit(1);
    if (!asset?.objectKey || !asset.mimeType || !asset.sizeBytes) return null;
    return { ...asset, objectKey: asset.objectKey, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes };
  }

  async markReady(uploadId: string) {
    await getDatabase().update(inspirationAssets).set({ status: "ready", updatedAt: new Date() }).where(eq(inspirationAssets.id, uploadId));
  }
}

const mockUploads = new Map<string, UploadAsset & { kind: "audio" | "image" | "video"; originalName: string }>();

export class MockUploadRepository implements UploadRepository {
  async isOwnedProject(projectId: string, ownerId: string) { return Boolean(await getProjectRepository().findOwned(projectId, ownerId)); }
  async createPending(asset: UploadAsset & { kind: "audio" | "image" | "video"; originalName: string }) { mockUploads.set(asset.id, asset); }
  async findOwned(uploadId: string, ownerId: string) { const asset = mockUploads.get(uploadId); return asset?.ownerId === ownerId ? asset : null; }
  async markReady(uploadId: string) {
    const asset = mockUploads.get(uploadId);
    if (!asset) return;
    asset.status = "ready";
    attachMockAsset({ projectId: asset.projectId, id: asset.id, kind: asset.kind, content: null, included: true, status: "ready", originalName: asset.originalName, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes, objectKey: asset.objectKey });
  }
}

export function getUploadRepository(): UploadRepository { return process.env.DATABASE_URL ? new DrizzleUploadRepository() : new MockUploadRepository(); }
