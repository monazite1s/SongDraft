/**
 * 创意简报生成适配器（docs/SPEC.md §4 创作 Brief；docs/technical-design.md §3、§6）
 *
 * BriefGenerator 统一契约；真实模式走 DeepSeek chat/completions + JSON Output，
 * 无 Key 或 TEXT_PROVIDER_MODE=mock 时使用确定性 Mock，不冒充外部结果。
 */
import "server-only";

import { PROMPT_REGISTRY, buildBriefSystemPrompt, briefZodSchema } from "@/modules/ai/prompts";
import { DomainError } from "@/shared/errors/domain-error";

export interface BriefGenerationInput {
  projectTitle: string;
  description: string | null;
  lyrics: string | null;
}

export interface BriefEvidence {
  source: string;
  detail: string;
}

/**
 * 输出类型（与前端 OutputType 保持一致）。
 * 注意：对外（前端/简报 payload）保持 "melody"；路由层（provider-router）将其映射为
 * canonical "melody_sketch"（见 generation-service）。本字段已不再有遗留命名待办。
 */
export type BriefOutputType = "song" | "soundtrack" | "melody";

export interface BriefPayload {
  theme: string;
  mood: string[];
  genre: string;
  tempo: string;
  instruments: string[];
  lyricSummary: string;
  melodyFeatures: string;
  visualReferences: string;
  evidence: BriefEvidence[];
  conflicts: string[];
  priority: string;
  /** 用户可控的生成参数（AI 生成时给默认值，用户编辑/生成时覆盖）。 */
  outputType: BriefOutputType;
  extraPrompt: string;
  quantity: number;
}

export interface BriefGenerator {
  generate(input: BriefGenerationInput): Promise<BriefPayload>;
}

export class MockBriefGenerator implements BriefGenerator {
  async generate(input: BriefGenerationInput): Promise<BriefPayload> {
    const theme = (input.description?.trim() || input.projectTitle || "未命名灵感").slice(0, 40);
    const lyrics = (input.lyrics ?? "").trim();
    return {
      theme,
      mood: ["温暖", "克制", "释然"],
      genre: "Indie Pop / Dream Pop",
      tempo: "84 BPM · 4/4",
      instruments: ["电钢琴", "合成 Pad", "轻拨弦", "低频贝斯"],
      lyricSummary: lyrics ? `${lyrics.slice(0, 48)}…` : "暂无歌词，建议先在素材区填写后再生成简报。",
      melodyFeatures: "主歌音域较窄、以级进为主；副歌出现一次情绪抬升，句尾保留重复动机。",
      visualReferences: "",
      evidence: lyrics ? [{ source: "歌词", detail: lyrics.slice(0, 30) }] : [],
      conflicts: [],
      priority: "优先保留核心情绪与副歌记忆点，其次匹配风格标签。",
      outputType: "song",
      extraPrompt: "",
      quantity: 3,
    };
  }
}

/** DeepSeek：项目素材 → 结构化创意简报 JSON（Zod 校验）。 */
export class DeepSeekBriefGenerator implements BriefGenerator {
  constructor(
    private readonly apiKey = process.env.DEEPSEEK_API_KEY,
    private readonly baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    private readonly model = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
  ) {}

  async generate(input: BriefGenerationInput): Promise<BriefPayload> {
    if (!this.apiKey) throw new DomainError("PROVIDER_NOT_CONFIGURED", 503, "DeepSeek 尚未配置");
    const { temperature, maxTokens, responseFormat } = PROMPT_REGISTRY.brief.modelParams;
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model: this.model,
        thinking: { type: "disabled" },
        temperature,
        max_tokens: maxTokens,
        response_format: { type: responseFormat },
        messages: [
          { role: "system", content: buildBriefSystemPrompt() },
          { role: "user", content: JSON.stringify({ projectTitle: input.projectTitle, description: input.description, lyrics: input.lyrics }) },
        ],
      }),
    });
    if (!response.ok) throw new DomainError("UPSTREAM_ERROR", 502, response.status === 401 ? "DeepSeek 认证失败" : "简报服务暂时不可用，请稍后重试");
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new DomainError("UPSTREAM_INVALID_RESPONSE", 502, "简报服务返回内容无效");
    let parsed: unknown;
    try { parsed = JSON.parse(content); } catch { throw new DomainError("UPSTREAM_INVALID_RESPONSE", 502, "简报服务返回内容无效"); }
    // schema 由 BRIEF_TAGS 组合（briefZodSchema），消除手写双份维护。
    const validated = briefZodSchema.safeParse(parsed);
    if (!validated.success) throw new DomainError("UPSTREAM_INVALID_RESPONSE", 502, "简报服务返回内容无效");
    return validated.data;
  }
}

/** 按环境变量选择 DeepSeek 或透明 Mock（失败不回退伪装）。 */
export function getBriefGenerator(): BriefGenerator {
  return process.env.NODE_ENV !== "test" && process.env.DEEPSEEK_API_KEY && process.env.TEXT_PROVIDER_MODE !== "mock" ? new DeepSeekBriefGenerator() : new MockBriefGenerator();
}
