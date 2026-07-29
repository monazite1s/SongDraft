import { z } from "zod";

const tagSchema = z.string().trim().min(1).max(32);
const assetIdSchema = z.string().uuid();

const textSnapshotSchema = z.object({
  inspirationType: z.enum(["lyric", "concept", "story", "melody_note", "arrangement", "other"]),
  content: z.string().trim().min(1).max(5_000),
  moods: z.array(tagSchema).max(11).default([]),
  speedFeel: z.enum(["slow", "medium", "fast", "unknown"]).default("unknown"),
  soundHints: z.string().trim().max(500).default(""),
  referenceWorks: z.string().trim().max(500).default(""),
  advanced: z.object({
    bpm: z.number().int().min(20).max(300).optional(),
    key: z.string().trim().max(24).optional(),
    chords: z.string().trim().max(300).optional(),
    structure: z.string().trim().max(300).optional(),
  }).default({}),
});

const audioSnapshotSchema = z.object({
  note: z.string().trim().max(1_000).default(""),
  items: z.array(z.object({
    assetId: assetIdSchema,
    label: z.string().trim().min(1).max(255),
    note: z.string().trim().max(1_000).default(""),
    role: z.enum(["verse", "pre_chorus", "chorus_hook", "rhythm", "harmony", "ambience", "other"]).optional(),
  })).min(1).max(20),
});

const imageSnapshotSchema = z.object({
  note: z.string().trim().max(1_000).default(""),
  assetIds: z.array(assetIdSchema).min(1).max(9),
  coverAssetId: assetIdSchema.optional(),
  moods: z.array(tagSchema).max(11).default([]),
}).superRefine((value, context) => {
  if (value.coverAssetId && !value.assetIds.includes(value.coverAssetId)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["coverAssetId"], message: "封面必须来自当前图片列表" });
  }
});

/**
 * The capture form always stores a bounded, structured snapshot. Keeping this
 * schema explicit prevents arbitrary client JSON from becoming durable state.
 */
export const inspirationSnapshotSchema = z.object({
  primaryKind: z.enum(["audio", "image", "text"]),
  title: z.string().trim().max(60).default(""),
  tags: z.array(tagSchema).max(12).default([]),
  text: textSnapshotSchema.optional(),
  audio: audioSnapshotSchema.optional(),
  image: imageSnapshotSchema.optional(),
}).superRefine((value, context) => {
  const contentByKind = {
    text: value.text,
    audio: value.audio,
    image: value.image,
  };
  if (!contentByKind[value.primaryKind]) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: [value.primaryKind], message: "当前灵感类型需要至少一条有效内容" });
  }
});

export const createInspirationRecordSchema = z.object({
  snapshot: inspirationSnapshotSchema,
});

export const autosaveInspirationRecordSchema = z.object({
  snapshot: inspirationSnapshotSchema,
  reason: z.enum(["autosave", "manual"]).default("autosave"),
});

export type InspirationSnapshot = z.infer<typeof inspirationSnapshotSchema>;
export type InspirationPrimaryKind = InspirationSnapshot["primaryKind"];
export type InspirationSnapshotReason = "autosave" | "manual" | "restore" | "attach";
