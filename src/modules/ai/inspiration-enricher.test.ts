import { afterEach, expect, test, vi } from "vitest";

import type { InspirationSnapshot } from "@/modules/inspirations/inspiration-schema";
import { DeepSeekInspirationEnricher } from "./inspiration-enricher";

afterEach(() => vi.restoreAllMocks());

function textSnapshot(overrides: Partial<InspirationSnapshot["text"] & { title: string; tags: string[] }> = {}): InspirationSnapshot {
  return {
    primaryKind: "text",
    title: overrides.title ?? "",
    tags: overrides.tags ?? [],
    text: {
      inspirationType: overrides.inspirationType ?? "lyric",
      content: overrides.content ?? "窗外的雨慢慢落下，夜里只剩回忆的灯",
      moods: overrides.moods ?? [],
      speedFeel: overrides.speedFeel ?? "unknown",
      soundHints: overrides.soundHints ?? "",
      referenceWorks: overrides.referenceWorks ?? "",
      advanced: {},
    },
  };
}

test("DeepSeek enricher 解析结构化 JSON 并剔除用户已填字段", async () => {
  const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({
      title: "夜雨",
      moods: ["怀旧", "迷离", "克制"],
      speedFeel: "slow",
      soundHints: "合成 Pad、轻拨吉他",
      referenceWorks: "Beach House / Cigarettes After Sex",
    }) } }],
  }), { status: 200, headers: { "content-type": "application/json" } }));

  const result = await new DeepSeekInspirationEnricher("test-key", "https://example.test", "deepseek-v4-flash").enrich(textSnapshot());
  expect(result.mode).toBe("real");
  expect(result.title).toBe("夜雨");
  expect(result.moods).toEqual(["怀旧", "迷离", "克制"]);
  expect(result.speedFeel).toBe("slow");
  expect(result.soundHints).toBe("合成 Pad、轻拨吉他");

  // 校验请求体含 system prompt + 结构化 user payload。
  const init = request.mock.calls[0]?.[1] as RequestInit;
  const body = JSON.parse(String(init.body)) as { messages: Array<{ role: string; content: string }>; response_format: { type: string } };
  expect(body.response_format).toEqual({ type: "json_object" });
  expect(body.messages[0]!.role).toBe("system");
  expect(body.messages[0]!.content).toContain("灵感录入助手");
});

test("DeepSeek enricher 在上游返回无效 JSON 时抛错（不冒充成功）", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
    choices: [{ message: { content: "not json" } }],
  }), { status: 200, headers: { "content-type": "application/json" } }));

  await expect(
    new DeepSeekInspirationEnricher("test-key", "https://example.test", "deepseek-v4-flash").enrich(textSnapshot()),
  ).rejects.toThrow(/无效/);
});

test("DeepSeek enricher 在缺少 API key 时抛 PROVIDER_NOT_CONFIGURED", async () => {
  await expect(
    new DeepSeekInspirationEnricher(undefined, "https://example.test", "deepseek-v4-flash").enrich(textSnapshot()),
  ).rejects.toThrow(/DeepSeek/);
});
