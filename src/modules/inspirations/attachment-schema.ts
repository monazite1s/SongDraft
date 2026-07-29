import { z } from "zod";

/** The destination is explicit so a quick capture never creates a hidden project. */
export const inspirationAttachmentSchema = z.discriminatedUnion("destination", [
  z.object({
    destination: z.literal("new_project"),
    title: z.string().trim().min(1).max(80),
  }),
  z.object({
    destination: z.literal("existing_project"),
    projectId: z.string().uuid(),
  }),
]);

export type InspirationAttachment = z.infer<typeof inspirationAttachmentSchema>;
