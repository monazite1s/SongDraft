/**
 * Prompt Registry（docs/technical-design.md §5）
 * 业务 Service 只传结构化变量；页面与 Route Handler 不得直接拼接系统 Prompt。
 */
export { CONVERSATION_SYSTEM_PROMPT } from "./conversation.system";
export { LYRICS_SYSTEM_PROMPT } from "./lyrics.system";
export { MUSIC_SYSTEM_PROMPT } from "./music.system";

import { CONVERSATION_SYSTEM_PROMPT } from "./conversation.system";
import { LYRICS_SYSTEM_PROMPT } from "./lyrics.system";
import { MUSIC_SYSTEM_PROMPT } from "./music.system";

export const PROMPT_VERSIONS = {
  conversation: "conversation-v1",
  lyrics: "lyrics-v1",
  music: "music-v1",
} as const;

/** DeepSeek 系统 Prompt：对话策略 + 歌词规范 + JSON 输出约束。 */
export function buildLyricSystemPrompt() {
  return `${CONVERSATION_SYSTEM_PROMPT}\n${LYRICS_SYSTEM_PROMPT}\n必须只返回 JSON，结构为 {"message":string,"lyrics":string|null,"context":{"emotion":string,"singingMode":"chorus"|"solo"}}。需要执行歌词生成或修改时返回完整 lyrics；只有确实缺少完成任务所需的关键信息时才令 lyrics 为 null。`;
}

/** MiniMax 风格描述：系统音乐导向 + Brief 字段，截断至 2000 字。 */
export function buildMusicPrompt(input: { theme: string; description?: string | null; emotion?: unknown; genre?: string; tempo?: string }) {
  return [MUSIC_SYSTEM_PROMPT, input.theme, input.description, input.genre, input.tempo, typeof input.emotion === "string" ? input.emotion : null]
    .filter((item): item is string => Boolean(item?.trim()))
    .join("，")
    .slice(0, 2_000);
}
