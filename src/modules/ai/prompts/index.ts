/**
 * Prompt 构造层门面（docs/technical-design.md §5）
 *
 * 业务 Service 只传结构化变量；页面与 Route Handler 不得直接拼接系统 Prompt。
 *
 * 设计：system prompt 的「字段 JSON 约束」由 tags.ts 的单一事实源自动派生
 * （见 builders.ts），不再与 Zod schema 双份维护。
 */
export { CONVERSATION_SYSTEM_PROMPT } from "./conversation.system";
export { LYRICS_SYSTEM_PROMPT } from "./lyrics.system";
export { MUSIC_SYSTEM_PROMPT } from "./music.system";
export { BRIEF_SYSTEM_PROMPT } from "./brief.system";
export { INSPIRATION_ENRICH_SYSTEM_PROMPT } from "./inspiration.system";

export {
  buildBriefSystemPrompt,
  buildInspirationEnrichSystemPrompt,
  buildLyricSystemPrompt,
  buildMusicPrompt,
  inputRolesFor,
} from "./builders";

export { PROMPT_REGISTRY, PROMPT_VERSIONS } from "./registry";
export type { ModelParams, PromptRegistryEntry, PromptRegistryKey } from "./registry";

export {
  briefZodSchema,
  inspirationEnrichZodSchema,
  lyricZodSchema,
  BRIEF_TAGS,
  BRIEF_TAG_ORDER,
  INPUT_TAGS,
  INSPIRATION_TAGS,
  INSPIRATION_TAG_ORDER,
  LYRIC_TAGS,
  LYRIC_TAG_ORDER,
} from "./tags";
export type {
  BriefTag,
  BriefUiMeta,
  InputTag,
  InputTagKey,
  InspirationTag,
  InspirationUiMeta,
  LyricTag,
  LyricUiMeta,
} from "./tags";
