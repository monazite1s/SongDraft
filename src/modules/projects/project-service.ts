/**
 * 项目与草稿流程（docs/SPEC.md：项目是组织单位；docs/technical-design.md §2）
 *
 * 新建项目、分页列表、按所有权读取、PATCH 草稿（歌词/描述/创作上下文）。
 * 入口：POST/GET /api/projects、PATCH /api/projects/[id]/draft。
 */
import type { AuthUser } from "@/modules/auth/types";
import { DomainError } from "@/shared/errors/domain-error";
import { createProjectSchema, updateProjectDraftSchema } from "@/shared/validation/project";
import { getProjectRepository, type ProjectRepository } from "./project-repository";

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
    return project;
  }
  /** 更新制作台草稿字段（精修后歌词、创作提示等）。 */
  async updateDraft(ownerId: string, projectId: string, input: unknown) {
    const project = await this.repository.updateDraft(projectId, ownerId, updateProjectDraftSchema.parse(input));
    if (!project) throw new DomainError("NOT_FOUND", 404, "项目不存在或无权访问");
    return project;
  }
}
