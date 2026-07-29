import { and, desc, eq, isNull } from "drizzle-orm";

import { getDatabase } from "@/infrastructure/db/client";
import { inspirationAssets, profiles, projects } from "@/infrastructure/db/schema";
import type { AuthUser } from "@/modules/auth/types";
import type { CreateProjectInput } from "@/shared/validation/project";
import { detectCombination } from "@/shared/utils/combination";
import type { ProjectDetail, ProjectSummary } from "./project-types";

export interface ProjectRepository {
  create(owner: AuthUser, input: CreateProjectInput): Promise<ProjectDetail>;
  list(ownerId: string): Promise<ProjectSummary[]>;
  findOwned(projectId: string, ownerId: string): Promise<ProjectDetail | null>;
}

function toSummary(row: { id: string; ownerId: string; title: string; description: string | null; status: ProjectSummary["status"]; createdAt: Date; updatedAt: Date }, input: CreateProjectInput): ProjectSummary {
  return {
    id: row.id,
    ownerId: row.ownerId,
    title: row.title,
    description: row.description,
    status: row.status,
    combination: detectCombination({ hasText: Boolean(input.description || input.lyrics), hasMelody: Boolean(input.melodyAssetId), hasVisual: Boolean(input.visualAssetId) }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class DrizzleProjectRepository implements ProjectRepository {
  async create(owner: AuthUser, input: CreateProjectInput): Promise<ProjectDetail> {
    const db = getDatabase();
    return db.transaction(async (tx) => {
      await tx.insert(profiles).values({ id: owner.id, email: owner.email, displayName: owner.displayName }).onConflictDoUpdate({ target: profiles.id, set: { email: owner.email, displayName: owner.displayName, updatedAt: new Date() } });
      const [project] = await tx.insert(projects).values({ ownerId: owner.id, title: input.title, description: input.description || null }).returning();
      if (!project) throw new Error("Project creation failed");
      const assetValues = [
        input.description ? { projectId: project.id, ownerId: owner.id, kind: "text" as const, content: input.description, status: "ready" as const } : null,
        input.lyrics ? { projectId: project.id, ownerId: owner.id, kind: "lyrics" as const, content: input.lyrics, status: "ready" as const } : null,
      ].filter((asset): asset is NonNullable<typeof asset> => Boolean(asset));
      if (assetValues.length) await tx.insert(inspirationAssets).values(assetValues);
      const assets = assetValues.map((asset, index) => ({ id: `pending-${index}`, kind: asset.kind, content: asset.content ?? null, included: true, status: "ready" as const }));
      return { ...toSummary(project, input), lyrics: input.lyrics || null, assets };
    });
  }

  async list(ownerId: string): Promise<ProjectSummary[]> {
    const rows = await getDatabase().select().from(projects).where(and(eq(projects.ownerId, ownerId), isNull(projects.deletedAt))).orderBy(desc(projects.updatedAt));
    return rows.map((row) => ({ id: row.id, ownerId: row.ownerId, title: row.title, description: row.description, status: row.status, combination: "text", createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }));
  }

  async findOwned(projectId: string, ownerId: string): Promise<ProjectDetail | null> {
    const [project] = await getDatabase().select().from(projects).where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId), isNull(projects.deletedAt))).limit(1);
    if (!project) return null;
    const assets = await getDatabase().select({ id: inspirationAssets.id, kind: inspirationAssets.kind, content: inspirationAssets.content, included: inspirationAssets.included, status: inspirationAssets.status, originalName: inspirationAssets.originalName, mimeType: inspirationAssets.mimeType, sizeBytes: inspirationAssets.sizeBytes, objectKey: inspirationAssets.objectKey }).from(inspirationAssets).where(eq(inspirationAssets.projectId, projectId));
    const text = assets.filter((asset) => asset.kind === "text" || asset.kind === "lyrics");
    const combination = detectCombination({ hasText: text.length > 0, hasMelody: assets.some((asset) => asset.kind === "audio"), hasVisual: assets.some((asset) => asset.kind === "image" || asset.kind === "video") });
    return { id: project.id, ownerId: project.ownerId, title: project.title, description: project.description, status: project.status, combination, createdAt: project.createdAt.toISOString(), updatedAt: project.updatedAt.toISOString(), lyrics: assets.find((asset) => asset.kind === "lyrics")?.content ?? null, assets };
  }
}

const mockGlobal = globalThis as typeof globalThis & {
  __songDraftMemoryProjects?: Map<string, ProjectDetail>;
};
const memoryProjects = mockGlobal.__songDraftMemoryProjects ?? new Map<string, ProjectDetail>();
mockGlobal.__songDraftMemoryProjects = memoryProjects;

export class MockProjectRepository implements ProjectRepository {
  async create(owner: AuthUser, input: CreateProjectInput): Promise<ProjectDetail> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const assets: ProjectDetail["assets"] = [];
    if (input.description) assets.push({ id: crypto.randomUUID(), kind: "text", content: input.description, included: true, status: "ready" });
    if (input.lyrics) assets.push({ id: crypto.randomUUID(), kind: "lyrics", content: input.lyrics, included: true, status: "ready" });
    const project: ProjectDetail = { id, ownerId: owner.id, title: input.title, description: input.description || null, lyrics: input.lyrics || null, status: "draft", combination: detectCombination({ hasText: assets.length > 0, hasMelody: Boolean(input.melodyAssetId), hasVisual: Boolean(input.visualAssetId) }), createdAt: now, updatedAt: now, assets };
    memoryProjects.set(id, project);
    return project;
  }

  async list(ownerId: string) { return [...memoryProjects.values()].filter((project) => project.ownerId === ownerId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(({ lyrics: _lyrics, assets: _assets, ...summary }) => summary); }
  async findOwned(projectId: string, ownerId: string) { const project = memoryProjects.get(projectId); return project?.ownerId === ownerId ? project : null; }
}

export function getProjectRepository(): ProjectRepository {
  return process.env.DATABASE_URL ? new DrizzleProjectRepository() : new MockProjectRepository();
}

export function attachMockAsset(input: ProjectDetail["assets"][number] & { projectId: string }) {
  const project = memoryProjects.get(input.projectId);
  if (!project) return;
  const { projectId: _projectId, ...asset } = input;
  const existing = project.assets.findIndex((item) => item.id === asset.id);
  if (existing >= 0) project.assets[existing] = asset;
  else project.assets.push(asset);
  project.updatedAt = new Date().toISOString();
}
