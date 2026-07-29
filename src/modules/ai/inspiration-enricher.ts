/**
 * 灵感补全适配器（问题 4：灵感 AI 补全）。
 *
 * InspirationEnricher 统一契约；真实模式走 DeepSeek chat/completions + JSON Output，
 * 无 Key 或 TEXT_PROVIDER_MODE=mock 时使用确定性 Mock，不冒充外部结果（与 brief-generator 同模式）。
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

/** 从已有输入确定性推断补全（无外部调用）。 */
function mockEnrich(snapshot: InspirationSnapshot): InspirationEnrichment {
  const input = extractFilledInput(snapshot);
  const text = typeof input.text === "string" ? input.text : "";
  const note = typeof input.audioNote === "string" ? input.audioNote : typeof input.imageNote === "string" ? input.imageNote : "";
  const seed = (text || note || input.title || "").toString();

  const title = !snapshot.title.trim() && seed.trim() ? seed.slice(0, 18) : null;

  const moods = snapshot.tags.length === 0 && !(snapshot.text?.moods.length)
    ? deriveMoods(seed)
    : null;

  const speedFeel = snapshot.text?.speedFeel === "unknown" || (snapshot.primaryKind !== "text")
    ? deriveSpeedFeel(seed)
    : null;

  const soundHints = !(snapshot.text?.soundHints.trim())
    ? deriveSoundHints(seed)
    : null;

  const referenceWorks = !(snapshot.text?.referenceWorks.trim())
    ? deriveReferenceWorks(seed)
    : null;

  return { title, moods, speedFeel, soundHints, referenceWorks };
}

function deriveMoods(seed: string): string[] {
  const s = seed.toLowerCase();
  if (/(夜|moon|雨|rain|怀|旧|nostalg)/.test(s)) return ["怀旧", "克制", "迷离"];
  if (/(热|烈|summer|光|亮|dance|舞)/.test(s)) return ["明亮", "热烈", "治愈"];
  if (/(暖|warm|爱|love|家|home)/.test(s)) return ["治愈", "温暖", "明亮"];
  return ["治愈", "克制", "明亮"];
}

function deriveSpeedFeel(seed: string): EnrichSpeedFeel {
  const s = seed.toLowerCase();
  if (/(慢|slow|夜|sleep|静|calm)/.test(s)) return "slow";
  if (/(快|fast|舞|dance|热|烈|run|跑)/.test(s)) return "fast";
  if (seed.trim()) return "medium";
  return "unknown";
}

function deriveSoundHints(seed: string): string {
  if (!seed.trim()) return "";
  const s = seed.toLowerCase();
  if (/(夜|moon|梦|dream)/.test(s)) return "合成 Pad、轻拨吉他、低频贝斯";
  if (/(舞|dance|热|烈|summer)/.test(s)) return "电子鼓机、明亮合成器、律动贝斯";
  return "电钢琴、轻拨弦、温暖合成 Pad";
}

function deriveReferenceWorks(seed: string): string {
  if (!seed.trim()) return "";
  const s = seed.toLowerCase();
  if (/(梦|dream|夜|moon)/.test(s)) return "Dream Pop 风格，参考 Beach House / Cigarettes After Sex";
  if (/(舞|dance|电子|electronic)/.test(s)) return "Synth Pop 风格，参考 The Weeknd / CHVRCHES";
  return "Indie Pop 风格，参考 Clairo / Beabadoobee";
}

export class MockInspirationEnricher implements InspirationEnricher {
  async enrich(snapshot: InspirationSnapshot): Promise<InspirationEnricherResult> {
    return { ...dropUserFilled(snapshot, mockEnrich(snapshot)), mode: "simulated" };
  }
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

/** 按环境变量选择 DeepSeek 或透明 Mock（失败不回退伪装）。 */
export function getInspirationEnricher(): InspirationEnricher {
  return process.env.NODE_ENV !== "test" && process.env.DEEPSEEK_API_KEY && process.env.TEXT_PROVIDER_MODE !== "mock"
    ? new DeepSeekInspirationEnricher()
    : new MockInspirationEnricher();
}
