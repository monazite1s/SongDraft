/**
 * 创意简报生成适配器（docs/SPEC.md §4 创作 Brief；docs/technical-design.md §3、§6）
 *
 * BriefGenerator 统一契约；走 DeepSeek chat/completions + JSON Output。
 * 未配置 Key 时抛 PROVIDER_NOT_CONFIGURED，不返回写死数据。
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
  extraPrompt: string;
  quantity: number;
}

export interface BriefGenerator {
  generate(input: BriefGenerationInput): Promise<BriefPayload>;
}

/** DeepSeek：项目素材 → 结构化创意简报 JSON（Zod 校验）。未配置 Key 抛错，不造假。 */
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

/** 文本生成一律走 DeepSeek（未配置 Key 时适配器抛 PROVIDER_NOT_CONFIGURED，不返回写死数据）。 */
export function getBriefGenerator(): BriefGenerator {
  return new DeepSeekBriefGenerator();
}
