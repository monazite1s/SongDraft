/**
 * 素材分析（docs/SPEC.md 素材分析）。
 *
 * 文本/歌词/音频说明 → DeepSeek 真实摘要；图片/视频 → GLM-4V 图生文。
 * 不再返回写死的「氛围/情绪」假摘要：未配置 Key、无文本内容或图片无可访问地址时抛错，
 * 绝不伪造分析结果。
 */
import { eq } from "drizzle-orm";

import { getDatabase } from "@/infrastructure/db/client";
import { analysisResults, inspirationAssets, projects } from "@/infrastructure/db/schema";
import { getObjectStorage } from "@/infrastructure/storage/factory";
import { isRealCosInUse } from "@/infrastructure/storage/transfer";
import { getVisionAnalyzer } from "@/modules/ai/vision-analyzer";
import type { AuthUser } from "@/modules/auth/types";
import { getProjectRepository } from "@/modules/projects/project-repository";
import { DomainError } from "@/shared/errors/domain-error";

export interface AnalysisResultView { id: string; assetId: string | null; analyzer: "text" | "melody" | "vision"; executionKind: "real_external" | "simulated"; summary: string; evidence: string[]; limitations: string[]; }
const mockAnalyses = new Map<string, AnalysisResultView[]>();

interface AnalysisAsset {
  id: string;
  kind: "text" | "lyrics" | "audio" | "image" | "video";
  content: string | null;
  originalName?: string | null;
  objectKey?: string | null;
  status: string;
}

/** DeepSeek：把一段文本总结为 ≤60 字的创作线索（plain text，非 JSON）。无 Key 抛错。 */
async function summarizeText(content: string, focus: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
  if (!apiKey) throw new DomainError("PROVIDER_NOT_CONFIGURED", 503, "DeepSeek 尚未配置");
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      model,
      thinking: { type: "disabled" },
      temperature: 0.4,
      max_tokens: 200,
      messages: [
        { role: "system", content: `你是音乐创作素材分析助手。用中文一句话（≤60 字）总结下列${focus}，提炼可用于音乐创作的主题、情绪或场景线索。只输出总结本身。` },
        { role: "user", content: content.slice(0, 2_000) },
      ],
    }),
  });
  if (!response.ok) throw new DomainError("UPSTREAM_ERROR", 502, response.status === 401 ? "DeepSeek 认证失败" : "素材分析服务暂时不可用");
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new DomainError("UPSTREAM_INVALID_RESPONSE", 502, "素材分析服务返回内容无效");
  return text.slice(0, 120);
}

/** 解析图片/视频的 COS 预签名 URL（GLM 图生文需要公网可拉取地址）。无 objectKey/COS → null。 */
async function resolveAssetUrl(objectKey: string | null | undefined): Promise<string | null> {
  if (!objectKey || !isRealCosInUse()) return null;
  try {
    return await getObjectStorage().createDownload(objectKey, 3_600);
  } catch {
    return null;
  }
}

/** 单个素材的真实分析：文本类→DeepSeek 摘要；图像类→GLM 图生文。不造假。 */
async function analyzeAsset(asset: AnalysisAsset): Promise<{ analyzer: AnalysisResultView["analyzer"]; provider: string; summary: string; evidence: string[]; limitations: string[] }> {
  if (asset.kind === "image" || asset.kind === "video") {
    const url = await resolveAssetUrl(asset.objectKey);
    if (!url) throw new DomainError("VALIDATION_FAILED", 422, "视觉素材无可访问地址，无法分析");
    const desc = await getVisionAnalyzer().analyzeImage(url);
    return { analyzer: "vision", provider: "GLM-4V", summary: desc, evidence: ["图片/视频素材"], limitations: [] };
  }
  if (asset.kind === "audio") {
    const content = (asset.content ?? "").trim();
    // 音频若无文字说明，无可摘要内容 → 如实报告素材名（非伪造氛围）；BPM 等无法自动提取。
    if (!content) return { analyzer: "melody", provider: "SongDraft", summary: `音频素材「${asset.originalName ?? "未命名"}」`, evidence: ["哼唱/音频素材"], limitations: ["BPM、音域、旋律轮廓未自动提取"] };
    const summary = await summarizeText(content, "音频素材说明");
    return { analyzer: "melody", provider: "DeepSeek", summary, evidence: ["哼唱/音频素材"], limitations: ["BPM、音域、旋律轮廓未自动提取"] };
  }
  const content = (asset.content ?? "").trim();
  if (!content) throw new DomainError("VALIDATION_FAILED", 422, "文本素材为空，无法分析");
  const summary = await summarizeText(content, asset.kind === "lyrics" ? "歌词" : "文本/创作描述");
  return { analyzer: "text", provider: "DeepSeek", summary, evidence: [asset.kind === "lyrics" ? "原始歌词" : "创作描述"], limitations: [] };
}

export class AnalysisService {
  async analyze(owner: AuthUser, projectId: string) {
    const project = await getProjectRepository().findOwned(projectId, owner.id);
    if (!project) throw new DomainError("NOT_FOUND", 404, "项目不存在或无权访问");
    if (!project.assets.length) throw new DomainError("VALIDATION_FAILED", 422, "请先添加至少一种素材");

    const ready = project.assets.filter((asset) => asset.status === "ready");
    if (!ready.length) throw new DomainError("VALIDATION_FAILED", 422, "请等待素材上传完成");
    const analyzed = await Promise.all(ready.map(async (asset) => ({ assetId: asset.id, ...(await analyzeAsset(asset as AnalysisAsset)) })));

    if (!process.env.DATABASE_URL) {
      const results: AnalysisResultView[] = analyzed.map((item) => ({
        id: crypto.randomUUID(),
        assetId: item.assetId,
        analyzer: item.analyzer,
        executionKind: "real_external",
        summary: item.summary,
        evidence: item.evidence,
        limitations: item.limitations,
      }));
      mockAnalyses.set(projectId, results);
      return results;
    }
    const db = getDatabase();
    const created = await db.insert(analysisResults).values(
      analyzed.map((item) => ({
        projectId,
        assetId: item.assetId,
        analyzer: item.analyzer,
        provider: item.provider,
        executionKind: "real_external" as const,
        payload: { summary: item.summary, evidence: item.evidence },
        limitations: item.limitations,
      })),
    ).returning();
    await db.update(projects).set({ status: "review", updatedAt: new Date() }).where(eq(projects.id, projectId));
    return created.map((result) => ({
      id: result.id,
      assetId: result.assetId,
      analyzer: result.analyzer as AnalysisResultView["analyzer"],
      executionKind: "real_external" as const,
      summary: String(result.payload.summary || "分析完成"),
      evidence: Array.isArray(result.payload.evidence) ? result.payload.evidence.map(String) : [],
      limitations: result.limitations,
    }));
  }

  async list(owner: AuthUser, projectId: string) {
    const project = await getProjectRepository().findOwned(projectId, owner.id);
    if (!project) throw new DomainError("NOT_FOUND", 404, "项目不存在或无权访问");
    if (!process.env.DATABASE_URL) return mockAnalyses.get(projectId) ?? [];
    const rows = await getDatabase().select().from(analysisResults).where(eq(analysisResults.projectId, projectId));
    return rows.map((result) => ({
      id: result.id,
      assetId: result.assetId,
      analyzer: result.analyzer as AnalysisResultView["analyzer"],
      executionKind: (result.executionKind === "simulated" ? "simulated" : "real_external") as AnalysisResultView["executionKind"],
      summary: String(result.payload.summary || "分析完成"),
      evidence: Array.isArray(result.payload.evidence) ? result.payload.evidence.map(String) : [],
      limitations: result.limitations,
    }));
  }
}
