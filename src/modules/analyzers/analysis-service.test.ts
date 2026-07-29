import { expect, test } from "vitest";

import { MockProjectRepository } from "@/modules/projects/project-repository";
import { ProjectService } from "@/modules/projects/project-service";
import { AnalysisService } from "./analysis-service";

const owner = { id: "00000000-0000-4000-8000-000000000066", email: "analysis@example.test", displayName: "分析测试" };

test("creates a transparent text analysis for an owned project", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const project = await new ProjectService(new MockProjectRepository()).create(owner, { title: "旧车站", description: "雨后旧车站的告别" });
  const results = await new AnalysisService().analyze(owner, project.id);
  if (original) process.env.DATABASE_URL = original;
  expect(results).toHaveLength(1);
  expect(results[0]?.analyzer).toBe("text");
  expect(results[0]?.executionKind).toBe("simulated");
});
