/**
 * 歌词模型适配器（docs/technical-design.md §3、§6）
 *
 * LyricAssistant 统一契约；走 DeepSeek chat/completions + JSON Output。
 * 未配置 Key 时抛 PROVIDER_NOT_CONFIGURED，不返回写死歌词。
 */
import type { ArtistProfile } from "@/modules/artists/artist-types";

import { PROMPT_REGISTRY, buildLyricSystemPrompt, lyricZodSchema } from "@/modules/ai/prompts";
import { DomainError } from "@/shared/errors/domain-error";

export interface CreativeContext {
  artistId: string | null;
  eventIds: string[];
  emotion: string;
  singingMode: "chorus" | "solo";
  executionKind: "simulated" | "real_external";
}

export type CreativeStreamEvent =
  | { type: "thinking"; text: string }
  | { type: "message_delta"; delta: string }
  | { type: "lyrics_replace"; lyrics: string }
  | { type: "lyrics_delta"; delta: string }
  | { type: "context"; context: CreativeContext }
  | { type: "complete"; projectId: string; messageId: string }
  | { type: "error"; message: string; retryable: boolean };

export interface CreativeChatInput {
  projectId: string;
  artist: ArtistProfile | null;
  message: string;
  eventIds: string[];
  currentLyrics?: string | null;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface AssistantDraft {
  message: string;
  lyrics: string | null;
  context: CreativeContext;
}

export interface LyricAssistant {
  createDraft(input: CreativeChatInput): Promise<AssistantDraft>;
}

/** DeepSeek V4 Flash：系统 Prompt + 历史消息 + 结构化 user payload → Zod 校验 JSON。未配置 Key 抛错，不造假。 */
export class DeepSeekLyricAssistant implements LyricAssistant {
  constructor(
    private readonly apiKey = process.env.DEEPSEEK_API_KEY,
    private readonly baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    private readonly model = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
  ) {}

  async createDraft(input: CreativeChatInput): Promise<AssistantDraft> {
    if (!this.apiKey) throw new DomainError("PROVIDER_NOT_CONFIGURED", 503, "DeepSeek 尚未配置");
    const { temperature, maxTokens, responseFormat } = PROMPT_REGISTRY.lyrics.modelParams;
    const artistContext = input.artist ? {
      id: input.artist.id,
      name: input.artist.name,
      fandomName: input.artist.fandomName,
      slogan: input.artist.slogan,
      summary: input.artist.summary,
      genres: input.artist.genres,
      selectedEvents: input.artist.events.filter((event) => input.eventIds.includes(event.id)),
    } : null;
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
          { role: "system", content: buildLyricSystemPrompt() },
          ...(input.history ?? []).slice(-20).map((message) => ({ role: message.role, content: message.content.slice(0, 4_000) })),
          { role: "user", content: JSON.stringify({ artist: artistContext, request: input.message, currentLyrics: input.currentLyrics ?? null }) },
        ],
      }),
    });
    if (!response.ok) throw new DomainError("UPSTREAM_ERROR", 502, response.status === 401 ? "DeepSeek 认证失败" : "歌词服务暂时不可用，请稍后重试");
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new DomainError("UPSTREAM_INVALID_RESPONSE", 502, "歌词服务返回内容无效");
    let parsed: unknown;
    try { parsed = JSON.parse(content); } catch { throw new DomainError("UPSTREAM_INVALID_RESPONSE", 502, "歌词服务返回内容无效"); }
    // schema 由 LYRIC_TAGS 组合（lyricZodSchema）。
    const validated = lyricZodSchema.safeParse(parsed);
    if (!validated.success) throw new DomainError("UPSTREAM_INVALID_RESPONSE", 502, "歌词服务返回内容无效");
    const draft = validated.data;
    return {
      message: draft.message,
      lyrics: draft.lyrics,
      context: { artistId: input.artist?.id ?? null, eventIds: input.eventIds, emotion: draft.context.emotion, singingMode: draft.context.singingMode, executionKind: "real_external" },
    };
  }
}

/** 文本生成一律走 DeepSeek（未配置 Key 时适配器抛 PROVIDER_NOT_CONFIGURED，不返回写死歌词）。 */
export function getLyricAssistant(): LyricAssistant {
  return new DeepSeekLyricAssistant();
}
