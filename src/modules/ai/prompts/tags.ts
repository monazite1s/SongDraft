/**
 * Tag 治理（单一事实源）— docs/technical-design.md §5
 *
 * 素材 / 简报 / 灵感三类结构化字段统一在此声明：每个 tag 自带
 *  - field：输出字段名（LLM 返回 JSON 的 key，也是 Zod schema 组合键）
 *  - promptHint：喂给 system prompt 的字段语义 + 取值约束
 *  - zod：字段级 ZodType（即时组合出完整 schema，消除「prompt 描述与 Zod 双份维护」）
 *  - uiMeta：前端 UI 渲染所需元数据（本层只声明数据，不耦合组件）
 *
 * 解耦原则：
 *  - icon 仅做 lucide-react 的「类型引用」（`type LucideIcon`），本文件不持有图标运行时值，
 *    保持 AI/schema 层与组件层解耦；前端在自己的映射层把 tag.key 映射到具体图标。
 *  - 本文件只依赖 zod；不 import 任何适配器（brief-generator / inspiration-enricher），
 *    避免与 prompts/index.ts 形成运行时循环依赖。
 *  - BRIEF_TAGS / INSPIRATION_TAGS 的 field 用字符串字面量声明，对外通过 *_FIELDS
 *    常量供适配器对齐（适配器的 payload 类型仍由自己持有，保证前端兼容）。
 */
import type { LucideIcon } from "lucide-react";
import { z, type ZodType } from "zod";

/* -------------------------------------------------------------------------- */
/* 素材三 tab：INPUT_TAGS                                                       */
/* -------------------------------------------------------------------------- */

export type InputTagKey = "text" | "audio" | "image";

export interface InputTag {
  key: InputTagKey;
  label: string;
  /** 该素材类型在音乐/简报 prompt 中扮演的角色描述（驱动 buildMusicPrompt 的素材类型说明）。 */
  promptRole: string;
  /** 对应灵感快照中的主素材字段。 */
  field: "text" | "audio" | "image";
  /** 前端图标类型引用（本层不持值）。 */
  icon: LucideIcon;
}

export const INPUT_TAGS: Record<InputTagKey, InputTag> = {
  text: {
    key: "text",
    label: "文字灵感",
    promptRole: "用户提供歌词草稿、概念文字或情绪描述（text 类素材）",
    field: "text",
    icon: undefined as unknown as LucideIcon,
  },
  audio: {
    key: "audio",
    label: "音频灵感",
    promptRole: "用户上传哼唱 / 参考音频片段，并附文字说明（audio 类素材）",
    field: "audio",
    icon: undefined as unknown as LucideIcon,
  },
  image: {
    key: "image",
    label: "图片灵感",
    promptRole: "用户上传封面 / 氛围参考图，并附文字说明（image 类素材）",
    field: "image",
    icon: undefined as unknown as LucideIcon,
  },
};

/* -------------------------------------------------------------------------- */
/* 简报字段：BRIEF_TAGS（field 对齐 BriefPayload）                              */
/* -------------------------------------------------------------------------- */

export interface BriefUiMeta {
  label: string;
  placeholder?: string;
  multiline?: boolean;
  /** 候选词（前端 chip 选择；可选）。 */
  chips?: string[];
}

export interface BriefTag {
  key: string;
  /** LLM 返回 JSON 中的字段名（与 brief-generator.ts 的 BriefPayload 键一一对应）。 */
  field: string;
  /** 喂给 system prompt 的字段语义 + 取值约束说明。 */
  promptHint: string;
  /** 字段级 Zod 校验（由 build* 组合成完整 briefZodSchema）。 */
  zod: ZodType;
  uiMeta: BriefUiMeta;
}

const MOOD_CHIPS = ["温暖", "克制", "释然", "怀旧", "明亮", "热烈", "治愈", "迷离", "坚定", "空灵"];
const GENRE_CHIPS = ["Indie Pop", "Dream Pop", "Synth Pop", "R&B", "Folk", "Rock", "Electronic"];

/*
 * 字段级 Zod schema 先单独声明为常量，再同时被 BRIEF_TAGS（元数据）与 briefZodSchema
 * （z.object 静态字面量）引用——这样 zod 能推断出精确的输出类型（key 保留），
 * 同时字段定义仍是单一事实源（修一处即同步 prompt 描述与 schema）。
 */
const briefFieldSchemas = {
  theme: z.string().min(1).max(120),
  mood: z.array(z.string().min(1).max(40)).min(1).max(8),
  genre: z.string().min(1).max(80),
  tempo: z.string().min(1).max(40),
  instruments: z.array(z.string().min(1).max(40)).max(12).default([]),
  lyricSummary: z.string().max(500).default(""),
  melodyFeatures: z.string().max(300).default(""),
  visualReferences: z.string().max(300).default(""),
  evidence: z
    .array(z.object({ source: z.string().min(1).max(40), detail: z.string().min(1).max(200) }))
    .default([]),
  conflicts: z.array(z.string().max(200)).default([]),
  priority: z.string().max(300).default(""),
  extraPrompt: z.string().max(1000).default(""),
  quantity: z.number().int().min(1).max(10).default(3),
};

export const BRIEF_TAGS: Record<string, BriefTag> = {
  theme: {
    key: "theme",
    field: "theme",
    promptHint: "theme：一句话主题，10–25 字，概括创作核心",
    zod: briefFieldSchemas.theme,
    uiMeta: { label: "主题", placeholder: "一句话概括这首歌的核心", multiline: false },
  },
  mood: {
    key: "mood",
    field: "mood",
    promptHint: "mood：3–5 个情绪标签（字符串数组），克制且可执行",
    zod: briefFieldSchemas.mood,
    uiMeta: { label: "情绪", chips: MOOD_CHIPS },
  },
  genre: {
    key: "genre",
    field: "genre",
    promptHint: "genre：曲风，可含子风格（如 Indie Pop / Dream Pop）",
    zod: briefFieldSchemas.genre,
    uiMeta: { label: "曲风", chips: GENRE_CHIPS },
  },
  tempo: {
    key: "tempo",
    field: "tempo",
    promptHint: "tempo：速度与节拍（如 84 BPM · 4/4）",
    zod: briefFieldSchemas.tempo,
    uiMeta: { label: "速度", placeholder: "如 84 BPM · 4/4" },
  },
  instruments: {
    key: "instruments",
    field: "instruments",
    promptHint: "instruments：主要乐器（字符串数组，无则空数组）",
    zod: briefFieldSchemas.instruments,
    uiMeta: { label: "乐器", placeholder: "电钢琴、合成 Pad…" },
  },
  lyricSummary: {
    key: "lyricSummary",
    field: "lyricSummary",
    promptHint: "lyricSummary：歌词概要，无歌词时给出建议",
    zod: briefFieldSchemas.lyricSummary,
    uiMeta: { label: "歌词概要", multiline: true },
  },
  melodyFeatures: {
    key: "melodyFeatures",
    field: "melodyFeatures",
    promptHint: "melodyFeatures：旋律特征推测（音域、走向、记忆点）",
    zod: briefFieldSchemas.melodyFeatures,
    uiMeta: { label: "旋律特征", multiline: true },
  },
  visualReferences: {
    key: "visualReferences",
    field: "visualReferences",
    promptHint: "visualReferences：视觉参考，无则空字符串",
    zod: briefFieldSchemas.visualReferences,
    uiMeta: { label: "视觉参考", multiline: true },
  },
  evidence: {
    key: "evidence",
    field: "evidence",
    promptHint: "evidence：证据来源数组，元素含 source 与 detail，无则空数组",
    zod: briefFieldSchemas.evidence,
    uiMeta: { label: "证据来源" },
  },
  conflicts: {
    key: "conflicts",
    field: "conflicts",
    promptHint: "conflicts：冲突与取舍（字符串数组），无则空数组",
    zod: briefFieldSchemas.conflicts,
    uiMeta: { label: "冲突与取舍", multiline: true },
  },
  priority: {
    key: "priority",
    field: "priority",
    promptHint: "priority：优先策略，说明哪些元素必须保留",
    zod: briefFieldSchemas.priority,
    uiMeta: { label: "优先策略", multiline: true },
  },
  extraPrompt: {
    key: "extraPrompt",
    field: "extraPrompt",
    promptHint: "extraPrompt：用户附加生成要求，可为空字符串",
    zod: briefFieldSchemas.extraPrompt,
    uiMeta: { label: "附加要求", multiline: true },
  },
  quantity: {
    key: "quantity",
    field: "quantity",
    promptHint: "quantity：候选数量，1–10 的整数（默认 3）",
    zod: briefFieldSchemas.quantity,
    uiMeta: { label: "候选数量" },
  },
};

/** 简报字段的渲染 / 生成顺序（生成简报 UI 与 system prompt 字段描述均按此序）。 */
export const BRIEF_TAG_ORDER: string[] = [
  "theme",
  "mood",
  "genre",
  "tempo",
  "instruments",
  "lyricSummary",
  "melodyFeatures",
  "visualReferences",
  "evidence",
  "conflicts",
  "priority",
  "extraPrompt",
  "quantity",
];

/**
 * 由 briefFieldSchemas 组合出的完整 Zod 对象 schema（取代 brief-generator 中手写的 briefSchema）。
 * 静态字面量保证 zod 推断出精确键类型，briefFieldSchemas 同时驱动 BRIEF_TAGS 元数据，
 * prompt 描述与 schema 共用同一份字段定义。
 */
export const briefZodSchema = z.object({
  theme: briefFieldSchemas.theme,
  mood: briefFieldSchemas.mood,
  genre: briefFieldSchemas.genre,
  tempo: briefFieldSchemas.tempo,
  instruments: briefFieldSchemas.instruments,
  lyricSummary: briefFieldSchemas.lyricSummary,
  melodyFeatures: briefFieldSchemas.melodyFeatures,
  visualReferences: briefFieldSchemas.visualReferences,
  evidence: briefFieldSchemas.evidence,
  conflicts: briefFieldSchemas.conflicts,
  priority: briefFieldSchemas.priority,
  extraPrompt: briefFieldSchemas.extraPrompt,
  quantity: briefFieldSchemas.quantity,
});

/* -------------------------------------------------------------------------- */
/* 灵感字段：INSPIRATION_TAGS（field 对齐 InspirationEnrichment）               */
/* -------------------------------------------------------------------------- */

export interface InspirationUiMeta {
  label: string;
  placeholder?: string;
  multiline?: boolean;
  chips?: string[];
}

export interface InspirationTag {
  key: string;
  field: string;
  promptHint: string;
  zod: ZodType;
  uiMeta: InspirationUiMeta;
}

const SPEED_CHIPS = ["slow", "medium", "fast", "unknown"];

const inspirationFieldSchemas = {
  title: z.string().trim().max(60).nullable().default(null),
  moods: z.array(z.string().trim().min(1).max(32)).max(11).nullable().default(null),
  speedFeel: z.enum(["slow", "medium", "fast", "unknown"]).nullable().default(null),
  soundHints: z.string().trim().max(500).nullable().default(null),
  referenceWorks: z.string().trim().max(500).nullable().default(null),
};

export const INSPIRATION_TAGS: Record<string, InspirationTag> = {
  title: {
    key: "title",
    field: "title",
    promptHint: "title：仅在用户未填标题且输入足够时建议一个 ≤20 字的简短名字；否则 null",
    zod: inspirationFieldSchemas.title,
    uiMeta: { label: "标题", placeholder: "给这条灵感起个名字" },
  },
  moods: {
    key: "moods",
    field: "moods",
    promptHint: "moods：2–4 个简短情绪词（字符串数组）；不补全时填 null 而非空数组",
    zod: inspirationFieldSchemas.moods,
    uiMeta: { label: "情绪", chips: MOOD_CHIPS },
  },
  speedFeel: {
    key: "speedFeel",
    field: "speedFeel",
    promptHint: "speedFeel：在 slow | medium | fast | unknown 中选一个；不补全时填 null",
    zod: inspirationFieldSchemas.speedFeel,
    uiMeta: { label: "速度感", chips: SPEED_CHIPS },
  },
  soundHints: {
    key: "soundHints",
    field: "soundHints",
    promptHint: "soundHints：音色、乐器、节奏线索（一句话或逗号分隔）；不补全时填 null",
    zod: inspirationFieldSchemas.soundHints,
    uiMeta: { label: "音色线索", multiline: true },
  },
  referenceWorks: {
    key: "referenceWorks",
    field: "referenceWorks",
    promptHint: "referenceWorks：风格相近的参考作品或艺术家（最多 2 个）；不补全时填 null",
    zod: inspirationFieldSchemas.referenceWorks,
    uiMeta: { label: "参考作品", multiline: true },
  },
};

export const INSPIRATION_TAG_ORDER: string[] = ["title", "moods", "speedFeel", "soundHints", "referenceWorks"];

/** 由 inspirationFieldSchemas 组合出的完整 Zod 对象 schema（精确键类型）。 */
export const inspirationEnrichZodSchema = z.object({
  title: inspirationFieldSchemas.title,
  moods: inspirationFieldSchemas.moods,
  speedFeel: inspirationFieldSchemas.speedFeel,
  soundHints: inspirationFieldSchemas.soundHints,
  referenceWorks: inspirationFieldSchemas.referenceWorks,
});

/* -------------------------------------------------------------------------- */
/* 歌词字段：LYRIC_TAGS（field 对齐 DeepSeek 歌词返回）                          */
/* -------------------------------------------------------------------------- */

export interface LyricUiMeta {
  label: string;
  multiline?: boolean;
}

export interface LyricTag {
  key: string;
  field: string;
  promptHint: string;
  zod: ZodType;
  uiMeta: LyricUiMeta;
}

const lyricFieldSchemas = {
  message: z.string().min(1).max(2_000),
  lyrics: z.string().max(10_000).nullable(),
  context: z.object({
    emotion: z.string().min(1).max(80).default("温暖坚定"),
    singingMode: z.enum(["chorus", "solo"]).default("chorus"),
  }),
};

export const LYRIC_TAGS: Record<string, LyricTag> = {
  message: {
    key: "message",
    field: "message",
    promptHint: "message：给用户的中文回复说明（做了什么 / 需要什么）",
    zod: lyricFieldSchemas.message,
    uiMeta: { label: "回复" },
  },
  lyrics: {
    key: "lyrics",
    field: "lyrics",
    promptHint: "lyrics：完整歌词（含 [Verse]/[Chorus] 等段落标签）；仅当确缺关键信息时为 null",
    zod: lyricFieldSchemas.lyrics,
    uiMeta: { label: "歌词", multiline: true },
  },
  context: {
    key: "context",
    field: "context",
    promptHint: 'context：含 emotion（情绪）与 singingMode（"chorus" | "solo"）',
    zod: lyricFieldSchemas.context,
    uiMeta: { label: "创作上下文" },
  },
};

export const LYRIC_TAG_ORDER: string[] = ["message", "lyrics", "context"];

/** 由 lyricFieldSchemas 组合出的完整 Zod 对象 schema（取代 lyric-assistant 手写 schema，精确键类型）。 */
export const lyricZodSchema = z.object({
  message: lyricFieldSchemas.message,
  lyrics: lyricFieldSchemas.lyrics,
  context: lyricFieldSchemas.context,
});
