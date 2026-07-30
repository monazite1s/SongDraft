import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { MOCK_BRIEF_PAYLOAD, mockDeepSeekFetch, setDeepSeekKeyForTest } from "@/modules/ai/__fixtures__/deepseek-mock";
import { GenerationService } from "@/modules/generation/generation-service";
import { BriefService } from "@/modules/projects/brief-service";
import { MockProjectRepository } from "@/modules/projects/project-repository";
import { ProjectService } from "@/modules/projects/project-service";
import { ShareService } from "./share-service";

const owner = { id: "00000000-0000-4000-8000-000000000077", email: "share@example.test", displayName: "分享测试" };

// 简报生成强制走 DeepSeek：测试用 mock fetch 喂回合法简报 JSON。
beforeEach(() => { setDeepSeekKeyForTest(); mockDeepSeekFetch({ brief: MOCK_BRIEF_PAYLOAD }); });
afterEach(() => vi.restoreAllMocks());

test("creates a private mock link and accepts a guest comment", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const project = await new ProjectService(new MockProjectRepository()).create(owner, { title: "海风", description: "海风吹过旧港口", lyrics: "让海风把我们的歌带给你" });
  const brief = await new BriefService().generate(owner, project.id);
  const generation = await new GenerationService().generate(owner, { projectId: project.id, briefId: brief.id, lyrics: project.lyrics });
  // 候选需先保存为正式版本，才能基于该版本创建分享。
  const { saved } = await new GenerationService().saveCandidates(owner, { projectId: project.id, candidateIds: [generation.candidates[0]!.id] });
  const service = new ShareService();
  const link = await service.create(owner, project.id, { versionId: saved[0]!.id, expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
  expect(await service.list(owner, project.id)).toHaveLength(1);
  expect(link.expiresAt).not.toBeNull();
  const comment = await service.comment(link.token, { guestName: "制作人", content: "副歌可以更早进入", atMs: 12000 }, null);
  if (original) process.env.DATABASE_URL = original;
  expect(comment.author).toBe("制作人");
  expect((await service.getPublic(link.token, owner)).comments).toHaveLength(1);
  const ownerComments = await service.listComments(owner, project.id);
  expect(ownerComments).toHaveLength(1);
  await service.markCommentRead(owner, ownerComments[0]!.id);
  expect((await service.listComments(owner, project.id))[0]?.read).toBe(true);
  await service.deleteComment(owner, ownerComments[0]!.id);
  expect(await service.listComments(owner, project.id)).toHaveLength(0);
  await service.revoke(owner, link.id);
  await expect(service.getPublic(link.token, owner)).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("owner posts a time-anchored comment on the song detail page without a share token", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const project = await new ProjectService(new MockProjectRepository()).create(owner, { title: "夜航", description: "夜航灯", lyrics: "夜色里我们出发" });
  const brief = await new BriefService().generate(owner, project.id);
  const generation = await new GenerationService().generate(owner, { projectId: project.id, briefId: brief.id, lyrics: project.lyrics });
  const { saved } = await new GenerationService().saveCandidates(owner, { projectId: project.id, candidateIds: [generation.candidates[0]!.id] });
  const versionId = saved[0]!.id;
  const service = new ShareService();
  const comment = await service.ownerComment(owner, project.id, { versionId, content: "前奏再短一点", atMs: 3200 });
  if (original) process.env.DATABASE_URL = original;
  expect(comment.author).toBe("分享测试");
  expect(comment.atMs).toBe(3200);
  expect(comment.versionId).toBe(versionId);
  expect(comment.read).toBe(true);
  // ownerComment 应在 listComments 中可见（按 versionId 过滤）。
  const listed = (await service.listComments(owner, project.id)).filter((c) => c.versionId === versionId);
  expect(listed).toHaveLength(1);
  expect(listed[0]!.atMs).toBe(3200);
  // 校验失败：空内容 / 无效时间点。
  await expect(service.ownerComment(owner, project.id, { versionId, content: "  ", atMs: 0 })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  await expect(service.ownerComment(owner, project.id, { versionId, content: "ok", atMs: -1 })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
});
