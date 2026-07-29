import { expect, test } from "vitest";

import { MockObjectStorage } from "@/infrastructure/storage/mock-storage";
import { MockProjectRepository } from "@/modules/projects/project-repository";
import { ProjectService } from "@/modules/projects/project-service";
import { MockUploadRepository } from "./upload-repository";
import { UploadService } from "./upload-service";
import { AssetService } from "./asset-service";

const owner = { id: "00000000-0000-4000-8000-000000000055", email: "asset@example.test", displayName: "素材测试" };

test("creates a private download URL and soft-deletes an owned mock asset", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const project = await new ProjectService(new MockProjectRepository()).create(owner, { title: "封面", description: "夜色下的站台" });
  const storage = new MockObjectStorage();
  const uploads = new UploadService(new MockUploadRepository(), storage);
  const intent = await uploads.createIntent(owner.id, { projectId: project.id, kind: "image", filename: "cover.png", mimeType: "image/png", sizeBytes: 3 });
  await storage.put(intent.objectKey, "image/png", new Uint8Array([1, 2, 3]));
  await uploads.complete(owner.id, intent.uploadId);
  const service = new AssetService();
  expect((await service.download(owner, intent.uploadId)).url).toContain("/api/uploads/mock?");
  await service.softDelete(owner, intent.uploadId);
  await expect(service.download(owner, intent.uploadId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  if (original) process.env.DATABASE_URL = original;
});
