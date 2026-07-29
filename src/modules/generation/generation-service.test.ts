import { expect, test } from "vitest";

import { MockProjectRepository } from "@/modules/projects/project-repository";
import { ProjectService } from "@/modules/projects/project-service";
import { GenerationService } from "./generation-service";

const owner = { id: "00000000-0000-4000-8000-000000000078", email: "generation@example.test", displayName: "生成测试" };

test("creates two transparent mock candidates for an owned project", async () => {
  const projects = new ProjectService(new MockProjectRepository());
  const project = await projects.create(owner, { title: "夜车", description: "夜车穿过雨后的城市" });
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const result = await new GenerationService().generate(owner, { projectId: project.id, brief: { theme: "夜车", mood: "释然", genre: "流行", tempo: "92 BPM" } });
  if (original) process.env.DATABASE_URL = original;
  expect(result.status).toBe("completed");
  expect(result.candidates).toHaveLength(2);
  expect(result.candidates.every((candidate) => candidate.hasAudio === false)).toBe(true);
  await new GenerationService().setMain(owner, project.id, result.candidates[1]!.versionId);
  const versions = await new GenerationService().listVersions(owner, project.id);
  expect(versions.find((version) => version.id === result.candidates[1]!.versionId)?.isMain).toBe(true);
});
