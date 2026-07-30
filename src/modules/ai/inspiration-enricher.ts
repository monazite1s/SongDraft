/**
 * 灵感补全适配器（问题 4：灵感 AI 补全）。
 *
 * InspirationEnricher 统一契约；走 DeepSeek chat/completions + JSON Output。
 * 未配置 Key 时抛 PROVIDER_NOT_CONFIGURED，不返回写死数据。
 *
 * 输入灵感 snapshot（用户已填字段），仅补全空缺的结构化字段：
 * moods / speedFeel / soundHints / referenceWorks / title，不覆盖用户已填。
 */
import "server-only";

import { PROMPT_REGISTRY, buildInspirationEnrichSystemPrompt, inspirationEnrichZodSchema } from "@/modules/ai/prompts";
import type { InspirationSnapshot } from "@/modules/inspirations/inspiration-schema";
import { DomainError } from "@/shared/errors/domain-error";

export type EnrichSpeedFeel = "slow" | "medium" | "fast" | "unknown";

/** 补全字段集合：每个字段可选，表示「该字段被 AI 建议了一个值」（仅空缺字段会被补）。 */
export interface InspirationEnrichment {
  title: string | null;
  moods: string[] | null;
  speedFeel: EnrichSpeedFeel | null;
  soundHints: string | null;
  referenceWorks: string | null;
}

export interface InspirationEnricherResult extends InspirationEnrichment {
  /** real=DeepSeek 真实返回；simulated=确定性 Mock。前端据此显示来源标签。 */
  mode: "real" | "simulated";
}

export interface InspirationEnricher {
  enrich(snapshot: InspirationSnapshot): Promise<InspirationEnricherResult>;
}

/** 把 snapshot 中用户已填的非空字段收集成 LLM 可读的输入。 */
function extractFilledInput(snapshot: InspirationSnapshot) {
  const filled: Record<string, unknown> = {};
  if (snapshot.title.trim()) filled.title = snapshot.title;
  if (snapshot.tags.length) filled.tags = snapshot.tags;
  if (snapshot.primaryKind === "text" && snapshot.text) {
    const t = snapshot.text;
    if (t.content.trim()) filled.text = t.content;
    if (t.inspirationType) filled.textType = t.inspirationType;
    if (t.moods.length) filled.moods = t.moods;
    if (t.speedFeel !== "unknown") filled.speedFeel = t.speedFeel;
    if (t.soundHints.trim()) filled.soundHints = t.soundHints;
    if (t.referenceWorks.trim()) filled.referenceWorks = t.referenceWorks;
  }
  if (snapshot.primaryKind === "audio" && snapshot.audio) {
    if (snapshot.audio.note.trim()) filled.audioNote = snapshot.audio.note;
    if (snapshot.audio.items.length) filled.audioLabels = snapshot.audio.items.map((i) => i.label);
  }
  if (snapshot.primaryKind === "image" && snapshot.image) {
    if (snapshot.image.note.trim()) filled.imageNote = snapshot.image.note;
    if (snapshot.image.moods.length) filled.imageMoods = snapshot.image.moods;
  }
  return filled;
}

/** 与 snapshot 对照，剔除用户已填的字段（避免覆盖）。 */
function dropUserFilled(snapshot: InspirationSnapshot, raw: InspirationEnrichment): InspirationEnrichment {
  const result: InspirationEnrichment = { title: null, moods: null, speedFeel: null, soundHints: null, referenceWorks: null };
  const hasTitle = snapshot.title.trim().length > 0;
  const textMoods = snapshot.primaryKind === "text" ? snapshot.text?.moods : undefined;
  const textSpeed = snapshot.primaryKind === "text" ? snapshot.text?.speedFeel : undefined;
  const textHints = snapshot.primaryKind === "text" ? snapshot.text?.soundHints : undefined;
  const textRefs = snapshot.primaryKind === "text" ? snapshot.text?.referenceWorks : undefined;
  const tagsFilled = snapshot.tags.length > 0;

  if (!hasTitle && raw.title) result.title = raw.title;
  // moods：用户在 tags 或 text.moods 已填则不补。
  if (!tagsFilled && !(textMoods && textMoods.length) && raw.moods && raw.moods.length) result.moods = raw.moods;
  if (!(textSpeed && textSpeed !== "unknown") && raw.speedFeel && raw.speedFeel !== "unknown") result.speedFeel = raw.speedFeel;
  if (!(textHints && textHints.trim()) && raw.soundHints && raw.soundHints.trim()) result.soundHints = raw.soundHints;
  if (!(textRefs && textRefs.trim()) && raw.referenceWorks && raw.referenceWorks.trim()) result.referenceWorks = raw.referenceWorks;
  return result;
}

/** DeepSeek：灵感已填字段 → 补全空缺字段 JSON（Zod 校验）。真实失败不冒充成功。 */
export class DeepSeekInspirationEnricher implements InspirationEnricher {
  constructor(
    private readonly apiKey = process.env.DEEPSEEK_API_KEY,
    private readonly baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    private readonly model = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
  ) {}

  async enrich(snapshot: InspirationSnapshot): Promise<InspirationEnricherResult> {
    if (!this.apiKey) throw new DomainError("PROVIDER_NOT_CONFIGURED", 503, "DeepSeek 尚未配置");
    const { temperature, maxTokens, responseFormat } = PROMPT_REGISTRY.inspirationEnrich.modelParams;
    const filled = extractFilledInput(snapshot);
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
          { role: "system", content: buildInspirationEnrichSystemPrompt() },
          { role: "user", content: JSON.stringify({ primaryKind: snapshot.primaryKind, filled }) },
        ],
      }),
    });
    if (!response.ok) throw new DomainError("UPSTREAM_ERROR", 502, response.status === 401 ? "DeepSeek 认证失败" : "灵感补全服务暂时不可用，请稍后重试");
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new DomainError("UPSTREAM_INVALID_RESPONSE", 502, "灵感补全服务返回内容无效");
    let parsed: unknown;
    try { parsed = JSON.parse(content); } catch { throw new DomainError("UPSTREAM_INVALID_RESPONSE", 502, "灵感补全服务返回内容无效"); }
    // schema 由 INSPIRATION_TAGS 组合（inspirationEnrichZodSchema）。
    const validated = inspirationEnrichZodSchema.safeParse(parsed);
    if (!validated.success) throw new DomainError("UPSTREAM_INVALID_RESPONSE", 502, "灵感补全服务返回内容无效");
    const cleaned: InspirationEnrichment = {
      title: validated.data.title,
      moods: validated.data.moods && validated.data.moods.length ? validated.data.moods : null,
      speedFeel: validated.data.speedFeel && validated.data.speedFeel !== "unknown" ? validated.data.speedFeel : null,
      soundHints: validated.data.soundHints && validated.data.soundHints.trim() ? validated.data.soundHints : null,
      referenceWorks: validated.data.referenceWorks && validated.data.referenceWorks.trim() ? validated.data.referenceWorks : null,
    };
    return { ...dropUserFilled(snapshot, cleaned), mode: "real" };
  }
}

/** 文本生成一律走 DeepSeek（未配置 Key 时适配器抛 PROVIDER_NOT_CONFIGURED，不返回写死数据）。 */
export function getInspirationEnricher(): InspirationEnricher {
  return new DeepSeekInspirationEnricher();
}
