/**
 * 音乐生成适配器（docs/technical-design.md §4、§6）
 *
 * MusicGenerator 统一契约；真实模式 POST https://api.minimaxi.com/v1/music_generation
 *（默认 music-2.6，output_format=url，仅接受 HTTPS 音频）；无 Key 时透明 Mock。
 */
import "server-only";

import { z } from "zod";

import { DomainError } from "@/shared/errors/domain-error";
import type { ExecutionKind } from "@/shared/contracts/domain";

export interface MusicGenerationInput {
  projectId: string;
  lyrics: string;
  prompt: string;
  creativeContext: Record<string, unknown>;
  hummingAssetId?: string | null;
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

const miniMaxResponseSchema = z.object({
  data: z.object({ audio: z.string().min(1), status: z.number().optional() }),
  extra_info: z.object({ music_duration: z.number().positive().optional() }).optional(),
  base_resp: z.object({ status_code: z.number(), status_msg: z.string().optional() }),
});

/** MiniMax Music：歌词 + 风格 prompt → HTTPS 临时音频 URL（后续应转存 COS）。 */
export class MiniMaxMusicGenerator implements MusicGenerator {
  constructor(
    private readonly apiKey = process.env.MINIMAX_API_KEY,
    private readonly baseUrl = process.env.MINIMAX_BASE_URL ?? "https://api.minimaxi.com",
    private readonly model = process.env.MINIMAX_MUSIC_MODEL ?? "music-2.6",
  ) {}

  async create(input: MusicGenerationInput): Promise<GeneratedDemo> {
    if (!this.apiKey) throw new DomainError("PROVIDER_NOT_CONFIGURED", 503, "MiniMax 尚未配置");
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/v1/music_generation`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      signal: AbortSignal.timeout(180_000),
      body: JSON.stringify({
        model: this.model,
        prompt: input.prompt.slice(0, 2_000),
        lyrics: input.lyrics.slice(0, 3_500),
        audio_setting: { sample_rate: 44_100, bitrate: 256_000, format: "mp3" },
        output_format: "url",
      }),
    });
    if (!response.ok) throw new DomainError("UPSTREAM_ERROR", 502, response.status === 401 ? "MiniMax 认证失败" : "音乐生成服务暂时不可用，请稍后重试");
    const parsed = miniMaxResponseSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.base_resp.status_code !== 0) throw new DomainError("UPSTREAM_INVALID_RESPONSE", 502, "音乐生成服务返回内容无效");
    let audioUrl: URL;
    try { audioUrl = new URL(parsed.data.data.audio); } catch { throw new DomainError("UPSTREAM_INVALID_RESPONSE", 502, "音乐生成服务未返回可播放音频"); }
    if (audioUrl.protocol !== "https:") throw new DomainError("UPSTREAM_INVALID_RESPONSE", 502, "音乐生成服务未返回安全音频地址");
    return { audioUrl: audioUrl.toString(), durationMs: parsed.data.extra_info?.music_duration ?? 30_000, executionKind: "real_external", providerLabel: `MiniMax ${this.model}` };
  }
}

export function getMusicGenerator(): MusicGenerator {
  // MUSIC_PROVIDER_MODE=minimax + Key → 真实生成；否则透明 Mock，不冒充外部结果
  return process.env.NODE_ENV !== "test" && process.env.MINIMAX_API_KEY && process.env.MUSIC_PROVIDER_MODE !== "mock" ? new MiniMaxMusicGenerator() : new MockMusicGenerator();
}
