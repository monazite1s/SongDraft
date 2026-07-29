import { z } from "zod";

const optionalText = z.string().trim().max(5_000).optional();

// 仅 title 必填：制作台「新建项目」允许先建空项目，素材在制作台内补充（SPEC §2）。
// 灵感保存（attach new_project）仍会带 description/lyrics，天然满足「有内容」。
export const createProjectSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1_000).optional(),
  lyrics: optionalText,
  melodyAssetId: z.string().uuid().optional(),
  visualAssetId: z.string().uuid().optional(),
  artistId: z.string().trim().max(80).optional(),
  eventId: z.string().trim().max(80).optional(),
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
