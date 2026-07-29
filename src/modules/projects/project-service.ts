import type { AuthUser } from "@/modules/auth/types";
import { DomainError } from "@/shared/errors/domain-error";
import { createProjectSchema } from "@/shared/validation/project";
import { getProjectRepository, type ProjectRepository } from "./project-repository";

export class ProjectService {
  constructor(private readonly repository: ProjectRepository = getProjectRepository()) {}

  async create(owner: AuthUser, input: unknown) { return this.repository.create(owner, createProjectSchema.parse(input)); }
  async list(ownerId: string) { return this.repository.list(ownerId); }
  async get(ownerId: string, projectId: string) {
    const project = await this.repository.findOwned(projectId, ownerId);
    if (!project) throw new DomainError("NOT_FOUND", 404, "项目不存在或无权访问");
    return project;
  }
}
