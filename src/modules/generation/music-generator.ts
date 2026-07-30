/**
 * 音乐生成适配器（docs/technical-design.md §4、§6）
 *
 * MusicGenerator 统一契约；真实模式 POST https://api.minimaxi.com/v1/music_generation
 * - 无参考音频 → `music-2.6`：纯文本（prompt + lyrics）生成。
 * - 有参考音频（哼唱/翻唱素材）→ `music-cover`：把参考音频作为 `audio_url`，
 *   风格作为 `prompt`、（可选）歌词作为 `lyrics` 一并传入——「文本 + 音频」双通道生成。
 *   响应体与 music-2.6 一致；无 Key 时透明 Mock。
 *
 * 已知限制：MiniMax 参考音频要求 mp3/wav/flac 等常见格式（6s–6min、≤50MB）。
 * 浏览器录制产出 audio/webm;codecs=opus 可能被拒收，建议 cover 路径上传 mp3/wav/m4a。
 */
import "server-only";

import { DomainError } from "@/shared/errors/domain-error";
import type { ExecutionKind } from "@/shared/contracts/domain";

export interface MusicGenerationInput {
  projectId: string;
  lyrics: string;
  prompt: string;
  creativeContext: Record<string, unknown>;
  hummingAssetId?: string | null;
  /** 参考音频的可拉取 HTTPS 直链（COS 预签名 URL）；存在时走 music-cover 双通道。 */
  referenceAudioUrl?: string | null;
}

export interface GeneratedDemo {
  audioUrl: string | null;
  durationMs: number;
  executionKind: ExecutionKind;
  providerLabel: string;
}

export interface MusicGenerator { create(input: MusicGenerationInput): Promise<GeneratedDemo>; }

export class MockMusicGenerator implements MusicGenerator {
  async create(): Promise<GeneratedDemo> { return { audioUrl: null, durationMs: 12_000, executionKind: "simulated", providerLabel: "SongDraft Mock" }; }
}

const AUDIO_SETTING = { sample_rate: 44_100, bitrate: 256_000, format: "mp3" } as const;

/** cover 风格 prompt 兜底：保证满足 music-cover 的必填下限 [10, 300] 字。 */
const COVER_STYLE_FALLBACK = "参考音频生成翻唱版本";

/**
 * 构造 MiniMax /v1/music_generation 请求体（纯函数，便于单测，不触网）。
 * - 有 referenceAudioUrl → music-cover：prompt clamp 到 [10,300]；lyrics 仅当 ≥10 字才带（否则省略，由 MiniMax ASR 从参考音频提取）。
 * - 否则 → music-2.6：prompt ≤2000、lyrics ≤3500（保持历史行为）。
 */
export function buildMusicRequestBody(
  input: Pick<MusicGenerationInput, "prompt" | "lyrics" | "referenceAudioUrl">,
  opts: { coverModel: string; textModel: string },
): { model: string; body: Record<string, unknown> } {
  if (input.referenceAudioUrl) {
    let prompt = input.prompt.trim().slice(0, 300);
    if (prompt.length < 10) prompt = `${prompt}${COVER_STYLE_FALLBACK}`.slice(0, 300);
    const body: Record<string, unknown> = {
      model: opts.coverModel,
      prompt,
      audio_url: input.referenceAudioUrl,
      audio_setting: AUDIO_SETTING,
      output_format: "url",
    };
    if (input.lyrics.trim().length >= 10) body.lyrics = input.lyrics.slice(0, 1000);
    return { model: opts.coverModel, body };
  }
  return {
    model: opts.textModel,
    body: {
      model: opts.textModel,
      prompt: input.prompt.slice(0, 2_000),
      lyrics: input.lyrics.slice(0, 3_500),
      audio_setting: AUDIO_SETTING,
      output_format: "url",
    },
  };
}

/** MiniMax Music：歌词 + 风格 prompt（可选参考音频）→ HTTPS 临时音频 URL（后续转存 COS）。 */
export class MiniMaxMusicGenerator implements MusicGenerator {
  constructor(
    private readonly apiKey = process.env.MINIMAX_API_KEY,
    private readonly baseUrl = process.env.MINIMAX_BASE_URL ?? "https://api.minimaxi.com",
    private readonly model = process.env.MINIMAX_MUSIC_MODEL ?? "music-2.6",
    // Token Plan（付费）账号不支持 *-free 模型（实测 2061），默认用付费 music-cover；
    // 免费账号可在 env 设 music-cover-free。
    private readonly coverModel = process.env.MINIMAX_MUSIC_COVER_MODEL ?? "music-cover",
  ) {}

  async create(input: MusicGenerationInput): Promise<GeneratedDemo> {
    if (!this.apiKey) throw new DomainError("PROVIDER_NOT_CONFIGURED", 503, "MiniMax 尚未配置");
    const { model, body } = buildMusicRequestBody(input, { coverModel: this.coverModel, textModel: this.model });
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/v1/music_generation`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      signal: AbortSignal.timeout(180_000),
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new DomainError("UPSTREAM_ERROR", 502, response.status === 401 ? "MiniMax 认证失败" : "音乐生成服务暂时不可用，请稍后重试");
    // MiniMax 错误响应通常只含 base_resp（无 data）；成功响应才带 data.audio。逐层判定，原样透出真实原因。
    const raw = (await response.json()) as {
      base_resp?: { status_code?: number; status_msg?: string };
      data?: { audio?: string; status?: number };
      extra_info?: { music_duration?: number };
    };
    const base = raw.base_resp;
    if (!base || typeof base.status_code !== "number") {
      console.error("[minimax] 响应缺少 base_resp model=", model, "raw=", JSON.stringify(raw).slice(0, 800));
      throw new DomainError("UPSTREAM_INVALID_RESPONSE", 502, `音乐生成服务返回内容无效：${JSON.stringify(raw).slice(0, 200)}`);
    }
    if (base.status_code !== 0) {
      const msg = base.status_msg?.trim() || `status_code=${base.status_code}`;
      console.error(`[minimax] 生成失败 model=${model} status_code=${base.status_code} msg=${msg}`);
      throw new DomainError("UPSTREAM_INVALID_RESPONSE", 502, `音乐生成失败(${base.status_code})：${msg}`);
    }
    const audio = raw.data?.audio;
    if (typeof audio !== "string" || audio.length === 0) {
      // status_code=0 但无 audio：可能为异步任务（返回 task_id 需轮询）。携带原始片段便于定位。
      console.error("[minimax] status_code=0 但无 audio model=", model, "raw=", JSON.stringify(raw).slice(0, 800));
      throw new DomainError("UPSTREAM_INVALID_RESPONSE", 502, `音乐生成服务未返回音频（可能为异步任务）：${JSON.stringify(raw).slice(0, 200)}`);
    }
    let audioUrl: URL;
    try { audioUrl = new URL(audio); } catch { throw new DomainError("UPSTREAM_INVALID_RESPONSE", 502, "音乐生成服务未返回可播放音频"); }
    if (audioUrl.protocol !== "https:") throw new DomainError("UPSTREAM_INVALID_RESPONSE", 502, "音乐生成服务未返回安全音频地址");
    return { audioUrl: audioUrl.toString(), durationMs: raw.extra_info?.music_duration ?? 30_000, executionKind: "real_external", providerLabel: `MiniMax ${model}` };
  }
}

export function getMusicGenerator(): MusicGenerator {
  // 配置 MINIMAX_API_KEY 且 MUSIC_PROVIDER_MODE=minimax 时调用官方 API；未配置时使用本地回退，不冒充外部模型结果。
  return process.env.NODE_ENV !== "test" && process.env.MINIMAX_API_KEY && process.env.MUSIC_PROVIDER_MODE !== "mock" ? new MiniMaxMusicGenerator() : new MockMusicGenerator();
}
