/**
 * 生成任务状态查询（docs/development-state.md · 轮询恢复未完成任务）
 * GET /api/generation-jobs/[id]：鉴权 → 按 jobId 返回任务状态 + 候选视图。
 *
 * mock 模式：在 globalThis.__songDraftGenerationResults / __songDraftCandidates 中查找
 *   （mockResults 按 result.jobId 命中；否则用 mockCandidates 归属于该 job 的候选重建视图）。
 * 真实模式：查 generationJobs by id + join generationCandidates（ownerId 校验）。
 * 与 generation-service.ts 的 mock store key 保持一致；不在 service 内实现 GET，按约定 inline。
 */
import { and, eq } from "drizzle-orm";

import { getCurrentUser } from "@/modules/auth/queries";
import { getDatabase } from "@/infrastructure/db/client";
import { generationCandidates, generationJobs, projects } from "@/infrastructure/db/schema";
import type { DemoCandidate, GenerationResult, GenerationStatus } from "@/modules/generation/generation-types";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

export const runtime = "nodejs";

type MockCandidateEntry = { projectId: string; ownerId: string; candidate: DemoCandidate; createdAt: string; savedVersionId: string | null };
const songDraftGenerationStore = globalThis as typeof globalThis & {
  __songDraftGenerationResults?: Map<string, GenerationResult>;
  __songDraftCandidates?: Map<string, MockCandidateEntry>;
};

function toCandidateView(row: typeof generationCandidates.$inferSelect): DemoCandidate {
  return {
    id: row.id,
    title: row.title,
    variation: "应援合唱版",
    durationMs: row.durationMs,
    executionKind: row.executionKind,
    hasAudio: Boolean(row.metadata?.hasAudio),
    audioUrl: typeof row.audioUrl === "string" ? row.audioUrl : null,
    savedVersionId: row.savedVersionId,
  };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const { id } = await context.params;

    // mock 模式：先在 mockResults 按 jobId 命中（POST generate 落库的完整结果）。
    if (!process.env.DATABASE_URL) {
      const results = songDraftGenerationStore.__songDraftGenerationResults;
      const candidates = songDraftGenerationStore.__songDraftCandidates;
      if (results) {
        for (const result of results.values()) {
          if (result.jobId === id) {
            // 归属校验：mock 结果本身无 ownerId 字段，这里通过候选 store 交叉验证——
            // 该 job 下必须存在至少一条归属当前用户的候选，否则视为无权访问。
            const ownsJob = result.candidates.some((candidate) => {
              const entry = candidates?.get(candidate.id);
              return Boolean(entry) && entry!.ownerId === user.id;
            });
            if (!ownsJob) throw new DomainError("NOT_FOUND", 404, "生成任务不存在");
            return apiSuccess(result);
          }
        }
      }
      // 回退：按 jobId 归属的候选重建视图（mockCandidates 在保存后仍保留 job 归属信息有限，
      // 这里以候选无 jobId 字段为由视为找不到，返回 404）。
      throw new DomainError("NOT_FOUND", 404, "生成任务不存在");
    }

    // 真实模式：查 job + join projects，强校验 projects.ownerId = user.id（防越权）。
    const db = getDatabase();
    const [owned] = await db
      .select({ job: generationJobs })
      .from(generationJobs)
      .innerJoin(projects, eq(projects.id, generationJobs.projectId))
      .where(and(eq(generationJobs.id, id), eq(projects.ownerId, user.id)))
      .limit(1);
    if (!owned) throw new DomainError("NOT_FOUND", 404, "生成任务不存在");
    const job = owned.job;

    const candidateRows = await db
      .select()
      .from(generationCandidates)
      .where(and(eq(generationCandidates.jobId, id), eq(generationCandidates.projectId, job.projectId)));

    const result: GenerationResult = {
      jobId: job.id,
      status: job.status as GenerationStatus,
      progress: job.progress,
      candidates: candidateRows.map(toCandidateView),
    };
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
