import { describe, expect, test } from "vitest";

import { MockObjectStorage } from "@/infrastructure/storage/mock-storage";
import type { UploadAsset, UploadRepository } from "./upload-repository";
import { UploadService } from "./upload-service";

class MemoryUploadRepository implements UploadRepository {
  assets = new Map<string, UploadAsset>();
  async isOwnedProject(_projectId: string, ownerId: string) { return ownerId === "00000000-0000-4000-8000-000000000001"; }
  async createPending(asset: UploadAsset) { this.assets.set(asset.id, asset); }
  async findOwned(uploadId: string, ownerId: string) { const asset = this.assets.get(uploadId); return asset?.ownerId === ownerId ? asset : null; }
  async markReady(uploadId: string) { const asset = this.assets.get(uploadId); if (asset) asset.status = "ready"; }
}

const ownerId = "00000000-0000-4000-8000-000000000001";
const projectId = "00000000-0000-4000-8000-000000000002";

describe("UploadService", () => {
  test("creates an owner-isolated signed audio upload", async () => {
    const repository = new MemoryUploadRepository();
    const service = new UploadService(repository, new MockObjectStorage());
    const result = await service.createIntent(ownerId, { projectId, kind: "audio", filename: "idea.webm", mimeType: "audio/webm", sizeBytes: 1024 });
    expect(result.objectKey).toContain(`/users/${ownerId}/projects/${projectId}/audio/`);
    expect(result.method).toBe("PUT");
    expect(repository.assets.get(result.uploadId)?.status).toBe("uploading");
  });

  test("rejects an invalid audio MIME type", async () => {
    const service = new UploadService(new MemoryUploadRepository(), new MockObjectStorage());
    await expect(service.createIntent(ownerId, { projectId, kind: "audio", filename: "idea.webm", mimeType: "application/javascript", sizeBytes: 1024 })).rejects.toThrow();
  });

  test("refuses an upload for another owner's project", async () => {
    const service = new UploadService(new MemoryUploadRepository(), new MockObjectStorage());
    await expect(service.createIntent("00000000-0000-4000-8000-000000000009", { projectId, kind: "image", filename: "cover.png", mimeType: "image/png", sizeBytes: 1024 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
