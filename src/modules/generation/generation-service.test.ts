import { expect, test } from "vitest";

import { MockProjectRepository } from "@/modules/projects/project-repository";
import { ProjectService } from "@/modules/projects/project-service";
import { GenerationService } from "./generation-service";

const owner = { id: "00000000-0000-4000-8000-000000000078", email: "generation@example.test", displayName: "生成测试" };

test("creates one transparent mock candidate and restores as a new linear version", async () => {
  const projects = new ProjectService(new MockProjectRepository());
  const project = await projects.create(owner, { title: "五周年", description: "一起走过五年", lyrics: "把所有星光唱给你听" });
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const result = await new GenerationService().generate(owner, { projectId: project.id, lyrics: project.lyrics, creativeContext: { singingMode: "chorus" } });
  if (original) process.env.DATABASE_URL = original;
  expect(result.status).toBe("completed");
  expect(result.candidates).toHaveLength(1);
  expect(result.candidates.every((candidate) => candidate.hasAudio === false)).toBe(true);
  const restored = await new GenerationService().restore(owner, project.id, result.candidates[0]!.versionId);
  const versions = await new GenerationService().listVersions(owner, project.id);
  expect(restored.versionNo).toBe(2);
  expect(restored.restoredFromVersionId).toBe(result.candidates[0]!.versionId);
  expect(versions.find((version) => version.id === restored.id)?.isMain).toBe(true);
});
