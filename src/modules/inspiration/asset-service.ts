import { and, eq } from "drizzle-orm";

import { getDatabase } from "@/infrastructure/db/client";
import { getObjectStorage } from "@/infrastructure/storage/factory";
import { inspirationAssets } from "@/infrastructure/db/schema";
import { attachMockAsset, getProjectRepository } from "@/modules/projects/project-repository";
import type { AuthUser } from "@/modules/auth/types";
import { DomainError } from "@/shared/errors/domain-error";

export class AssetService {
  async download(owner: AuthUser, assetId: string) {
    if (!process.env.DATABASE_URL) {
      const project = await this.findMockAsset(owner, assetId);
      if (!project.objectKey || project.status !== "ready") throw new DomainError("NOT_FOUND", 404, "素材不存在");
      return { url: await getObjectStorage().createDownload(project.objectKey, 300), expiresInSeconds: 300 };
    }
    const [asset] = await getDatabase().select({ objectKey: inspirationAssets.objectKey, status: inspirationAssets.status }).from(inspirationAssets).where(and(eq(inspirationAssets.id, assetId), eq(inspirationAssets.ownerId, owner.id))).limit(1);
    if (!asset?.objectKey || asset.status !== "ready") throw new DomainError("NOT_FOUND", 404, "素材不存在");
    return { url: await getObjectStorage().createDownload(asset.objectKey, 300), expiresInSeconds: 300 };
  }

  async softDelete(owner: AuthUser, assetId: string) {
    if (!process.env.DATABASE_URL) {
      const asset = await this.findMockAsset(owner, assetId);
      attachMockAsset({ ...asset, projectId: asset.projectId, status: "deleted" });
      return { id: assetId, status: "deleted" as const };
    }
    const [asset] = await getDatabase().update(inspirationAssets).set({ status: "deleted", included: false, updatedAt: new Date() }).where(and(eq(inspirationAssets.id, assetId), eq(inspirationAssets.ownerId, owner.id))).returning({ id: inspirationAssets.id });
    if (!asset) throw new DomainError("NOT_FOUND", 404, "素材不存在");
    return { id: asset.id, status: "deleted" as const };
  }

  private async findMockAsset(owner: AuthUser, assetId: string) {
    const projects = await getProjectRepository().list(owner.id);
    for (const summary of projects) { const project = await getProjectRepository().findOwned(summary.id, owner.id); const asset = project?.assets.find((item) => item.id === assetId); if (asset) return { ...asset, projectId: summary.id }; }
    throw new DomainError("NOT_FOUND", 404, "素材不存在");
  }
}
