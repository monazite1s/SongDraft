import { afterEach, expect, test, vi } from "vitest";

import { buildVisionBody, GlmVisionAnalyzer } from "./vision-analyzer";

afterEach(() => vi.restoreAllMocks());

test("buildVisionBody: 默认模型 + image_url + text/image 两段 content", () => {
  const body = buildVisionBody("https://cos.example.com/ref.jpg?sign=xxx", { model: "glm-4v-flash" });
  expect(body.model).toBe("glm-4v-flash");
  expect(body.temperature).toBe(0.5);
  const messages = body.messages as Array<{ role: string; content: Array<{ type: string; text?: string; image_url?: { url: string } }> }>;
  expect(messages).toHaveLength(1);
  expect(messages[0]!.role).toBe("user");
  const parts = messages[0]!.content;
  expect(parts.some((p) => p.type === "text" && typeof p.text === "string" && p.text.length > 0)).toBe(true);
  const img = parts.find((p) => p.type === "image_url");
  expect(img?.image_url?.url).toBe("https://cos.example.com/ref.jpg?sign=xxx");
});

test("buildVisionBody: 自定义 instruction 覆盖默认指令", () => {
  const body = buildVisionBody("https://cos.example.com/ref.jpg", { model: "glm-4v-plus", instruction: "只输出色彩" });
  const messages = body.messages as Array<{ content: Array<{ type: string; text?: string }> }>;
  const text = messages[0]!.content.find((p) => p.type === "text")!;
  expect(text.text).toBe("只输出色彩");
});

test("GlmVisionAnalyzer 解析 content 文本并截断到 120 字", async () => {
  const long = "夜色路灯湿润路面反光".repeat(20);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ choices: [{ message: { content: long } }] }), { status: 200, headers: { "content-type": "application/json" } }),
  );
  const text = await new GlmVisionAnalyzer("test-key", "https://example.test", "glm-4v-flash").analyzeImage("https://example.com/a.jpg");
  expect(text.length).toBeLessThanOrEqual(120);
  expect(text).toContain("夜色");
});

test("GlmVisionAnalyzer 缺 key 抛 PROVIDER_NOT_CONFIGURED（不造假）", async () => {
  await expect(
    new GlmVisionAnalyzer(undefined, "https://example.test", "glm-4v-flash").analyzeImage("https://example.com/a.jpg"),
  ).rejects.toThrow(/GLM/);
});
