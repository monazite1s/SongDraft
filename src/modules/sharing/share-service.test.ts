import { expect, test } from "vitest";

import { GenerationService } from "@/modules/generation/generation-service";
import { MockProjectRepository } from "@/modules/projects/project-repository";
import { ProjectService } from "@/modules/projects/project-service";
import { ShareService } from "./share-service";

const owner = { id: "00000000-0000-4000-8000-000000000077", email: "share@example.test", displayName: "分享测试" };

test("creates a private mock link and accepts a guest comment", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const project = await new ProjectService(new MockProjectRepository()).create(owner, { title: "海风", description: "海风吹过旧港口", lyrics: "让海风把我们的歌带给你" });
  const generation = await new GenerationService().generate(owner, { projectId: project.id, lyrics: project.lyrics, creativeContext: { singingMode: "chorus" } });
  const service = new ShareService();
  const link = await service.create(owner, project.id, { versionId: generation.candidates[0]!.versionId, expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
  expect(await service.list(owner, project.id)).toHaveLength(1);
  expect(link.expiresAt).not.toBeNull();
  const comment = await service.comment(link.token, { guestName: "制作人", content: "副歌可以更早进入", atMs: 12000 }, null);
  if (original) process.env.DATABASE_URL = original;
  expect(comment.author).toBe("制作人");
  expect((await service.getPublic(link.token)).comments).toHaveLength(1);
  const ownerComments = await service.listComments(owner, project.id);
  expect(ownerComments).toHaveLength(1);
  await service.markCommentRead(owner, ownerComments[0]!.id);
  expect((await service.listComments(owner, project.id))[0]?.read).toBe(true);
  await service.deleteComment(owner, ownerComments[0]!.id);
  expect(await service.listComments(owner, project.id)).toHaveLength(0);
  await service.revoke(owner, link.id);
  await expect(service.getPublic(link.token)).rejects.toMatchObject({ code: "NOT_FOUND" });
});
