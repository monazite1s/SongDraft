/**
 * Demo 生成与版本流程（docs/SPEC.md 制作台 §7.4；docs/technical-design.md §4）
 *
 * 候选 / 版本拆分：
 * - generate：校验项目与歌词 → MusicGenerator（按 quantity 批量，受控并发）→ 写入
 *   Brief/Plan/Job/Candidate，返回「未保存候选」，不创建 demo_versions。
 * - saveCandidates：将选中候选事务转为正式版本（demo_versions + demo_assets）并回填
 *   savedVersionId，首个保存项设为主版本。
 * - listVersions / setMain / restore / delete：作用于已保存版本。
 * 入口：POST /api/generation-jobs、POST /api/generation-candidates/save。
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDatabase } from "@/infrastructure/db/client";
import {
  creativeBriefs,
  demoAssets,
  demoVersions,
  generationCandidates,
  generationJobs,
  generationPlans,
  projects,
} from "@/infrastructure/db/schema";
import type { AuthUser } from "@/modules/auth/types";
import { getProjectRepository } from "@/modules/projects/project-repository";
import { DomainError } from "@/shared/errors/domain-error";
import type { DemoCandidate, DemoVersionView, GenerationResult, RecentSongItem, RestoreVersionResult, SaveCandidatesResult } from "./generation-types";
import { getMusicGenerator, type GeneratedDemo, type MusicGenerationInput } from "./music-generator";
import { routeGeneration } from "./provider-router";
import { PROMPT_REGISTRY, buildMusicPrompt } from "@/modules/ai/prompts";
import type { BriefPayload } from "@/modules/ai/brief-generator";
import { isRealCosInUse, resolveAudioUrl, transferAudioToStorage } from "@/infrastructure/storage/transfer";

const generateSchema = z.object({
  projectId: z.string().uuid(),
  briefId: z.string().uuid(),
  lyrics: z.string().trim().min(1).max(10_000).optional(),
  hummingAssetId: z.string().uuid().nullable().optional(),
  idempotencyKey: z.string().min(8).max(120).optional(),
});

/** 读取（mock）简报存储——由 BriefService 写入，生成时按 briefId 读取参数。 */
const songDraftBriefStore = globalThis as typeof globalThis & { __songDraftBriefs?: Map<string, { projectId: string; payload: BriefPayload }> };

function readBriefPayload(briefId: string, projectId: string): BriefPayload {
  const brief = songDraftBriefStore.__songDraftBriefs?.get(briefId);
  if (!brief || brief.projectId !== projectId) throw new DomainError("NOT_FOUND", 404, "简报不存在或无权访问");
  return brief.payload;
}

const saveCandidatesSchema = z.object({
  projectId: z.string().uuid(),
  candidateIds: z.array(z.string().uuid()).min(1).max(20),
});

type MockVersionEntry = { projectId: string; ownerId: string; candidate: DemoCandidate; createdAt: string; isMain: boolean; versionNo: number; snapshot: Record<string, unknown> };
type MockCandidateEntry = { projectId: string; ownerId: string; candidate: DemoCandidate; createdAt: string; savedVersionId: string | null };
const songDraftGenerationStore = globalThis as typeof globalThis & {
  __songDraftGenerationResults?: Map<string, GenerationResult>;
  __songDraftVersionIndex?: Map<string, MockVersionEntry>;
  __songDraftCandidates?: Map<string, MockCandidateEntry>;
};
const mockResults = songDraftGenerationStore.__songDraftGenerationResults ??= new Map<string, GenerationResult>();
const mockVersionIndex = songDraftGenerationStore.__songDraftVersionIndex ??= new Map<string, MockVersionEntry>();
const mockCandidates = songDraftGenerationStore.__songDraftCandidates ??= new Map<string, MockCandidateEntry>();

export function getMockVersion(versionId: string) { return mockVersionIndex.get(versionId) ?? null; }

function candidateLabel(theme: string, quantity: number, index: number) {
  const suffix = quantity > 1 ? ` 候选 ${String.fromCharCode(65 + index)}` : "";
  return `${theme}${suffix}`.trim();
}

function buildCandidate(id: string, title: string, generated: GeneratedDemo): DemoCandidate {
  return { id, title, variation: "应援合唱版", durationMs: generated.durationMs, executionKind: generated.executionKind, hasAudio: Boolean(generated.audioUrl), audioUrl: generated.audioUrl, savedVersionId: null };
}

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

/** 受控并发（最多 2）执行批量生成，避免 Provider 拥塞。 */
async function generateDemos(quantity: number, input: MusicGenerationInput): Promise<GeneratedDemo[]> {
  const indices = Array.from({ length: quantity }, (_, i) => i);
  const results = new Array<GeneratedDemo>(quantity);
  let cursor = 0;
  const worker = async () => {
    while (cursor < indices.length) {
      const index = cursor++;
      results[index] = await getMusicGenerator().create(input);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(2, quantity)) }, () => worker()));
  return results;
}

/**
 * 计算 git 式版本标签（兄弟命名）：
 * - 主链（每代首个子节点）v1→v2→v3 递增；
 * - 同一代的分叉分支与主链子节点同级，命名 v{N}.1 / v{N}.2 …（N = 该代主链编号）。
 *   例：v1 的子代为 v2（主链）、v2.1、v2.2（回退 v1 后保存产生的兄弟分支）。
 * parentId 悬空（指向已删/不存在版本）的节点回退为根，消除游离。
 */
function computeVersionLabels(versions: DemoVersionView[]): Map<string, string> {
  const byId = new Map(versions.map((v) => [v.id, v]));
  const childrenOf = new Map<string, DemoVersionView[]>();
  const roots: DemoVersionView[] = [];
  for (const v of versions) {
    const pid = v.parentId && byId.has(v.parentId) ? v.parentId : null;
    if (!pid) roots.push(v);
    else {
      const arr = childrenOf.get(pid) ?? [];
      arr.push(v);
      childrenOf.set(pid, arr);
    }
  }
  const sortAsc = (a: DemoVersionView, b: DemoVersionView) => a.versionNo - b.versionNo;
  roots.sort(sortAsc);
  for (const arr of childrenOf.values()) arr.sort(sortAsc);
  const labels = new Map<string, string>();
  const bump = (label: string): string => {
    const parts = label.replace(/^v/, "").split(".");
    parts[parts.length - 1] = String(Number(parts[parts.length - 1]) + 1);
    return `v${parts.join(".")}`;
  };
  const assign = (node: DemoVersionView, label: string) => {
    labels.set(node.id, label);
    const kids = childrenOf.get(node.id) ?? [];
    if (kids.length === 0) return;
    // 首个子节点延续主链（v1→v2）；其余为兄弟分支，与主链子节点同代，命名 v{N}.1/v{N}.2…
    const trunkChild = bump(label);
    kids.forEach((kid, idx) => {
      assign(kid, idx === 0 ? trunkChild : `${trunkChild}.${idx}`);
    });
  };
  roots.forEach((root, i) => assign(root, `v${i + 1}`));
  return labels;
}

export class GenerationService {
  /** 依据已确认简报（briefId）按 quantity 生成 N 条候选并落库（不创建正式版本）。 */
  async generate(owner: AuthUser, unknownInput: unknown): Promise<GenerationResult> {
    const input = generateSchema.parse(unknownInput);
    const project = await getProjectRepository().findOwned(input.projectId, owner.id);
    if (!project) throw new DomainError("NOT_FOUND", 404, "项目不存在或无权访问");
    const lyrics = input.lyrics ?? project.lyrics;
    if (!lyrics?.trim()) throw new DomainError("VALIDATION_FAILED", 422, "请先准备歌词");
    const idempotencyKey = input.idempotencyKey || crypto.randomUUID();

    // 从已确认简报读取主题、风格与生成参数（outputType/extraPrompt/quantity）。
    const briefPayload = process.env.DATABASE_URL
      ? await this.loadBriefPayload(input.briefId, input.projectId)
      : readBriefPayload(input.briefId, input.projectId);
    const theme = briefPayload.theme;
    const quantity = briefPayload.quantity;
    const musicInput: MusicGenerationInput = {
      projectId: project.id,
      lyrics,
      prompt: buildMusicPrompt({
        theme,
        description: project.description,
        emotion: briefPayload.mood.join("、"),
        genre: briefPayload.genre,
        tempo: briefPayload.tempo,
        extraPrompt: briefPayload.extraPrompt,
        instruments: briefPayload.instruments,
        melodyFeatures: briefPayload.melodyFeatures,
        visualReferences: briefPayload.visualReferences,
        priority: briefPayload.priority,
        outputType: briefPayload.outputType,
      }),
      creativeContext: project.creativeContext,
      hummingAssetId: input.hummingAssetId,
    };
    // 音乐生成在事务外完成，避免长 HTTP 调用占用数据库事务。
    const demos = await generateDemos(quantity, musicInput);

    // 真实库模式：把 MiniMax 返回的临时 HTTPS 音频转存到私有 COS（仅 COS 可用时）。
    // 失败回退到原 MiniMax URL（记 warn，不中断生成），保证可用性。转存在事务外完成。
    // 与 demos 索引对齐：cosObjectKeys[i] 为转存后的真实 COS key（null 表示未转存，回退临时 URL）。
    const cosObjectKeys: (string | null)[] = demos.map(() => null);
    if (isRealCosInUse()) {
      await Promise.all(
        demos.map(async (demo, index) => {
          if (!demo.audioUrl) return;
          try {
            const key = await transferAudioToStorage(demo.audioUrl, `generated/${crypto.randomUUID()}.mp3`);
            cosObjectKeys[index] = key;
            // 用 COS 签名 URL 替换临时 URL：mock 模式（不经 listVersions 解析）也能直接播放真实音频，
            // 真实库模式则额外存 objectKey 供读取时重新签发。
            demo.audioUrl = await resolveAudioUrl(key, demo.audioUrl);
          } catch (error) {
            console.warn(`[generation] 音频转存 COS 失败，回退到 MiniMax 临时 URL：`, error);
          }
        }),
      );
    }

    if (!process.env.DATABASE_URL) {
      const existing = mockResults.get(idempotencyKey);
      if (existing) return existing;
      const now = new Date().toISOString();
      const candidates: DemoCandidate[] = demos.map((demo, index) => buildCandidate(crypto.randomUUID(), candidateLabel(theme, quantity, index), demo));
      candidates.forEach((candidate) => mockCandidates.set(candidate.id, { projectId: project.id, ownerId: owner.id, candidate, createdAt: now, savedVersionId: null }));
      const result: GenerationResult = { jobId: crypto.randomUUID(), status: "completed", progress: 100, candidates };
      mockResults.set(idempotencyKey, result);
      return result;
    }

    const db = getDatabase();
    return db.transaction(async (tx) => {
      // 简报用别名 melody，生成计划统一为 canonical melody_sketch（重命名记为 P0 todo）。
      const routeOutputType = briefPayload.outputType === "melody" ? "melody_sketch" : briefPayload.outputType;
      const internalPlan = routeGeneration({ combination: project.combination, outputType: routeOutputType, brief: { theme, genre: briefPayload.genre, tempo: briefPayload.tempo } });
      const [plan] = await tx.insert(generationPlans).values({
        projectId: project.id,
        briefId: input.briefId,
        providerName: internalPlan.providerName,
        outputType: routeOutputType,
        combination: project.combination,
        steps: internalPlan.steps.map((step) => ({ title: step.title, executionKind: step.executionKind, detail: step.detail })),
        warnings: internalPlan.warnings,
      }).returning();
      if (!plan) throw new Error("Plan creation failed");
      const [job] = await tx.insert(generationJobs).values({ projectId: project.id, planId: plan.id, idempotencyKey, status: "completed", progress: 100, attempt: 1 }).onConflictDoNothing().returning();
      if (!job) throw new DomainError("CONFLICT", 409, "重复的生成请求正在处理");
      const rows = await tx.insert(generationCandidates).values(
        demos.map((demo, index) => {
          const cosKey = cosObjectKeys[index];
          // 转存成功 → 用真实 COS key 替换 external:// 占位；否则保留原占位逻辑。
          const objectKey = demo.audioUrl
            ? (cosKey ?? `external://minimax/${job.id}/${index}`)
            : `mock://demo/${job.id}/${index}`;
          return {
            jobId: job.id,
            projectId: project.id,
            ownerId: owner.id,
            title: candidateLabel(theme, quantity, index),
            objectKey,
            audioUrl: demo.audioUrl,
            durationMs: demo.durationMs,
            executionKind: demo.executionKind,
            // 落库 prompt 版本（PROMPT_REGISTRY.music.version）与模型名，供审计与回放。
            promptVersion: PROMPT_REGISTRY.music.version,
            modelVersion: process.env.MINIMAX_MUSIC_MODEL ?? "music-2.6",
            // cosObjectKey 记录真实 COS key，读取时据此生成签名 URL；audioUrl 保留 MiniMax 临时 URL 作 fallback。
            metadata: { hasAudio: Boolean(demo.audioUrl), audioUrl: demo.audioUrl, cosObjectKey: cosKey, providerLabel: demo.providerLabel, outputType: routeOutputType, extraPrompt: briefPayload.extraPrompt, quantity },
          };
        }),
      ).returning();
      await tx.update(projects).set({ status: "review", currentLyrics: lyrics, updatedAt: new Date() }).where(eq(projects.id, project.id));
      return { jobId: job.id, status: "completed" as const, progress: 100, candidates: rows.map(toCandidateView) };
    });
  }

  /** 真实库：按 briefId + 项目归属读取已确认简报内容（含生成参数）。 */
  private async loadBriefPayload(briefId: string, projectId: string): Promise<BriefPayload> {
    const [row] = await getDatabase().select().from(creativeBriefs).where(and(eq(creativeBriefs.id, briefId), eq(creativeBriefs.projectId, projectId))).limit(1);
    if (!row) throw new DomainError("NOT_FOUND", 404, "简报不存在或无权访问");
    return row.payload as unknown as BriefPayload;
  }

  /** 将选中的未保存候选事务转为正式版本（首个设为主版本），回填 savedVersionId。 */
  async saveCandidates(owner: AuthUser, unknownInput: unknown): Promise<SaveCandidatesResult> {
    const input = saveCandidatesSchema.parse(unknownInput);
    const project = await getProjectRepository().findOwned(input.projectId, owner.id);
    if (!project) throw new DomainError("NOT_FOUND", 404, "项目不存在或无权访问");

    if (!process.env.DATABASE_URL) {
      const saved: DemoVersionView[] = [];
      // 同一批保存的候选互为兄弟节点，父节点为保存前的当前主版本（无则为空）。
      const parentId = [...mockVersionIndex.entries()].find(([, item]) => item.projectId === input.projectId && item.isMain)?.[0] ?? null;
      for (const candidateId of input.candidateIds) {
        const entry = mockCandidates.get(candidateId);
        if (!entry || entry.ownerId !== owner.id || entry.projectId !== input.projectId) throw new DomainError("NOT_FOUND", 404, "候选不存在或无权访问");
        if (entry.savedVersionId) {
          const existing = mockVersionIndex.get(entry.savedVersionId);
          if (existing) saved.push(this.toVersionView(entry.savedVersionId, existing));
          continue;
        }
        const versionId = crypto.randomUUID();
        const versionNo = [...mockVersionIndex.values()].filter((item) => item.projectId === input.projectId).length + 1;
        if (saved.length === 0) mockVersionIndex.forEach((item) => { if (item.projectId === input.projectId) item.isMain = false; });
        const candidate = entry.candidate;
        mockVersionIndex.set(versionId, { projectId: input.projectId, ownerId: owner.id, candidate: { ...candidate, id: versionId }, createdAt: new Date().toISOString(), isMain: saved.length === 0, versionNo, snapshot: { lyrics: project.lyrics, variation: candidate.variation, parentId } });
        entry.savedVersionId = versionId;
        saved.push({ id: versionId, versionNo, title: candidate.title, variation: candidate.variation, isMain: saved.length === 0, createdAt: new Date().toISOString(), executionKind: candidate.executionKind, hasAudio: candidate.hasAudio, audioUrl: candidate.audioUrl });
      }
      return { saved };
    }

    const db = getDatabase();
    const saved = await db.transaction(async (tx) => {
      const rows = await tx.select().from(generationCandidates).where(and(eq(generationCandidates.projectId, input.projectId), inArray(generationCandidates.id, input.candidateIds)));
      if (rows.length !== input.candidateIds.length) throw new DomainError("NOT_FOUND", 404, "候选不存在或无权访问");
      // 同一批候选互为兄弟节点：父节点为保存前的当前主版本（无则为空）。
      const [currentMain] = await tx.select({ id: demoVersions.id }).from(demoVersions).where(and(eq(demoVersions.projectId, input.projectId), eq(demoVersions.isMain, true))).limit(1);
      const parentId = currentMain?.id ?? null;
      await tx.update(demoVersions).set({ isMain: false }).where(eq(demoVersions.projectId, input.projectId));
      const out: DemoVersionView[] = [];
      for (const candidateRow of rows) {
        if (candidateRow.ownerId !== owner.id) throw new DomainError("FORBIDDEN", 403, "无权保存该候选");
        if (candidateRow.savedVersionId) {
          const [existing] = await tx.select().from(demoVersions).where(eq(demoVersions.id, candidateRow.savedVersionId)).limit(1);
          if (existing) out.push({ id: existing.id, versionNo: existing.versionNo, title: candidateRow.title, variation: "应援合唱版", isMain: existing.isMain, createdAt: existing.createdAt.toISOString(), executionKind: candidateRow.executionKind, hasAudio: Boolean(candidateRow.metadata?.hasAudio), audioUrl: candidateRow.audioUrl });
          continue;
        }
        const [last] = await tx.select({ versionNo: demoVersions.versionNo }).from(demoVersions).where(eq(demoVersions.projectId, input.projectId)).orderBy(desc(demoVersions.versionNo)).limit(1);
        const versionNo = (last?.versionNo ?? 0) + 1;
        const [version] = await tx.insert(demoVersions).values({ projectId: input.projectId, parentId, versionNo, snapshot: { lyrics: project.lyrics, variation: candidateRow.title }, isMain: out.length === 0, createdBy: owner.id }).returning();
        if (!version) throw new Error("Version creation failed");
        await tx.insert(demoAssets).values({ versionId: version.id, jobId: candidateRow.jobId, objectKey: candidateRow.objectKey ?? `external://candidate/${candidateRow.id}`, durationMs: candidateRow.durationMs, executionKind: candidateRow.executionKind, metadata: { title: candidateRow.title, hasAudio: Boolean(candidateRow.metadata?.hasAudio), audioUrl: candidateRow.audioUrl, cosObjectKey: typeof candidateRow.metadata?.cosObjectKey === "string" ? candidateRow.metadata.cosObjectKey : null, providerLabel: candidateRow.metadata?.providerLabel } });
        await tx.update(generationCandidates).set({ savedVersionId: version.id }).where(eq(generationCandidates.id, candidateRow.id));
        out.push({ id: version.id, versionNo, title: candidateRow.title, variation: "应援合唱版", isMain: out.length === 0, createdAt: version.createdAt.toISOString(), executionKind: candidateRow.executionKind, hasAudio: Boolean(candidateRow.metadata?.hasAudio), audioUrl: candidateRow.audioUrl });
      }
      return out;
    });
    if (saved.length) {
      await db.update(projects).set({ status: "ready", mainVersionId: saved[0]!.id, currentLyrics: project.lyrics, updatedAt: new Date() }).where(eq(projects.id, input.projectId));
    }
    return { saved };
  }

  private toVersionView(id: string, entry: MockVersionEntry): DemoVersionView {
    return { id, versionNo: entry.versionNo, title: entry.candidate.title, variation: entry.candidate.variation, isMain: entry.isMain, createdAt: entry.createdAt, executionKind: entry.candidate.executionKind, hasAudio: entry.candidate.hasAudio, audioUrl: entry.candidate.audioUrl };
  }

  /** 项目内版本列表（创作库按项目维度展示，版本归属同一首歌）。 */
  async listVersions(owner: AuthUser, projectId: string): Promise<DemoVersionView[]> {
    const project = await getProjectRepository().findOwned(projectId, owner.id);
    if (!project) throw new DomainError("NOT_FOUND", 404, "项目不存在或无权访问");
    let views: DemoVersionView[];
    if (!process.env.DATABASE_URL) {
      views = [...mockVersionIndex.entries()].filter(([, entry]) => entry.projectId === projectId && entry.ownerId === owner.id).map(([id, entry]) => ({ id, versionNo: entry.versionNo, title: entry.candidate.title, variation: entry.candidate.variation, isMain: entry.isMain, createdAt: entry.createdAt, executionKind: entry.candidate.executionKind, hasAudio: entry.candidate.hasAudio, audioUrl: entry.candidate.audioUrl, restoredFromVersionId: typeof entry.snapshot.restoredFromVersionId === "string" ? entry.snapshot.restoredFromVersionId : null, parentId: typeof entry.snapshot.parentId === "string" ? entry.snapshot.parentId : null }));
    } else {
      const rows = await getDatabase().select({ id: demoVersions.id, parentId: demoVersions.parentId, versionNo: demoVersions.versionNo, isMain: demoVersions.isMain, createdAt: demoVersions.createdAt, snapshot: demoVersions.snapshot, objectKey: demoAssets.objectKey, executionKind: demoAssets.executionKind, metadata: demoAssets.metadata }).from(demoVersions).leftJoin(demoAssets, eq(demoAssets.versionId, demoVersions.id)).where(eq(demoVersions.projectId, projectId)).orderBy(desc(demoVersions.versionNo));
      // 真实库：对每条有 COS objectKey/cosObjectKey 的版本，解析为短时签名播放 URL（异步）。
      const resolved = await Promise.all(rows.map(async (row) => {
        const cosKey = typeof row.metadata?.cosObjectKey === "string" ? row.metadata.cosObjectKey : row.objectKey;
        const fallback = typeof row.metadata?.audioUrl === "string" ? row.metadata.audioUrl : null;
        return { id: row.id, versionNo: row.versionNo, title: String(row.metadata?.title || `版本 V${row.versionNo}`), variation: String(row.snapshot.variation || "Demo"), isMain: row.isMain, createdAt: row.createdAt.toISOString(), executionKind: row.executionKind || "simulated", hasAudio: Boolean(row.metadata?.hasAudio), audioUrl: await resolveAudioUrl(cosKey, fallback), restoredFromVersionId: typeof row.snapshot.restoredFromVersionId === "string" ? row.snapshot.restoredFromVersionId : null, parentId: row.parentId ?? null };
      }));
      views = resolved;
    }
    const labels = computeVersionLabels(views);
    return views.map((view) => ({ ...view, label: labels.get(view.id) })).sort((a, b) => b.versionNo - a.versionNo);
  }

  /**
   * 最近歌曲聚合（侧栏「最近歌曲」）：取用户最近 N 个项目，
   * 每个项目取代表版本（主版本优先，否则版本号最大者），返回每项目至多 1 首。
   * 项目无版本时不计入（无歌曲可展示）。
   */
  async listRecentSongs(owner: AuthUser, limit = 5): Promise<RecentSongItem[]> {
    const safeLimit = Number.isFinite(limit) ? Math.min(20, Math.max(1, Math.floor(limit))) : 5;
    const recentProjects = await getProjectRepository().listPage(owner.id, 1, Math.max(safeLimit * 2, safeLimit));
    const songs: RecentSongItem[] = [];
    for (const project of recentProjects.items) {
      if (songs.length >= safeLimit) break;
      const versions = await this.listVersions(owner, project.id);
      const represent = versions.find((v) => v.isMain) ?? versions[0];
      if (!represent) continue;
      songs.push({
        versionId: represent.id,
        projectId: project.id,
        title: represent.title,
        projectName: project.title,
        updatedAt: represent.createdAt,
      });
    }
    return songs;
  }

  async getCurrentAudio(owner: AuthUser, projectId: string) {    const versions = await this.listVersions(owner, projectId);
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

  /**
   * 应用历史版本（git checkout 语义）：将 HEAD（主版本）移动到目标版本，
   * 并把该版本歌词快照写回项目草稿（currentLyrics），使制作台切换到该版本内容。
   * **不创建新版本**——避免游离节点；之后在 HEAD 上保存将产生从该版本分叉的新版本（兄弟节点）。
   * 返回版本视图 + 写回的歌词，供前端切换工作区内容。
   */
  async restore(owner: AuthUser, projectId: string, sourceVersionId: string): Promise<RestoreVersionResult> {
    const project = await getProjectRepository().findOwned(projectId, owner.id);
    if (!project) throw new DomainError("NOT_FOUND", 404, "项目不存在或无权访问");
    if (!process.env.DATABASE_URL) {
      const source = mockVersionIndex.get(sourceVersionId);
      if (!source || source.projectId !== projectId || source.ownerId !== owner.id) throw new DomainError("NOT_FOUND", 404, "版本不存在");
      mockVersionIndex.forEach((entry) => { if (entry.projectId === projectId) entry.isMain = false; });
      source.isMain = true;
      const lyrics = typeof source.snapshot.lyrics === "string" ? source.snapshot.lyrics : project.lyrics;
      await getProjectRepository().updateDraft(projectId, owner.id, { currentLyrics: lyrics });
      return { id: sourceVersionId, versionNo: source.versionNo, title: source.candidate.title, variation: source.candidate.variation, isMain: true, createdAt: source.createdAt, executionKind: source.candidate.executionKind, hasAudio: source.candidate.hasAudio, audioUrl: source.candidate.audioUrl, parentId: typeof source.snapshot.parentId === "string" ? source.snapshot.parentId : null, lyrics };
    }
    const db = getDatabase();
    const base = await db.transaction(async (tx) => {
      const [source] = await tx.select({ id: demoVersions.id, versionNo: demoVersions.versionNo, parentId: demoVersions.parentId, snapshot: demoVersions.snapshot, objectKey: demoAssets.objectKey, executionKind: demoAssets.executionKind, metadata: demoAssets.metadata }).from(demoVersions).leftJoin(demoAssets, eq(demoAssets.versionId, demoVersions.id)).where(and(eq(demoVersions.id, sourceVersionId), eq(demoVersions.projectId, projectId))).limit(1);
      if (!source) throw new DomainError("NOT_FOUND", 404, "版本不存在");
      await tx.update(demoVersions).set({ isMain: false }).where(eq(demoVersions.projectId, projectId));
      await tx.update(demoVersions).set({ isMain: true }).where(eq(demoVersions.id, sourceVersionId));
      const lyrics = typeof source.snapshot.lyrics === "string" ? source.snapshot.lyrics : project.lyrics;
      await tx.update(projects).set({ mainVersionId: sourceVersionId, currentLyrics: lyrics, status: "review", updatedAt: new Date() }).where(eq(projects.id, projectId));
      const cosKey = typeof source.metadata?.cosObjectKey === "string" ? source.metadata.cosObjectKey : source.objectKey;
      const fallback = typeof source.metadata?.audioUrl === "string" ? source.metadata.audioUrl : null;
      return { id: source.id, versionNo: source.versionNo, title: String(source.metadata?.title || project.title), variation: String(source.snapshot.variation || "Demo"), isMain: true, createdAt: new Date().toISOString(), executionKind: source.executionKind || "simulated", hasAudio: Boolean(source.metadata?.hasAudio), cosKey, fallback, parentId: source.parentId ?? null, lyrics };
    });
    // 事务外解析签名播放 URL（避免 I/O 占用数据库事务）。
    return { id: base.id, versionNo: base.versionNo, title: base.title, variation: base.variation, isMain: base.isMain, createdAt: base.createdAt, executionKind: base.executionKind, hasAudio: base.hasAudio, parentId: base.parentId, lyrics: base.lyrics, audioUrl: await resolveAudioUrl(base.cosKey, base.fallback) };
  }

  /**
   * 删除指定版本（事务）：
   * - demo_assets 随 demo_versions cascade 删除；
   * - 被删版本的子节点 parentId 上移到被删版本的 parentId，保持版本树连通；
   * - 若删的是主版本，自动把剩余版本中 versionNo 最大者设为新主版本，
   *   并回写 projects.mainVersionId。
   */
  async delete(owner: AuthUser, projectId: string, versionId: string): Promise<{ ok: true }> {
    const project = await getProjectRepository().findOwned(projectId, owner.id);
    if (!project) throw new DomainError("NOT_FOUND", 404, "项目不存在或无权访问");

    if (!process.env.DATABASE_URL) {
      const entry = mockVersionIndex.get(versionId);
      if (!entry || entry.projectId !== projectId || entry.ownerId !== owner.id) throw new DomainError("NOT_FOUND", 404, "版本不存在");
      const removedParentId = typeof entry.snapshot.parentId === "string" ? entry.snapshot.parentId : null;
      // 子节点 parent 上移（写入 snapshot.parentId），保持树连通。
      for (const [, item] of mockVersionIndex) {
        if (item.projectId === projectId && item.snapshot.parentId === versionId) {
          item.snapshot = { ...item.snapshot, parentId: removedParentId };
        }
      }
      mockVersionIndex.delete(versionId);
      // 删主版本时自动迁移主：选剩余 versionNo 最大者。
      if (entry.isMain) {
        const remaining = [...mockVersionIndex.values()].filter((item) => item.projectId === projectId).sort((a, b) => b.versionNo - a.versionNo)[0] ?? null;
        if (remaining) {
          remaining.isMain = true;
        }
      }
      return { ok: true };
    }

    const db = getDatabase();
    await db.transaction(async (tx) => {
      const [version] = await tx.select({ id: demoVersions.id, parentId: demoVersions.parentId, isMain: demoVersions.isMain }).from(demoVersions).where(and(eq(demoVersions.id, versionId), eq(demoVersions.projectId, projectId))).limit(1);
      if (!version) throw new DomainError("NOT_FOUND", 404, "版本不存在");
      const removedParentId = version.parentId ?? null;
      // 子节点 parent 上移：parentId === 被删版本 → 改为被删版本的 parentId。
      await tx.update(demoVersions).set({ parentId: removedParentId }).where(and(eq(demoVersions.projectId, projectId), eq(demoVersions.parentId, versionId)));
      await tx.delete(demoVersions).where(eq(demoVersions.id, versionId));
      if (version.isMain) {
        const [newMain] = await tx.select({ id: demoVersions.id }).from(demoVersions).where(eq(demoVersions.projectId, projectId)).orderBy(desc(demoVersions.versionNo)).limit(1);
        if (newMain) {
          await tx.update(demoVersions).set({ isMain: true }).where(eq(demoVersions.id, newMain.id));
          await tx.update(projects).set({ mainVersionId: newMain.id, updatedAt: new Date() }).where(eq(projects.id, projectId));
        }
      }
    });
    return { ok: true };
  }
}
