import { describe, expect, test } from "vitest";

import { MockObjectStorage } from "@/infrastructure/storage/mock-storage";
import { MockProjectRepository } from "@/modules/projects/project-repository";
import { ProjectService } from "@/modules/projects/project-service";
import { MockUploadRepository, type UploadAsset, type UploadRepository } from "./upload-repository";
import { UploadService } from "./upload-service";

class MemoryUploadRepository implements UploadRepository {
  assets = new Map<string, UploadAsset>();
  async isOwnedProject(_projectId: string, ownerId: string) { return ownerId === "00000000-0000-4000-8000-000000000001"; }
  async isOwnedRecord(_recordId: string, ownerId: string) { return ownerId === "00000000-0000-4000-8000-000000000001"; }
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

  test("persists a ready mock upload onto the project", async () => {
    const owner = { id: ownerId, email: "upload@example.test", displayName: "上传测试" };
    const project = await new ProjectService(new MockProjectRepository()).create(owner, { title: "录音灵感", description: "一段哼唱" });
    const storage = new MockObjectStorage();
    const service = new UploadService(new MockUploadRepository(), storage);
    const intent = await service.createIntent(owner.id, { projectId: project.id, kind: "audio", filename: "humming.webm", mimeType: "audio/webm", sizeBytes: 4 });
    await storage.put(intent.objectKey, "audio/webm", new Uint8Array([1, 2, 3, 4]));
    await service.complete(owner.id, intent.uploadId);
    const loaded = await new ProjectService(new MockProjectRepository()).get(owner.id, project.id);
    expect(loaded.assets.some((asset) => asset.id === intent.uploadId && asset.status === "ready")).toBe(true);
  });
});
