/**
 * 项目与草稿流程（docs/SPEC.md：项目是组织单位；docs/technical-design.md §2）
 *
 * 新建项目、分页列表、按所有权读取、PATCH 草稿（歌词/描述/创作上下文）。
 * 入口：POST/GET /api/projects、PATCH /api/projects/[id]/draft。
 */
import type { AuthUser } from "@/modules/auth/types";
import { getObjectStorage } from "@/infrastructure/storage/factory";
import { DomainError } from "@/shared/errors/domain-error";
import { createProjectSchema, updateProjectDraftSchema } from "@/shared/validation/project";
import { getProjectRepository, type ProjectRepository } from "./project-repository";
import type { ProjectDetail } from "./project-types";

/**
 * NOTE: 历史上此处曾 import InspirationService / GenerationService 并在 getProjectDetail
 * 中聚合灵感与版本。该聚合造成 project-service ↔ inspiration-repository 循环 import
 * （project-service → inspiration-service → inspiration-repository → project-service），
 * 在 Next.js (Turbopack/webpack) 下导致模块绑定未就绪、运行时 ReferenceError，进而被
 * 页面 try/catch 吞成 404。聚合已上移到 works/[projectId] 页面层（见该 page.tsx），
 * 因此本服务不再依赖灵感/生成模块。
 */
export class ProjectService {
  constructor(private readonly repository: ProjectRepository = getProjectRepository()) {}

  /** 创建项目（灵感保存或制作台首次落盘）。 */
  async create(owner: AuthUser, input: unknown) { return this.repository.create(owner, createProjectSchema.parse(input)); }
  async list(ownerId: string) { return this.repository.list(ownerId); }
  /** 创作库分页列表（按项目维度，不按版本拆卡）。 */
  async listPage(ownerId: string, page = 1, pageSize = 12) {
    const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
    const safePageSize = Number.isFinite(pageSize) ? Math.min(48, Math.max(1, Math.floor(pageSize))) : 12;
    return this.repository.listPage(ownerId, safePage, safePageSize);
  }
  async get(ownerId: string, projectId: string) {
    const project = await this.repository.findOwned(projectId, ownerId);
    if (!project) throw new DomainError("NOT_FOUND", 404, "项目不存在或无权访问");
    // 为音频/图片签发可读 URL，供制作台原料区 hydrate（灵感 attach 后进入工作台）。
    return withAssetPreviewUrls(project);
  }
  /** 更新制作台草稿字段（精修后歌词、创作提示等）。 */
  async updateDraft(ownerId: string, projectId: string, input: unknown) {
    const project = await this.repository.updateDraft(projectId, ownerId, updateProjectDraftSchema.parse(input));
    if (!project) throw new DomainError("NOT_FOUND", 404, "项目不存在或无权访问");
    return withAssetPreviewUrls(project);
  }

  /** 软删除项目：先 findOwned 校验所有权（不存在→404），再 softDelete。 */
  async delete(ownerId: string, projectId: string) {
    const owned = await this.repository.findOwned(projectId, ownerId);
    if (!owned) throw new DomainError("NOT_FOUND", 404, "项目不存在或无权访问");
    await this.repository.softDelete(projectId, ownerId);
  }

  /** 创作库：项目分页列表 + 灵感数/歌曲数（/api/works）。支持关键词与排序。 */
  async listWithCounts(
    ownerId: string,
    page = 1,
    pageSize = 12,
    query = "",
    sort: "updated" | "created" = "updated",
  ) {
    const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
    const safePageSize = Number.isFinite(pageSize) ? Math.min(48, Math.max(1, Math.floor(pageSize))) : 12;
    return this.repository.listPageWithCounts(ownerId, safePage, safePageSize, query, sort);
  }

  /** 项目详情聚合（/works/[projectId]）：项目 + 关联灵感 + 版本（歌曲）列表。
   *  已上移到 works/[projectId] 页面层聚合，见该 page.tsx。 */
}

/** 给 ready 的 audio/image 补 previewUrl（COS 签名或 mock 下载地址）。 */
async function withAssetPreviewUrls(project: ProjectDetail): Promise<ProjectDetail> {
  const storage = getObjectStorage();
  const assets = await Promise.all(
    project.assets.map(async (asset) => {
      if (
        (asset.kind === "audio" || asset.kind === "image")
        && asset.status === "ready"
        && asset.objectKey
        && !asset.previewUrl
      ) {
        try {
          const previewUrl = await storage.createDownload(asset.objectKey, 86_400);
          return { ...asset, previewUrl };
        } catch {
          return asset;
        }
      }
      return asset;
    }),
  );
  return { ...project, assets };
}
