import { z } from "zod";

/**
 * 灵感库查询参数（docs/implementation-todo.md §8.5）。
 * 列表/素材类型/标签支持单值或逗号分隔；分页上限 50。
 */
const optionalCsv = z.preprocess((value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) return value.split(",");
  return undefined;
}, z.array(z.string()).optional());

export const inspirationListQuerySchema = z.object({
  query: z.string().trim().max(120).optional(),
  kinds: optionalCsv.pipe(z.array(z.enum(["audio", "image", "text"])).max(3).optional()),
  tags: optionalCsv.pipe(z.array(z.string().trim().min(1).max(32)).max(20).optional()),
  attached: z.enum(["all", "unattached", "attached"]).optional(),
  sort: z.enum(["updated", "created"]).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type InspirationListQuery = z.infer<typeof inspirationListQuerySchema>;

export const inspirationMetaSchema = z.object({
  title: z.string().trim().max(60).nullable().optional(),
});
