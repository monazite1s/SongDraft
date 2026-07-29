import { expect, test } from "vitest";

import { BriefService } from "@/modules/projects/brief-service";
import { MockProjectRepository } from "@/modules/projects/project-repository";
import { ProjectService } from "@/modules/projects/project-service";
import { GenerationService } from "./generation-service";

const owner = { id: "00000000-0000-4000-8000-000000000078", email: "generation@example.test", displayName: "生成测试" };

async function seedBrief(ownerId: typeof owner, projectId: string, quantity: number) {
  const briefs = new BriefService();
  const brief = await briefs.generate(ownerId, projectId);
  return briefs.update(ownerId, projectId, brief.id, { ...brief.payload, quantity });
}

test("generates unsaved candidates from the confirmed brief, then saves the picked one as a linear version", async () => {
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

  // 保存阶段：将选中候选转为正式版本。
  const { saved } = await service.saveCandidates(owner, { projectId: project.id, candidateIds: [result.candidates[0]!.id] });
  expect(saved).toHaveLength(1);
  expect(saved[0]!.isMain).toBe(true);

  // 恢复阶段：从历史版本复制为新的线性版本。
  const restored = await service.restore(owner, project.id, saved[0]!.id);
  expect(restored.versionNo).toBe(2);
  expect(restored.restoredFromVersionId).toBe(saved[0]!.id);

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
