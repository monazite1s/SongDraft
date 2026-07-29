import { z } from "zod";

const optionalText = z.string().trim().max(5_000).optional();

export const createProjectSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1_000).optional(),
    lyrics: optionalText,
    melodyAssetId: z.string().uuid().optional(),
    visualAssetId: z.string().uuid().optional(),
    artistId: z.string().trim().max(80).optional(),
    eventId: z.string().trim().max(80).optional(),
  })
  .superRefine((value, context) => {
    const hasText = Boolean(value.description || value.lyrics);
    if (!hasText && !value.melodyAssetId && !value.visualAssetId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "至少添加一种灵感素材" });
    }
  });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectDraftSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1_000).nullable().optional(),
  artistId: z.string().trim().max(80).nullable().optional(),
  eventId: z.string().trim().max(80).nullable().optional(),
  currentLyrics: z.string().max(10_000).nullable().optional(),
  creativeContext: z.record(z.string(), z.unknown()).optional(),
}).refine((value) => Object.keys(value).length > 0, "至少更新一个字段");

export type UpdateProjectDraftInput = z.infer<typeof updateProjectDraftSchema>;
