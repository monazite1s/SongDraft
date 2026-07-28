import { z } from "zod";

const optionalText = z.string().trim().max(5_000).optional();

export const createProjectSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1_000).optional(),
    lyrics: optionalText,
    melodyAssetId: z.string().uuid().optional(),
    visualAssetId: z.string().uuid().optional(),
  })
  .superRefine((value, context) => {
    const hasText = Boolean(value.description || value.lyrics);
    if (!hasText && !value.melodyAssetId && !value.visualAssetId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "至少添加一种灵感素材" });
    }
  });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
