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

export const createUploadIntentSchema = z
  .object({
    projectId: z.string().uuid(),
    kind: z.enum(["audio", "image", "video"]),
    filename: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1).max(100),
    sizeBytes: z.number().int().positive(),
  })
  .superRefine((value, context) => {
    const rule = rules[value.kind];
    const extension = value.filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
    if (!(rule.mimeTypes as readonly string[]).includes(value.mimeType)) {
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
