import { z } from "zod";

const rules = {
  audio: {
    maxBytes: 20 * 1024 * 1024,
    mimeTypes: ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/webm"],
    extensions: ["mp3", "m4a", "wav", "webm"],
  },
  image: {
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    extensions: ["jpg", "jpeg", "png", "webp"],
  },
  video: {
    maxBytes: 100 * 1024 * 1024,
    mimeTypes: ["video/mp4", "video/quicktime", "video/webm"],
    extensions: ["mp4", "mov", "webm"],
  },
} as const;

const uploadIntentBase = z.object({
  /** Client-generated IDs let a record snapshot reference a pending upload safely. */
  assetId: z.string().uuid().optional(),
  kind: z.enum(["audio", "image", "video"]),
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(100),
  sizeBytes: z.number().int().positive(),
});

export const createUploadIntentSchema = z.union([
  uploadIntentBase.extend({
    projectId: z.string().uuid(),
    recordId: z.undefined().optional(),
  }).strict(),
  uploadIntentBase.extend({
    recordId: z.string().uuid(),
    projectId: z.undefined().optional(),
  }).strict(),
])
  .superRefine((value, context) => {
    const rule = rules[value.kind];
    const extension = value.filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
    // 容忍 codecs 参数（如 `audio/webm;codecs=opus`）：比较前剥离 `;` 之后的参数段。
    const base = value.mimeType.split(";")[0];
    if (!(rule.mimeTypes as readonly string[]).includes(base)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["mimeType"], message: "文件类型不受支持" });
    }
    if (!extension || !(rule.extensions as readonly string[]).includes(extension)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["filename"], message: "文件扩展名不受支持" });
    }
    if (value.sizeBytes > rule.maxBytes) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["sizeBytes"], message: "文件大小超出限制" });
    }
  });

export type CreateUploadIntentInput = z.infer<typeof createUploadIntentSchema>;

export function getUploadScope(input: CreateUploadIntentInput) {
  if (typeof input.projectId === "string") {
    return { type: "project" as const, id: input.projectId };
  }
  return { type: "record" as const, id: input.recordId };
}
