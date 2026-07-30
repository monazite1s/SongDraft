import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { setDeepSeekKeyForTest } from "@/modules/ai/__fixtures__/deepseek-mock";
import { MockProjectRepository } from "@/modules/projects/project-repository";
import { ProjectService } from "@/modules/projects/project-service";
import { AnalysisService } from "./analysis-service";

const owner = { id: "00000000-0000-4000-8000-000000000066", email: "analysis@example.test", displayName: "分析测试" };

// 文本分析走 DeepSeek（plain text 摘要，非 JSON）：直接 mock fetch 返回文本内容。
beforeEach(() => {
  setDeepSeekKeyForTest();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ choices: [{ message: { content: "雨后旧车站的告别，适合克制温暖的民谣氛围" } }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
});
afterEach(() => vi.restoreAllMocks());

test("creates a DeepSeek-backed text analysis for an owned project", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const project = await new ProjectService(new MockProjectRepository()).create(owner, { title: "旧车站", description: "雨后旧车站的告别" });
  const results = await new AnalysisService().analyze(owner, project.id);
  if (original) process.env.DATABASE_URL = original;
  expect(results).toHaveLength(1);
  expect(results[0]?.analyzer).toBe("text");
  expect(results[0]?.executionKind).toBe("real_external");
  expect(results[0]?.summary).toContain("雨后");
});
