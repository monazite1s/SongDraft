/**
 * Prompt Registry（docs/technical-design.md §5）
 * 业务 Service 只传结构化变量；页面与 Route Handler 不得直接拼接系统 Prompt。
 */
export { CONVERSATION_SYSTEM_PROMPT } from "./conversation.system";
export { LYRICS_SYSTEM_PROMPT } from "./lyrics.system";
export { MUSIC_SYSTEM_PROMPT } from "./music.system";
export { BRIEF_SYSTEM_PROMPT } from "./brief.system";
export { INSPIRATION_ENRICH_SYSTEM_PROMPT } from "./inspiration.system";

import { CONVERSATION_SYSTEM_PROMPT } from "./conversation.system";
import { LYRICS_SYSTEM_PROMPT } from "./lyrics.system";
import { MUSIC_SYSTEM_PROMPT } from "./music.system";
import { BRIEF_SYSTEM_PROMPT } from "./brief.system";
import { INSPIRATION_ENRICH_SYSTEM_PROMPT } from "./inspiration.system";

export const PROMPT_VERSIONS = {
  conversation: "conversation-v1",
  lyrics: "lyrics-v1",
  music: "music-v1",
  brief: "brief-v1",
  inspirationEnrich: "inspiration-enrich-v1",
} as const;

/** DeepSeek 系统 Prompt：灵感补全规范 + JSON 输出约束（只含补全字段，空值表示未补全）。 */
export function buildInspirationEnrichSystemPrompt() {
  return `${INSPIRATION_ENRICH_SYSTEM_PROMPT}\n必须只返回 JSON，结构为 {"title":string|null,"moods":string[]|null,"speedFeel":"slow"|"medium"|"fast"|"unknown"|null,"soundHints":string|null,"referenceWorks":string|null}。未补全的字段填 null（moods 填 null 而不是空数组）。title ≤20 字；moods 2–4 个词；soundHints/referenceWorks 为一句话或逗号分隔列表。不要返回任何额外字段或解释文字。`;
}

/** DeepSeek 系统 Prompt：创意简报规范 + JSON 输出约束。 */
export function buildBriefSystemPrompt() {
  return `${BRIEF_SYSTEM_PROMPT}\n必须只返回 JSON，结构为 {"theme":string,"mood":string[],"genre":string,"tempo":string,"instruments":string[],"lyricSummary":string,"melodyFeatures":string,"visualReferences":string,"evidence":[{"source":string,"detail":string}],"conflicts":string[],"priority":string}。theme 为一句话主题；mood 3–5 个情绪标签；genre 风格；tempo 速度；instruments 主要乐器；lyricSummary 歌词概要；melodyFeatures 旋律特征推测；visualReferences 视觉参考，无则空串；evidence 证据来源，无则空数组；conflicts 冲突与取舍，无则空数组；priority 优先策略。不要返回任何额外字段或解释文字。`;
}

/** DeepSeek 系统 Prompt：对话策略 + 歌词规范 + JSON 输出约束。 */
export function buildLyricSystemPrompt() {
  return `${CONVERSATION_SYSTEM_PROMPT}\n${LYRICS_SYSTEM_PROMPT}\n必须只返回 JSON，结构为 {"message":string,"lyrics":string|null,"context":{"emotion":string,"singingMode":"chorus"|"solo"}}。需要执行歌词生成或修改时返回完整 lyrics；只有确实缺少完成任务所需的关键信息时才令 lyrics 为 null。`;
}

/** MiniMax 风格描述：系统音乐导向 + Brief 字段 + 额外要求，截断至 2000 字。 */
export function buildMusicPrompt(input: { theme: string; description?: string | null; emotion?: unknown; genre?: string; tempo?: string; extraPrompt?: string | null }) {
  return [MUSIC_SYSTEM_PROMPT, input.theme, input.description, input.genre, input.tempo, typeof input.emotion === "string" ? input.emotion : null, input.extraPrompt]
    .filter((item): item is string => Boolean(item?.trim()))
    .join("，")
    .slice(0, 2_000);
}
