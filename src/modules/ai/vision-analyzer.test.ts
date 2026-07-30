import { expect, test } from "vitest";

import { buildVisionBody, MockVisionAnalyzer } from "./vision-analyzer";

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

test("MockVisionAnalyzer 返回非空描述（不冒充外部结果，仅占位）", async () => {
  const text = await new MockVisionAnalyzer().analyzeImage("https://example.com/x.jpg");
  expect(typeof text).toBe("string");
  expect(text.length).toBeGreaterThan(0);
});
