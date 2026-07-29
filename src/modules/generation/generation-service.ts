import { and, desc, eq, isNull } from "drizzle-orm";

import { getDatabase } from "@/infrastructure/db/client";
import { creativeBriefs, demoAssets, demoVersions, generationJobs, generationPlans, projects } from "@/infrastructure/db/schema";
import type { AuthUser } from "@/modules/auth/types";
import { getProjectRepository } from "@/modules/projects/project-repository";
import { DomainError } from "@/shared/errors/domain-error";
import type { OutputType } from "@/shared/contracts/domain";
import type { DemoCandidate, DemoVersionView, GenerationResult } from "./generation-types";
import { routeGeneration } from "./provider-router";

interface GenerateInput { brief: { theme: string; mood: string; genre: string; tempo: string }; outputType?: OutputType; idempotencyKey?: string; }

const mockResults = new Map<string, GenerationResult>();
const mockVersionIndex = new Map<string, { projectId: string; ownerId: string; candidate: DemoCandidate; createdAt: string; isMain: boolean }>();

export function getMockVersion(versionId: string) { return mockVersionIndex.get(versionId) ?? null; }

function candidatesFor(versionIds: string[], theme: string): DemoCandidate[] {
  return versionIds.map((versionId, index) => ({ id: crypto.randomUUID(), versionId, title: `${theme.slice(0, 18) || "未命名灵感"} · ${index === 0 ? "抒情版" : "节奏版"}`, variation: index === 0 ? "抒情版" : "节奏版", durationMs: 0, executionKind: "simulated", hasAudio: false }));
}

export class GenerationService {
  async generate(owner: AuthUser, unknownInput: unknown): Promise<GenerationResult> {
    const input = unknownInput as GenerateInput & { projectId?: string };
    if (!input.projectId || !input.brief?.theme?.trim()) throw new DomainError("VALIDATION_FAILED", 422, "创作简报不完整");
    const project = await getProjectRepository().findOwned(input.projectId, owner.id);
    if (!project) throw new DomainError("NOT_FOUND", 404, "项目不存在或无权访问");
    const outputType = input.outputType ?? "song";
    if (!process.env.DATABASE_URL) {
      const idempotencyKey = input.idempotencyKey || crypto.randomUUID();
      const existing = mockResults.get(idempotencyKey);
      if (existing) return existing;
      const versionIds = [crypto.randomUUID(), crypto.randomUUID()];
      const plan = { id: crypto.randomUUID(), ...routeGeneration({ combination: project.combination, outputType, brief: input.brief }), confirmedAt: new Date().toISOString() };
      const candidates = candidatesFor(versionIds, input.brief.theme);
      candidates.forEach((candidate, index) => mockVersionIndex.set(candidate.versionId, { projectId: project.id, ownerId: owner.id, candidate, createdAt: new Date().toISOString(), isMain: index === 0 }));
      const result: GenerationResult = { jobId: crypto.randomUUID(), status: "completed", progress: 100, plan, candidates };
      mockResults.set(idempotencyKey, result);
      return result;
    }

    const db = getDatabase();
    return db.transaction(async (tx) => {
      const [brief] = await tx.insert(creativeBriefs).values({ projectId: project.id, payload: input.brief, confirmedAt: new Date(), createdBy: owner.id }).returning();
      if (!brief) throw new Error("Brief creation failed");
      const generatedPlan = routeGeneration({ combination: project.combination, outputType, brief: input.brief });
      const storedSteps: Record<string, unknown>[] = generatedPlan.steps.map((step) => ({ title: step.title, executionKind: step.executionKind, detail: step.detail, inputs: step.inputs }));
      const [plan] = await tx.insert(generationPlans).values({ projectId: project.id, briefId: brief.id, providerName: generatedPlan.providerName, outputType, combination: project.combination, steps: storedSteps, warnings: generatedPlan.warnings, confirmedAt: new Date() }).returning();
      if (!plan) throw new Error("Plan creation failed");
      const idempotencyKey = input.idempotencyKey || crypto.randomUUID();
      const [job] = await tx.insert(generationJobs).values({ projectId: project.id, planId: plan.id, idempotencyKey, status: "completed", progress: 100, attempt: 1 }).onConflictDoNothing().returning();
      if (!job) throw new DomainError("CONFLICT", 409, "重复的生成请求正在处理");
      const [last] = await tx.select({ versionNo: demoVersions.versionNo }).from(demoVersions).where(eq(demoVersions.projectId, project.id)).orderBy(desc(demoVersions.versionNo)).limit(1);
      const baseVersion = (last?.versionNo ?? 0) + 1;
      const versionRows = await tx.insert(demoVersions).values([0, 1].map((index) => ({ projectId: project.id, versionNo: baseVersion + index, snapshot: { brief: input.brief, plan: generatedPlan, variation: index === 0 ? "抒情版" : "节奏版" }, isMain: index === 0, createdBy: owner.id }))).returning();
      if (versionRows.length !== 2) throw new Error("Version creation failed");
      await tx.update(demoVersions).set({ isMain: false }).where(and(eq(demoVersions.projectId, project.id), isNull(demoVersions.parentId), eq(demoVersions.isMain, true)));
      await tx.update(demoVersions).set({ isMain: true }).where(eq(demoVersions.id, versionRows[0]!.id));
      await tx.insert(demoAssets).values(versionRows.map((version, index) => ({ versionId: version.id, jobId: job.id, objectKey: `mock://demo/${version.id}`, durationMs: 0, executionKind: "simulated" as const, metadata: { title: `${input.brief.theme.slice(0, 18)} · ${index === 0 ? "抒情版" : "节奏版"}`, hasAudio: false } })));
      await tx.update(projects).set({ status: "ready", mainVersionId: versionRows[0]!.id, updatedAt: new Date() }).where(eq(projects.id, project.id));
      return { jobId: job.id, status: "completed", progress: 100, plan: { id: plan.id, ...generatedPlan, confirmedAt: plan.confirmedAt?.toISOString() ?? new Date().toISOString() }, candidates: candidatesFor(versionRows.map((version) => version.id), input.brief.theme) };
    });
  }

  async listVersions(owner: AuthUser, projectId: string): Promise<DemoVersionView[]> {
    const project = await getProjectRepository().findOwned(projectId, owner.id);
    if (!project) throw new DomainError("NOT_FOUND", 404, "项目不存在或无权访问");
    if (!process.env.DATABASE_URL) return [...mockVersionIndex.entries()].filter(([, entry]) => entry.projectId === projectId && entry.ownerId === owner.id).map(([id, entry], index) => ({ id, versionNo: index + 1, title: entry.candidate.title, variation: entry.candidate.variation, isMain: entry.isMain, createdAt: entry.createdAt, executionKind: entry.candidate.executionKind, hasAudio: entry.candidate.hasAudio })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const rows = await getDatabase().select({ id: demoVersions.id, versionNo: demoVersions.versionNo, isMain: demoVersions.isMain, createdAt: demoVersions.createdAt, snapshot: demoVersions.snapshot, executionKind: demoAssets.executionKind, metadata: demoAssets.metadata }).from(demoVersions).leftJoin(demoAssets, eq(demoAssets.versionId, demoVersions.id)).where(eq(demoVersions.projectId, projectId)).orderBy(desc(demoVersions.versionNo));
    return rows.map((row) => ({ id: row.id, versionNo: row.versionNo, title: String(row.metadata?.title || `版本 V${row.versionNo}`), variation: String(row.snapshot.variation || "Demo"), isMain: row.isMain, createdAt: row.createdAt.toISOString(), executionKind: row.executionKind || "simulated", hasAudio: Boolean(row.metadata?.hasAudio) }));
  }

  async setMain(owner: AuthUser, projectId: string, versionId: string) {
    const project = await getProjectRepository().findOwned(projectId, owner.id);
    if (!project) throw new DomainError("NOT_FOUND", 404, "项目不存在或无权访问");
    if (!process.env.DATABASE_URL) {
      const version = mockVersionIndex.get(versionId);
      if (!version || version.ownerId !== owner.id || version.projectId !== projectId) throw new DomainError("NOT_FOUND", 404, "版本不存在");
      mockVersionIndex.forEach((entry) => { if (entry.projectId === projectId) entry.isMain = false; }); version.isMain = true;
      return { versionId };
    }
    const db = getDatabase();
    return db.transaction(async (tx) => { const [version] = await tx.select({ id: demoVersions.id }).from(demoVersions).where(and(eq(demoVersions.id, versionId), eq(demoVersions.projectId, projectId))).limit(1); if (!version) throw new DomainError("NOT_FOUND", 404, "版本不存在"); await tx.update(demoVersions).set({ isMain: false }).where(eq(demoVersions.projectId, projectId)); await tx.update(demoVersions).set({ isMain: true }).where(eq(demoVersions.id, versionId)); await tx.update(projects).set({ mainVersionId: versionId, updatedAt: new Date() }).where(eq(projects.id, projectId)); return { versionId }; });
  }
}
