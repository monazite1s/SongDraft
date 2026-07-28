import { and, eq } from "drizzle-orm";

import { getDatabase } from "@/infrastructure/db/client";
import { inspirationAssets, projects } from "@/infrastructure/db/schema";

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
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId), eq(projects.status, "draft")))
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
