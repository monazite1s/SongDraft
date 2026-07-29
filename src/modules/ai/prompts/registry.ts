/**
 * PROMPT_REGISTRY（docs/technical-design.md §5）— 模型参数与版本单一事实源。
 *
 * 每个能力域集中声明：版本（用于落库 promptVersion）、system prompt 构造器、
 * 模型调用参数（temperature / maxTokens / responseFormat）、Provider。
 * 适配器（brief-generator / lyric-assistant / inspiration-enricher）从 registry 取
 * modelParams，消除散落的硬编码 temperature / max_tokens。
 */
import {
  buildBriefSystemPrompt,
  buildInspirationEnrichSystemPrompt,
  buildLyricSystemPrompt,
} from "./builders";

export interface ModelParams {
  temperature: number;
  maxTokens: number;
  responseFormat: "json_object" | "text";
}

export interface PromptRegistryEntry {
  version: string;
  buildSystem: () => string;
  modelParams: ModelParams;
  provider: "deepseek" | "minimax";
}

export const PROMPT_VERSIONS = {
  conversation: "conversation-v1",
  lyrics: "lyrics-v1",
  music: "music-v1",
  brief: "brief-v1",
  inspirationEnrich: "inspiration-enrich-v1",
} as const;

export const PROMPT_REGISTRY = {
  brief: {
    version: PROMPT_VERSIONS.brief,
    buildSystem: buildBriefSystemPrompt,
    modelParams: { temperature: 0.6, maxTokens: 2_400, responseFormat: "json_object" },
    provider: "deepseek",
  },
  lyrics: {
    version: PROMPT_VERSIONS.lyrics,
    buildSystem: buildLyricSystemPrompt,
    modelParams: { temperature: 0.75, maxTokens: 2_800, responseFormat: "json_object" },
    provider: "deepseek",
  },
  inspirationEnrich: {
    version: PROMPT_VERSIONS.inspirationEnrich,
    buildSystem: buildInspirationEnrichSystemPrompt,
    modelParams: { temperature: 0.5, maxTokens: 1_200, responseFormat: "json_object" },
    provider: "deepseek",
  },
  music: {
    version: PROMPT_VERSIONS.music,
    // music prompt 由 generation-service 通过 buildMusicPrompt 拼装后直传 MiniMax，
    // 此处仅留模型参数 + 版本（maxTokens 对 MiniMax 不适用，保留占位以便落库与统一读取）。
    buildSystem: () => "",
    modelParams: { temperature: 0.8, maxTokens: 0, responseFormat: "text" },
    provider: "minimax",
  },
} as const satisfies Record<string, PromptRegistryEntry>;

export type PromptRegistryKey = keyof typeof PROMPT_REGISTRY;
