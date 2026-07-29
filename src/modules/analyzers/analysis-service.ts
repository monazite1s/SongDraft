import { eq } from "drizzle-orm";

import { getDatabase } from "@/infrastructure/db/client";
import { analysisResults, inspirationAssets, projects } from "@/infrastructure/db/schema";
import type { AuthUser } from "@/modules/auth/types";
import { getProjectRepository } from "@/modules/projects/project-repository";
import { DomainError } from "@/shared/errors/domain-error";

export interface AnalysisResultView { id: string; assetId: string | null; analyzer: "text" | "melody" | "vision"; executionKind: "simulated"; summary: string; evidence: string[]; limitations: string[]; }
const mockAnalyses = new Map<string, AnalysisResultView[]>();

function analyze(kind: "text" | "lyrics" | "audio" | "image" | "video", content?: string | null, name?: string | null): Omit<AnalysisResultView, "id" | "assetId"> {
  if (kind === "audio") return { analyzer: "melody", executionKind: "simulated", summary: `已记录旋律参考「${name || "未命名哼唱"}」；待接入音高和 BPM 识别。`, evidence: ["哼唱/音频素材"], limitations: ["当前为 Mock 分析，未提取真实 BPM、音域或旋律轮廓"] };
  if (kind === "image" || kind === "video") return { analyzer: "vision", executionKind: "simulated", summary: `已记录视觉氛围「${name || "未命名视觉素材"}」；待接入视觉理解模型。`, evidence: ["图片/视频素材"], limitations: ["当前为 Mock 分析，未提取真实场景、色彩或镜头动态"] };
  const excerpt = content?.trim().slice(0, 36) || "无文本内容";
  return { analyzer: "text", executionKind: "simulated", summary: `已提取文本主题线索：「${excerpt}${(content?.length ?? 0) > 36 ? "…" : ""}」`, evidence: [kind === "lyrics" ? "原始歌词" : "创作描述"], limitations: ["当前为 Mock 分析，未调用 DeepSeek"] };
}

export class AnalysisService {
  async analyze(owner: AuthUser, projectId: string) {
    const project = await getProjectRepository().findOwned(projectId, owner.id);
    if (!project) throw new DomainError("NOT_FOUND", 404, "项目不存在或无权访问");
    if (!project.assets.length) throw new DomainError("VALIDATION_FAILED", 422, "请先添加至少一种素材");
    if (!process.env.DATABASE_URL) {
      const results = project.assets.filter((asset) => asset.status === "ready").map((asset) => ({ id: crypto.randomUUID(), assetId: asset.id, ...analyze(asset.kind, asset.content, asset.originalName) }));
      mockAnalyses.set(projectId, results);
      return results;
    }
    const db = getDatabase();
    const assets = await db.select({ id: inspirationAssets.id, kind: inspirationAssets.kind, content: inspirationAssets.content, originalName: inspirationAssets.originalName, status: inspirationAssets.status }).from(inspirationAssets).where(eq(inspirationAssets.projectId, projectId));
    const values = assets.filter((asset) => asset.status === "ready").map((asset) => { const result = analyze(asset.kind, asset.content, asset.originalName); return { projectId, assetId: asset.id, analyzer: result.analyzer, provider: "SongDraft Mock Analyzer", executionKind: "simulated" as const, payload: { summary: result.summary, evidence: result.evidence }, limitations: result.limitations }; });
    if (!values.length) throw new DomainError("VALIDATION_FAILED", 422, "请等待素材上传完成");
    const created = await db.insert(analysisResults).values(values).returning();
    await db.update(projects).set({ status: "review", updatedAt: new Date() }).where(eq(projects.id, projectId));
    return created.map((result) => ({ id: result.id, assetId: result.assetId, analyzer: result.analyzer as AnalysisResultView["analyzer"], executionKind: result.executionKind as "simulated", summary: String(result.payload.summary || "分析完成"), evidence: Array.isArray(result.payload.evidence) ? result.payload.evidence.map(String) : [], limitations: result.limitations }));
  }

  async list(owner: AuthUser, projectId: string) {
    const project = await getProjectRepository().findOwned(projectId, owner.id);
    if (!project) throw new DomainError("NOT_FOUND", 404, "项目不存在或无权访问");
    if (!process.env.DATABASE_URL) return mockAnalyses.get(projectId) ?? [];
    const rows = await getDatabase().select().from(analysisResults).where(eq(analysisResults.projectId, projectId));
    return rows.map((result) => ({ id: result.id, assetId: result.assetId, analyzer: result.analyzer as AnalysisResultView["analyzer"], executionKind: result.executionKind as "simulated", summary: String(result.payload.summary || "分析完成"), evidence: Array.isArray(result.payload.evidence) ? result.payload.evidence.map(String) : [], limitations: result.limitations }));
  }
}
