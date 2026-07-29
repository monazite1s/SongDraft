/**
 * Demo 生成与版本流程（docs/SPEC.md 制作台；docs/technical-design.md §4）
 *
 * generate：校验项目与歌词 → MusicGenerator → 写入 Brief/Job/Version/Asset，并设为主版本。
 * 另含 listVersions / setMain / restore。入口：POST /api/generation-jobs。
 */
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDatabase } from "@/infrastructure/db/client";
import { creativeBriefs, demoAssets, demoVersions, generationJobs, generationPlans, projects } from "@/infrastructure/db/schema";
import type { AuthUser } from "@/modules/auth/types";
import { getProjectRepository } from "@/modules/projects/project-repository";
import { DomainError } from "@/shared/errors/domain-error";
import type { DemoCandidate, DemoVersionView, GenerationResult } from "./generation-types";
import { getMusicGenerator, type GeneratedDemo } from "./music-generator";
import { routeGeneration } from "./provider-router";
import { buildMusicPrompt } from "@/modules/ai/prompts";

const generateSchema = z.object({
  projectId: z.string().uuid(),
  lyrics: z.string().trim().min(1).max(10_000).optional(),
  creativeContext: z.record(z.string(), z.unknown()).optional(),
  hummingAssetId: z.string().uuid().nullable().optional(),
  idempotencyKey: z.string().min(8).max(120).optional(),
  brief: z.object({ theme: z.string().min(1), mood: z.string(), genre: z.string(), tempo: z.string() }).optional(),
});

type MockVersionEntry = { projectId: string; ownerId: string; candidate: DemoCandidate; createdAt: string; isMain: boolean; versionNo: number; snapshot: Record<string, unknown> };
const songDraftGenerationStore = globalThis as typeof globalThis & {
  __songDraftGenerationResults?: Map<string, GenerationResult>;
  __songDraftVersionIndex?: Map<string, MockVersionEntry>;
};
const mockResults = songDraftGenerationStore.__songDraftGenerationResults ??= new Map<string, GenerationResult>();
const mockVersionIndex = songDraftGenerationStore.__songDraftVersionIndex ??= new Map<string, MockVersionEntry>();

export function getMockVersion(versionId: string) { return mockVersionIndex.get(versionId) ?? null; }

function candidateFor(versionId: string, title: string, generated: GeneratedDemo = { audioUrl: null, durationMs: 12_000, executionKind: "simulated", providerLabel: "SongDraft Mock" }): DemoCandidate {
  return { id: crypto.randomUUID(), versionId, title, variation: "应援合唱版", durationMs: generated.durationMs, executionKind: generated.executionKind, hasAudio: Boolean(generated.audioUrl), audioUrl: generated.audioUrl };
}

export class GenerationService {
  /** 生成一首 Demo 并落为线性新版本（幂等键可避免重复提交）。 */
  async generate(owner: AuthUser, unknownInput: unknown): Promise<GenerationResult> {
    const input = generateSchema.parse(unknownInput);
    const project = await getProjectRepository().findOwned(input.projectId, owner.id);
    if (!project) throw new DomainError("NOT_FOUND", 404, "项目不存在或无权访问");
    const lyrics = input.lyrics ?? project.lyrics;
    if (!lyrics?.trim()) throw new DomainError("VALIDATION_FAILED", 422, "请先准备歌词");
    const theme = input.brief?.theme ?? `${project.artist?.name ?? "SongDraft"}应援歌`;
    const idempotencyKey = input.idempotencyKey || crypto.randomUUID();
    if (!process.env.DATABASE_URL) { const existing = mockResults.get(idempotencyKey); if (existing) return existing; }
    // 调用 MiniMax/Mock；prompt 经 Prompt Registry 组装，Route Handler 不拼接系统文案
    const generated = await getMusicGenerator().create({ projectId: project.id, lyrics, prompt: buildMusicPrompt({ theme, description: project.description, emotion: input.creativeContext?.emotion, genre: input.brief?.genre, tempo: input.brief?.tempo }), creativeContext: input.creativeContext ?? project.creativeContext, hummingAssetId: input.hummingAssetId });
    if (!process.env.DATABASE_URL) {
      const versionId = crypto.randomUUID();
      const versionNo = [...mockVersionIndex.values()].filter((item) => item.projectId === project.id).length + 1;
      const candidate = candidateFor(versionId, `${theme} · V${versionNo}`, generated);
      mockVersionIndex.forEach((entry) => { if (entry.projectId === project.id) entry.isMain = false; });
      mockVersionIndex.set(versionId, { projectId: project.id, ownerId: owner.id, candidate, createdAt: new Date().toISOString(), isMain: true, versionNo, snapshot: { lyrics, creativeContext: input.creativeContext ?? project.creativeContext } });
      const result = { jobId: crypto.randomUUID(), status: "completed" as const, progress: 100, candidates: [candidate] };
      mockResults.set(idempotencyKey, result); return result;
    }

    const db = getDatabase();
    return db.transaction(async (tx) => {
      const briefPayload = input.brief ?? { theme, mood: "温暖坚定", genre: "流行合唱", tempo: "中速", lyrics, ...input.creativeContext };
      const [brief] = await tx.insert(creativeBriefs).values({ projectId: project.id, payload: briefPayload, confirmedAt: new Date(), createdBy: owner.id }).returning();
      if (!brief) throw new Error("Brief creation failed");
      const internalPlan = routeGeneration({ combination: project.combination, outputType: "song", brief: { theme, genre: String(briefPayload.genre), tempo: String(briefPayload.tempo) } });
      const [plan] = await tx.insert(generationPlans).values({ projectId: project.id, briefId: brief.id, providerName: internalPlan.providerName, outputType: "song", combination: project.combination, steps: internalPlan.steps.map((step) => ({ title: step.title, executionKind: step.executionKind, detail: step.detail })), warnings: internalPlan.warnings, confirmedAt: new Date() }).returning();
      if (!plan) throw new Error("Plan creation failed");
      const [job] = await tx.insert(generationJobs).values({ projectId: project.id, planId: plan.id, idempotencyKey, status: "completed", progress: 100, attempt: 1 }).onConflictDoNothing().returning();
      if (!job) throw new DomainError("CONFLICT", 409, "重复的生成请求正在处理");
      const [last] = await tx.select({ versionNo: demoVersions.versionNo }).from(demoVersions).where(eq(demoVersions.projectId, project.id)).orderBy(desc(demoVersions.versionNo)).limit(1);
      const versionNo = (last?.versionNo ?? 0) + 1;
      await tx.update(demoVersions).set({ isMain: false }).where(eq(demoVersions.projectId, project.id));
      const [version] = await tx.insert(demoVersions).values({ projectId: project.id, versionNo, snapshot: { lyrics, creativeContext: input.creativeContext ?? project.creativeContext, variation: "应援合唱版" }, isMain: true, createdBy: owner.id }).returning();
      if (!version) throw new Error("Version creation failed");
      const title = `${theme} · V${versionNo}`;
      await tx.insert(demoAssets).values({ versionId: version.id, jobId: job.id, objectKey: generated.audioUrl ? `external://minimax/${version.id}` : `mock://demo/${version.id}`, durationMs: generated.durationMs, executionKind: generated.executionKind, metadata: { title, hasAudio: Boolean(generated.audioUrl), audioUrl: generated.audioUrl, providerLabel: generated.providerLabel } });
      await tx.update(projects).set({ status: "ready", mainVersionId: version.id, currentLyrics: lyrics, updatedAt: new Date() }).where(eq(projects.id, project.id));
      return { jobId: job.id, status: "completed", progress: 100, candidates: [candidateFor(version.id, title, generated)] };
    });
  }

  /** 项目内版本列表（创作库按项目维度展示，版本归属同一首歌）。 */
  async listVersions(owner: AuthUser, projectId: string): Promise<DemoVersionView[]> {
    const project = await getProjectRepository().findOwned(projectId, owner.id);
    if (!project) throw new DomainError("NOT_FOUND", 404, "项目不存在或无权访问");
    if (!process.env.DATABASE_URL) return [...mockVersionIndex.entries()].filter(([, entry]) => entry.projectId === projectId && entry.ownerId === owner.id).map(([id, entry]) => ({ id, versionNo: entry.versionNo, title: entry.candidate.title, variation: entry.candidate.variation, isMain: entry.isMain, createdAt: entry.createdAt, executionKind: entry.candidate.executionKind, hasAudio: entry.candidate.hasAudio, audioUrl: entry.candidate.audioUrl, restoredFromVersionId: typeof entry.snapshot.restoredFromVersionId === "string" ? entry.snapshot.restoredFromVersionId : null })).sort((a, b) => b.versionNo - a.versionNo);
    const rows = await getDatabase().select({ id: demoVersions.id, versionNo: demoVersions.versionNo, isMain: demoVersions.isMain, createdAt: demoVersions.createdAt, snapshot: demoVersions.snapshot, executionKind: demoAssets.executionKind, metadata: demoAssets.metadata }).from(demoVersions).leftJoin(demoAssets, eq(demoAssets.versionId, demoVersions.id)).where(eq(demoVersions.projectId, projectId)).orderBy(desc(demoVersions.versionNo));
    return rows.map((row) => ({ id: row.id, versionNo: row.versionNo, title: String(row.metadata?.title || `版本 V${row.versionNo}`), variation: String(row.snapshot.variation || "Demo"), isMain: row.isMain, createdAt: row.createdAt.toISOString(), executionKind: row.executionKind || "simulated", hasAudio: Boolean(row.metadata?.hasAudio), audioUrl: typeof row.metadata?.audioUrl === "string" ? row.metadata.audioUrl : null, restoredFromVersionId: typeof row.snapshot.restoredFromVersionId === "string" ? row.snapshot.restoredFromVersionId : null }));
  }

  async getCurrentAudio(owner: AuthUser, projectId: string) {
    const versions = await this.listVersions(owner, projectId);
    const current = versions.find((version) => version.isMain) ?? versions[0];
    return current?.audioUrl ? { url: current.audioUrl, executionKind: current.executionKind } : null;
  }

  /** 将选中版本设为主版本（制作台「应用」的数据侧入口之一）。 */
  async setMain(owner: AuthUser, projectId: string, versionId: string) {
    const project = await getProjectRepository().findOwned(projectId, owner.id);
    if (!project) throw new DomainError("NOT_FOUND", 404, "项目不存在或无权访问");
    if (!process.env.DATABASE_URL) { const version = mockVersionIndex.get(versionId); if (!version || version.ownerId !== owner.id || version.projectId !== projectId) throw new DomainError("NOT_FOUND", 404, "版本不存在"); mockVersionIndex.forEach((entry) => { if (entry.projectId === projectId) entry.isMain = false; }); version.isMain = true; return { versionId }; }
    const db = getDatabase();
    return db.transaction(async (tx) => { const [version] = await tx.select({ id: demoVersions.id }).from(demoVersions).where(and(eq(demoVersions.id, versionId), eq(demoVersions.projectId, projectId))).limit(1); if (!version) throw new DomainError("NOT_FOUND", 404, "版本不存在"); await tx.update(demoVersions).set({ isMain: false }).where(eq(demoVersions.projectId, projectId)); await tx.update(demoVersions).set({ isMain: true }).where(eq(demoVersions.id, versionId)); await tx.update(projects).set({ mainVersionId: versionId, updatedAt: new Date() }).where(eq(projects.id, projectId)); return { versionId }; });
  }

  /** 从历史版本复制出新版本并设为主，保留 restoredFromVersionId。 */
  async restore(owner: AuthUser, projectId: string, sourceVersionId: string): Promise<DemoVersionView> {
    const project = await getProjectRepository().findOwned(projectId, owner.id);
    if (!project) throw new DomainError("NOT_FOUND", 404, "项目不存在或无权访问");
    if (!process.env.DATABASE_URL) {
      const source = mockVersionIndex.get(sourceVersionId); if (!source || source.projectId !== projectId || source.ownerId !== owner.id) throw new DomainError("NOT_FOUND", 404, "版本不存在");
      const id = crypto.randomUUID(); const versionNo = Math.max(0, ...[...mockVersionIndex.values()].filter((item) => item.projectId === projectId).map((item) => item.versionNo)) + 1;
      mockVersionIndex.forEach((entry) => { if (entry.projectId === projectId) entry.isMain = false; });
      const candidate = candidateFor(id, `${source.candidate.title.replace(/ · V\d+$/, "")} · V${versionNo}`, { audioUrl: source.candidate.audioUrl ?? null, durationMs: source.candidate.durationMs, executionKind: source.candidate.executionKind, providerLabel: source.candidate.executionKind === "real_external" ? "MiniMax Music" : "SongDraft Mock" });
      mockVersionIndex.set(id, { ...source, candidate, versionNo, isMain: true, createdAt: new Date().toISOString(), snapshot: { ...source.snapshot, restoredFromVersionId: sourceVersionId } });
      return { id, versionNo, title: candidate.title, variation: candidate.variation, isMain: true, createdAt: new Date().toISOString(), executionKind: candidate.executionKind, hasAudio: candidate.hasAudio, audioUrl: candidate.audioUrl, restoredFromVersionId: sourceVersionId };
    }
    const db = getDatabase();
    return db.transaction(async (tx) => {
      const [source] = await tx.select({ snapshot: demoVersions.snapshot, metadata: demoAssets.metadata, objectKey: demoAssets.objectKey, durationMs: demoAssets.durationMs, executionKind: demoAssets.executionKind }).from(demoVersions).leftJoin(demoAssets, eq(demoAssets.versionId, demoVersions.id)).where(and(eq(demoVersions.id, sourceVersionId), eq(demoVersions.projectId, projectId))).limit(1);
      if (!source) throw new DomainError("NOT_FOUND", 404, "版本不存在");
      const [last] = await tx.select({ versionNo: demoVersions.versionNo }).from(demoVersions).where(eq(demoVersions.projectId, projectId)).orderBy(desc(demoVersions.versionNo)).limit(1); const versionNo = (last?.versionNo ?? 0) + 1;
      await tx.update(demoVersions).set({ isMain: false }).where(eq(demoVersions.projectId, projectId));
      const [version] = await tx.insert(demoVersions).values({ projectId, versionNo, snapshot: { ...source.snapshot, restoredFromVersionId: sourceVersionId }, isMain: true, createdBy: owner.id }).returning(); if (!version) throw new Error("Version restore failed");
      await tx.insert(demoAssets).values({ versionId: version.id, objectKey: source.objectKey || `mock://demo/${version.id}`, durationMs: source.durationMs ?? 12_000, executionKind: source.executionKind ?? "simulated", metadata: { ...source.metadata, title: `${String(source.metadata?.title || project.title).replace(/ · V\d+$/, "")} · V${versionNo}` } });
      await tx.update(projects).set({ mainVersionId: version.id, updatedAt: new Date() }).where(eq(projects.id, projectId));
      return { id: version.id, versionNo, title: `${String(source.metadata?.title || project.title).replace(/ · V\d+$/, "")} · V${versionNo}`, variation: String(source.snapshot.variation || "Demo"), isMain: true, createdAt: version.createdAt.toISOString(), executionKind: source.executionKind ?? "simulated", hasAudio: Boolean(source.metadata?.hasAudio), audioUrl: typeof source.metadata?.audioUrl === "string" ? source.metadata.audioUrl : null, restoredFromVersionId: sourceVersionId };
    });
  }
}
