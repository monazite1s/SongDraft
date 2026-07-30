/**
 * 视觉理解适配器（图生文）：参考图片 → 音乐相关文字描述（docs/SPEC.md 三模态创作）
 *
 * 真实模式走智谱 GLM-4V（OpenAI 兼容）：
 *   POST https://open.bigmodel.cn/api/paas/v4/chat/completions，image_url 传公网 HTTPS 直链。
 * 输出 ≤120 字的「场景/情绪/色彩/氛围/建议乐器风格」描述，由 generation-service 注入音乐 prompt
 * 的「视觉意象」槽，使 文本歌词 + 音频哼唱 + 图像意象 三模态在同一生成调用里共同参与创作。
 * 无 Key 或 VISION_PROVIDER_MODE=mock 时使用确定性 Mock，不冒充外部结果。
 */
import "server-only";

import { DomainError } from "@/shared/errors/domain-error";

export interface VisionAnalyzer {
  analyzeImage(imageUrl: string): Promise<string>;
}

const VISION_INSTRUCTION =
  "你是音乐创作顾问。请用中文输出一段 80 字以内的音乐创作参考，涵盖：画面场景、情绪基调、主色彩与氛围、以及建议的乐器和音乐风格。只输出描述本身，不要编号、不要解释、不要寒暄。";

/**
 * 构造 GLM-4V /chat/completions 请求体（纯函数，便于单测，不触网）。
 */
export function buildVisionBody(
  imageUrl: string,
  opts: { model: string; instruction?: string },
): Record<string, unknown> {
  return {
    model: opts.model,
    temperature: 0.5,
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: opts.instruction ?? VISION_INSTRUCTION },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
  };
}

/** 把 GLM 返回的 content（可能是 string 或多段数组）规整为纯文本。 */
function normalizeContent(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw)) {
    return raw
      .map((part) => (part && typeof part === "object" && "text" in part ? String((part as { text?: unknown }).text ?? "") : ""))
      .join("")
      .trim();
  }
  return "";
}

export class MockVisionAnalyzer implements VisionAnalyzer {
  async analyzeImage(_imageUrl: string): Promise<string> {
    return "暖色调夜景、湿润路面反光，画面安静克制；建议轻拨弦与合成 Pad，氛围偏 Dream Pop。";
  }
}

/** GLM-4V：参考图片 HTTPS 直链 → 音乐意象文字描述。 */
export class GlmVisionAnalyzer implements VisionAnalyzer {
  constructor(
    private readonly apiKey = process.env.ZHIPU_API_KEY,
    private readonly baseUrl = process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
    private readonly model = process.env.GLM_VISION_MODEL ?? "glm-4v-flash",
  ) {}

  async analyzeImage(imageUrl: string): Promise<string> {
    if (!this.apiKey) throw new DomainError("PROVIDER_NOT_CONFIGURED", 503, "GLM 视觉模型尚未配置");
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify(buildVisionBody(imageUrl, { model: this.model })),
    });
    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      console.error("[vision] GLM HTTP", response.status, raw.slice(0, 300));
      throw new DomainError("UPSTREAM_ERROR", 502, response.status === 401 ? "GLM 认证失败" : "视觉理解服务暂时不可用");
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
      error?: { message?: string };
    };
    // 透传 GLM 真实错误（吸取 MiniMax 教训：不吞 status_msg）。
    if (payload.error?.message) {
      console.error("[vision] GLM error", payload.error.message);
      throw new DomainError("UPSTREAM_INVALID_RESPONSE", 502, `视觉理解失败：${payload.error.message}`);
    }
    const content = normalizeContent(payload.choices?.[0]?.message?.content);
    if (!content) {
      console.error("[vision] GLM 无 content raw=", JSON.stringify(payload).slice(0, 300));
      throw new DomainError("UPSTREAM_INVALID_RESPONSE", 502, "视觉理解服务未返回内容");
    }
    return content.slice(0, 120);
  }
}

/** 按环境变量选择 GLM-4V 或透明 Mock（失败由调用方 catch 回退，不冒充成功）。 */
export function getVisionAnalyzer(): VisionAnalyzer {
  return process.env.NODE_ENV !== "test" && process.env.ZHIPU_API_KEY && process.env.VISION_PROVIDER_MODE !== "mock"
    ? new GlmVisionAnalyzer()
    : new MockVisionAnalyzer();
}
