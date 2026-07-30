/**
 * 测试专用：mock DeepSeek /chat/completions。
 *
 * 删除文本生成 Mock 类后，服务级测试（BriefService / GenerationService / ShareService 等）
 * 触发真实 DeepSeek 适配器，需要用 mock fetch 喂回合法 JSON 响应。本 helper 按 system prompt
 * 关键字（简报 / 灵感 / 歌词）路由回放对应 payload，避免每个测试重复手写 fetch mock。
 *
 * 仅用于测试，不进生产路径。
 */
import { vi } from "vitest";

type Json = Record<string, unknown>;

interface DeepSeekMockPayloads {
  /** 简报（buildBriefSystemPrompt，含「简报」）。 */
  brief?: Json;
  /** 灵感补全（buildInspirationEnrichSystemPrompt，含「灵感录入助手」）。 */
  enrich?: Json;
  /** 歌词/对话（buildLyricSystemPrompt，含「歌词」）。 */
  lyrics?: Json;
  /** 兜底 payload（无匹配时）。 */
  fallback?: Json;
}

/**
 * 拦截全局 fetch，把 DeepSeek chat 请求按 system prompt 路由到对应 payload。
 * @returns restore 函数（还原 fetch）。
 */
export function mockDeepSeekFetch(payloads: DeepSeekMockPayloads): () => void {
  const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input: unknown, init?: RequestInit) => {
    let body: { messages?: Array<{ content?: unknown }> } = {};
    try {
      body = JSON.parse(String(init?.body ?? "{}")) as typeof body;
    } catch {
      // 非 JSON body：兜底。
    }
    const sys = String(body.messages?.[0]?.content ?? "");
    let payload: Json | undefined;
    if (sys.includes("简报")) payload = payloads.brief;
    else if (sys.includes("灵感录入助手")) payload = payloads.enrich;
    else if (sys.includes("歌词")) payload = payloads.lyrics;
    payload = payload ?? payloads.fallback ?? { ok: true };
    return new Response(
      JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });
  return () => spy.mockRestore();
}

/** 测试中默认设置一个占位 DEEPSEEK_API_KEY，使真实适配器不致因缺 key 提前抛错。 */
export function setDeepSeekKeyForTest(value = "test-key"): void {
  process.env.DEEPSEEK_API_KEY = value;
}

/** 合法简报 payload（满足 briefZodSchema），供服务级测试 mock DeepSeek 回放。 */
export const MOCK_BRIEF_PAYLOAD: Json = {
  theme: "雨夜街角",
  mood: ["克制", "释然"],
  genre: "Indie Pop",
  tempo: "84 BPM · 4/4",
  instruments: ["电钢琴", "合成 Pad"],
  lyricSummary: "路灯把影子拉得很长，夜色里独自漫步",
  melodyFeatures: "主歌级进为主，副歌一次情绪抬升",
  visualReferences: "",
  evidence: [{ source: "歌词", detail: "路灯把影子拉得很长" }],
  conflicts: [],
  priority: "优先保留核心情绪与副歌记忆点",
  extraPrompt: "",
  quantity: 3,
};
