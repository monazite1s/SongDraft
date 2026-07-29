/**
 * 创意简报流程（docs/SPEC.md §4 创作 Brief；docs/technical-design.md §4）
 *
 * generate：读取项目素材 → BriefGenerator（DeepSeek/Mock）→ 写入 creative_briefs（新 revision）。
 * update：覆盖某版简报 payload 并清空 confirmedAt（需重新确认）。
 * confirm：写入确认时间，生成链路据此读取已确认简报。
 * 入口：POST/PATCH /api/projects/[id]/brief、POST .../confirm。
 */
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDatabase } from "@/infrastructure/db/client";
import { creativeBriefs } from "@/infrastructure/db/schema";
import { getBriefGenerator, type BriefPayload } from "@/modules/ai/brief-generator";
import type { AuthUser } from "@/modules/auth/types";
import { getProjectRepository } from "@/modules/projects/project-repository";
import { DomainError } from "@/shared/errors/domain-error";

export interface BriefView {
  id: string;
  projectId: string;
  revision: number;
  payload: BriefPayload;
  confirmedAt: string | null;
  createdAt: string;
}

export const briefPayloadSchema = z.object({
  theme: z.string().min(1).max(120),
  mood: z.array(z.string().min(1).max(40)).min(1).max(8),
  genre: z.string().min(1).max(80),
  tempo: z.string().min(1).max(40),
  instruments: z.array(z.string().min(1).max(40)).max(12),
  lyricSummary: z.string().max(500),
  melodyFeatures: z.string().max(300),
  visualReferences: z.string().max(300),
  evidence: z.array(z.object({ source: z.string().min(1).max(40), detail: z.string().min(1).max(200) })),
  conflicts: z.array(z.string().max(200)),
  priority: z.string().max(300),
  outputType: z.enum(["song", "soundtrack", "melody"]),
  extraPrompt: z.string().max(1000),
  quantity: z.number().int().min(1).max(10),
});

type BriefRow = typeof creativeBriefs.$inferSelect;
type MockBriefRow = BriefView;
const songDraftBriefStore = globalThis as typeof globalThis & { __songDraftBriefs?: Map<string, MockBriefRow> };
const mockBriefs = songDraftBriefStore.__songDraftBriefs ??= new Map<string, MockBriefRow>();

function mapView(row: BriefRow): BriefView {
  return { id: row.id, projectId: row.projectId, revision: row.revision, payload: row.payload as unknown as BriefPayload, confirmedAt: row.confirmedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString() };
}

function getMockBrief(briefId: string, projectId: string): MockBriefRow {
  const row = mockBriefs.get(briefId);
  if (!row || row.projectId !== projectId) throw new DomainError("NOT_FOUND", 404, "简报不存在或无权访问");
  return row;
}

export class BriefService {
  /** 由项目素材生成新版本创意简报（未确认）。 */
  async generate(owner: AuthUser, projectId: string): Promise<BriefView> {
    const project = await getProjectRepository().findOwned(projectId, owner.id);
    if (!project) throw new DomainError("NOT_FOUND", 404, "项目不存在或无权访问");
    const payload = await getBriefGenerator().generate({ projectTitle: project.title, description: project.description, lyrics: project.lyrics });

    if (!process.env.DATABASE_URL) {
      const revision = [...mockBriefs.values()].filter((row) => row.projectId === projectId).length + 1;
      const row: MockBriefRow = { id: crypto.randomUUID(), projectId, revision, payload, confirmedAt: null, createdAt: new Date().toISOString() };
      mockBriefs.set(row.id, row);
      return row;
    }

    const db = getDatabase();
    const [last] = await db.select({ revision: creativeBriefs.revision }).from(creativeBriefs).where(eq(creativeBriefs.projectId, projectId)).orderBy(desc(creativeBriefs.revision)).limit(1);
    const revision = (last?.revision ?? 0) + 1;
    const [row] = await db.insert(creativeBriefs).values({ projectId, revision, payload: payload as unknown as Record<string, unknown>, createdBy: owner.id }).returning();
    if (!row) throw new Error("Brief creation failed");
    return mapView(row);
  }

  /** 覆盖某版简报内容并清空确认状态（编辑后需重新确认）。 */
  async update(owner: AuthUser, projectId: string, briefId: string, unknownPayload: unknown): Promise<BriefView> {
    const project = await getProjectRepository().findOwned(projectId, owner.id);
    if (!project) throw new DomainError("NOT_FOUND", 404, "项目不存在或无权访问");
    const payload = briefPayloadSchema.parse(unknownPayload);

    if (!process.env.DATABASE_URL) {
      const row = getMockBrief(briefId, projectId);
      const next: MockBriefRow = { ...row, payload, confirmedAt: null };
      mockBriefs.set(briefId, next);
      return next;
    }

    const db = getDatabase();
    const [row] = await db.update(creativeBriefs).set({ payload: payload as unknown as Record<string, unknown>, confirmedAt: null, updatedAt: new Date() }).where(and(eq(creativeBriefs.id, briefId), eq(creativeBriefs.projectId, projectId))).returning();
    if (!row) throw new DomainError("NOT_FOUND", 404, "简报不存在或无权访问");
    return mapView(row);
  }

  /** 确认某版简报，写入确认时间，供生成链路读取。 */
  async confirm(owner: AuthUser, projectId: string, briefId: string): Promise<BriefView> {
    const project = await getProjectRepository().findOwned(projectId, owner.id);
    if (!project) throw new DomainError("NOT_FOUND", 404, "项目不存在或无权访问");
    const now = new Date();

    if (!process.env.DATABASE_URL) {
      const row = getMockBrief(briefId, projectId);
      const next: MockBriefRow = { ...row, confirmedAt: now.toISOString() };
      mockBriefs.set(briefId, next);
      return next;
    }

    const db = getDatabase();
    const [row] = await db.update(creativeBriefs).set({ confirmedAt: now, updatedAt: now }).where(and(eq(creativeBriefs.id, briefId), eq(creativeBriefs.projectId, projectId))).returning();
    if (!row) throw new DomainError("NOT_FOUND", 404, "简报不存在或无权访问");
    return mapView(row);
  }
}
