import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { MOCK_BRIEF_PAYLOAD, mockDeepSeekFetch, setDeepSeekKeyForTest } from "@/modules/ai/__fixtures__/deepseek-mock";
import { BriefService } from "@/modules/projects/brief-service";
import { MockProjectRepository } from "@/modules/projects/project-repository";
import { ProjectService } from "@/modules/projects/project-service";
import { GenerationService } from "./generation-service";

const owner = { id: "00000000-0000-4000-8000-000000000078", email: "generation@example.test", displayName: "生成测试" };

// 简报生成强制走 DeepSeek：测试用 mock fetch 喂回合法简报 JSON；音乐仍走 MockMusicGenerator（测试环境）。
beforeEach(() => { setDeepSeekKeyForTest(); mockDeepSeekFetch({ brief: MOCK_BRIEF_PAYLOAD }); });
afterEach(() => vi.restoreAllMocks());

async function seedBrief(ownerId: typeof owner, projectId: string, quantity: number) {
  const briefs = new BriefService();
  const brief = await briefs.generate(ownerId, projectId);
  return briefs.update(ownerId, projectId, brief.id, { ...brief.payload, quantity });
}

/** 生成 → 保存为版本 的便捷组合，返回已保存的版本视图。 */
async function generateAndSave(service: GenerationService, projectId: string, quantity = 1) {
  const brief = await seedBrief(owner, projectId, quantity);
  const result = await service.generate(owner, { projectId, briefId: brief.id, lyrics: "把所有星光唱给你听" });
  const { saved } = await service.saveCandidates(owner, { projectId, candidateIds: result.candidates.map((c) => c.id) });
  return saved;
}

test("generates unsaved candidates from the confirmed brief, then restores and branches git-style", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const project = await new ProjectService(new MockProjectRepository()).create(owner, { title: "五周年", description: "一起走过五年", lyrics: "把所有星光唱给你听" });
  const service = new GenerationService();

  // 生成阶段：依据已确认简报（quantity=1）产出未保存候选。
  const brief = await seedBrief(owner, project.id, 1);
  const result = await service.generate(owner, { projectId: project.id, briefId: brief.id, lyrics: project.lyrics });
  expect(result.status).toBe("completed");
  expect(result.candidates).toHaveLength(1);
  expect(result.candidates[0]!.savedVersionId).toBeNull();
  expect(await service.listVersions(owner, project.id)).toHaveLength(0);

  // 保存阶段：将选中候选转为正式版本 v1（主）。
  const { saved } = await service.saveCandidates(owner, { projectId: project.id, candidateIds: [result.candidates[0]!.id] });
  expect(saved).toHaveLength(1);
  expect(saved[0]!.isMain).toBe(true);

  // 再保存 v2：保存时 parentId = 当时主版本 v1，v2 自动成为新主。
  const second = await service.generate(owner, { projectId: project.id, briefId: brief.id, lyrics: project.lyrics });
  const { saved: savedV2 } = await service.saveCandidates(owner, { projectId: project.id, candidateIds: second.candidates.map((c) => c.id) });
  expect((await service.listVersions(owner, project.id)).find((v) => v.id === savedV2[0]!.id)!.parentId).toBe(saved[0]!.id);

  // 应用历史版本 v1（git checkout）：HEAD 从 v2 移回 v1，不新建版本（无游离节点），歌词写回草稿。
  const beforeCount = (await service.listVersions(owner, project.id)).length;
  const restored = await service.restore(owner, project.id, saved[0]!.id);
  const after = await service.listVersions(owner, project.id);
  expect(after).toHaveLength(beforeCount);
  expect(restored.id).toBe(saved[0]!.id);
  expect(restored.isMain).toBe(true);
  expect(restored.lyrics).toBe(project.lyrics);
  expect(after.find((v) => v.id === saved[0]!.id)!.isMain).toBe(true);
  expect(after.find((v) => v.id === savedV2[0]!.id)!.isMain).toBe(false);

  // 在 v1（HEAD）上保存新版本 → 从 v1 分叉（parentId=v1），与 v2 同级（兄弟节点），不挂在 v2 下。
  const branch = await service.generate(owner, { projectId: project.id, briefId: brief.id, lyrics: project.lyrics });
  const { saved: savedBranch } = await service.saveCandidates(owner, { projectId: project.id, candidateIds: branch.candidates.map((c) => c.id) });
  const finalViews = await service.listVersions(owner, project.id);
  expect(finalViews.find((v) => v.id === savedBranch[0]!.id)!.parentId).toBe(saved[0]!.id);
  expect(finalViews.filter((v) => v.parentId === saved[0]!.id).map((v) => v.id).sort()).toEqual([savedBranch[0]!.id, savedV2[0]!.id].sort());

  // 标签与歌曲 versionNo 一致：v1 / v2 / v3（分叉不另造 v2.1，避免与详情页 V{n} 对不上）。
  expect(finalViews.find((v) => v.id === saved[0]!.id)!.label).toBe("v1");
  expect(finalViews.find((v) => v.id === savedV2[0]!.id)!.label).toBe("v2");
  expect(finalViews.find((v) => v.id === savedBranch[0]!.id)!.label).toBe("v3");
  expect(finalViews.find((v) => v.id === savedBranch[0]!.id)!.versionNo).toBe(3);

  if (original) process.env.DATABASE_URL = original;
});

test("rejects saving candidates that belong to another owner", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const project = await new ProjectService(new MockProjectRepository()).create(owner, { title: "权限", description: "隔离", lyrics: "只属于我" });
  const brief = await seedBrief(owner, project.id, 1);
  const service = new GenerationService();
  const result = await service.generate(owner, { projectId: project.id, briefId: brief.id, lyrics: project.lyrics });
  const intruder = { id: "00000000-0000-4000-8000-000000000099", email: "intruder@example.test", displayName: "入侵者" };
  await expect(service.saveCandidates(intruder, { projectId: project.id, candidateIds: [result.candidates[0]!.id] })).rejects.toMatchObject({ code: "NOT_FOUND" });
  if (original) process.env.DATABASE_URL = original;
});

test("delete removes a non-main version without disturbing the main version", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const project = await new ProjectService(new MockProjectRepository()).create(owner, { title: "删除非主", description: "保留主版本", lyrics: "保留主版本" });
  const service = new GenerationService();
  // 第一批：v1（主），v2 是第二批的主
  const first = await generateAndSave(service, project.id, 1);
  await generateAndSave(service, project.id, 1);
  const versions = await service.listVersions(owner, project.id);
  expect(versions).toHaveLength(2);
  const mainBefore = versions.find((v) => v.isMain)!.id;

  // 删除较早的非主版本（first[0] 此时不再是主）。
  await service.delete(owner, project.id, first[0]!.id);
  const after = await service.listVersions(owner, project.id);
  expect(after).toHaveLength(1);
  expect(after.every((v) => v.id !== first[0]!.id)).toBe(true);
  expect(after.find((v) => v.isMain)!.id).toBe(mainBefore);
  if (original) process.env.DATABASE_URL = original;
});

test("delete the main version promotes the highest versionNo to be the new main", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const project = await new ProjectService(new MockProjectRepository()).create(owner, { title: "删除主版本", description: "自动迁移", lyrics: "自动迁移主" });
  const service = new GenerationService();
  await generateAndSave(service, project.id, 1); // v1
  await generateAndSave(service, project.id, 1); // v2（保存后成为主）
  const versions = await service.listVersions(owner, project.id);
  const currentMain = versions.find((v) => v.isMain)!.id;

  await service.delete(owner, project.id, currentMain);
  const after = await service.listVersions(owner, project.id);
  expect(after).toHaveLength(1);
  expect(after.filter((v) => v.isMain)).toHaveLength(1);
  // 迁移到的新主版本应是剩余版本中 versionNo 最大者。
  expect(after.find((v) => v.isMain)!.versionNo).toBe(Math.max(...after.map((v) => v.versionNo)));
  if (original) process.env.DATABASE_URL = original;
});

test("delete re-parents child versions to the deleted version's parent, keeping the tree connected", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const project = await new ProjectService(new MockProjectRepository()).create(owner, { title: "父子修正", description: "连通", lyrics: "保持连通" });
  const service = new GenerationService();
  // v1（根，无 parent）→ 保存第二批时 v2.parentId = v1。
  const first = await generateAndSave(service, project.id, 1);
  const second = await generateAndSave(service, project.id, 1);
  const v1 = first[0]!;
  const v2 = second[0]!;
  let versions = await service.listVersions(owner, project.id);
  expect(versions.find((v) => v.id === v2.id)!.parentId).toBe(v1.id);

  // 删除中间节点 v2（此时 v2 是主）：它没有子节点，但验证删除根的连通性。
  // 改为构建 v1→v2→v3 链，删 v2 后 v3.parentId 应上移到 v1。
  const third = await generateAndSave(service, project.id, 1);
  const v3 = third[0]!.id;
  versions = await service.listVersions(owner, project.id);
  expect(versions.find((v) => v.id === v3)!.parentId).toBe(v2.id);

  await service.delete(owner, project.id, v2.id);
  const after = await service.listVersions(owner, project.id);
  // v3 的 parent 应从 v2 上移到 v1。
  expect(after.find((v) => v.id === v3)!.parentId).toBe(v1.id);
  expect(after.every((v) => v.id !== v2.id)).toBe(true);
  if (original) process.env.DATABASE_URL = original;
});

test("delete is isolated per owner and rejects versions belonging to another owner", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const project = await new ProjectService(new MockProjectRepository()).create(owner, { title: "隔离", description: "跨用户", lyrics: "跨用户隔离" });
  const service = new GenerationService();
  const saved = await generateAndSave(service, project.id, 1);

  const intruder = { id: "00000000-0000-4000-8000-000000000099", email: "intruder@example.test", displayName: "入侵者" };
  await expect(service.delete(intruder, project.id, saved[0]!.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  // owner 仍可正常列出该版本（未被误删）。
  expect(await service.listVersions(owner, project.id)).toHaveLength(1);
  if (original) process.env.DATABASE_URL = original;
});
