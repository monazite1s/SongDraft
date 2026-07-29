import { and, count, desc, eq, isNull } from "drizzle-orm";

import { getDatabase } from "@/infrastructure/db/client";
import { inspirationAssets, profiles, projects } from "@/infrastructure/db/schema";
import { getArtistCatalog } from "@/modules/artists/artist-catalog";
import type { ArtistProfile } from "@/modules/artists/artist-types";
import type { AuthUser } from "@/modules/auth/types";
import { detectCombination } from "@/shared/utils/combination";
import type { CreateProjectInput, UpdateProjectDraftInput } from "@/shared/validation/project";
import type { ProjectDetail, ProjectListPage, ProjectSummary } from "./project-types";

export interface ProjectRepository {
  create(owner: AuthUser, input: CreateProjectInput): Promise<ProjectDetail>;
  list(ownerId: string): Promise<ProjectSummary[]>;
  listPage(ownerId: string, page: number, pageSize: number): Promise<ProjectListPage>;
  findOwned(projectId: string, ownerId: string): Promise<ProjectDetail | null>;
  updateDraft(projectId: string, ownerId: string, input: UpdateProjectDraftInput): Promise<ProjectDetail | null>;
}

type ProjectRow = typeof projects.$inferSelect;

function artistFromSnapshot(snapshot: Record<string, unknown> | null): ArtistProfile | null {
  return snapshot && typeof snapshot.id === "string" && typeof snapshot.name === "string" ? snapshot as unknown as ArtistProfile : null;
}

function summaryFromRow(row: ProjectRow, combination: ProjectSummary["combination"] = "text"): ProjectSummary {
  const context = row.creativeContext ?? {};
  return {
    id: row.id,
    ownerId: row.ownerId,
    title: row.title,
    description: row.description,
    status: row.status,
    combination,
    artist: artistFromSnapshot(row.artistSnapshot),
    eventId: typeof context.eventId === "string" ? context.eventId : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function resolveArtist(artistId?: string | null) {
  return artistId ? getArtistCatalog().findById(artistId) : null;
}

export class DrizzleProjectRepository implements ProjectRepository {
  async create(owner: AuthUser, input: CreateProjectInput): Promise<ProjectDetail> {
    const db = getDatabase();
    const artist = await resolveArtist(input.artistId);
    return db.transaction(async (tx) => {
      await tx.insert(profiles).values({ id: owner.id, email: owner.email, displayName: owner.displayName }).onConflictDoUpdate({ target: profiles.id, set: { email: owner.email, displayName: owner.displayName, updatedAt: new Date() } });
      const creativeContext = input.eventId ? { eventId: input.eventId } : {};
      const [project] = await tx.insert(projects).values({ ownerId: owner.id, title: input.title, description: input.description || null, artistId: artist?.id ?? null, artistSnapshot: artist as unknown as Record<string, unknown> | null, creativeContext, currentLyrics: input.lyrics || null }).returning();
      if (!project) throw new Error("Project creation failed");
      const assetValues = [
        input.description ? { projectId: project.id, ownerId: owner.id, kind: "text" as const, content: input.description, status: "ready" as const } : null,
        input.lyrics ? { projectId: project.id, ownerId: owner.id, kind: "lyrics" as const, content: input.lyrics, status: "ready" as const } : null,
      ].filter((asset): asset is NonNullable<typeof asset> => Boolean(asset));
      if (assetValues.length) await tx.insert(inspirationAssets).values(assetValues);
      const assets = assetValues.map((asset, index) => ({ id: `pending-${index}`, kind: asset.kind, content: asset.content ?? null, included: true, status: "ready" as const }));
      const combination = detectCombination({ hasText: Boolean(input.description || input.lyrics), hasMelody: Boolean(input.melodyAssetId), hasVisual: Boolean(input.visualAssetId) });
      return { ...summaryFromRow(project, combination), lyrics: input.lyrics || null, creativeContext, assets };
    });
  }

  async list(ownerId: string): Promise<ProjectSummary[]> {
    return (await this.listPage(ownerId, 1, 100)).items;
  }

  async listPage(ownerId: string, page: number, pageSize: number): Promise<ProjectListPage> {
    const db = getDatabase();
    const where = and(eq(projects.ownerId, ownerId), isNull(projects.deletedAt));
    const [rows, totalRows] = await Promise.all([
      db.select().from(projects).where(where).orderBy(desc(projects.updatedAt)).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ value: count() }).from(projects).where(where),
    ]);
    const total = totalRows[0]?.value ?? 0;
    return { items: rows.map((row) => summaryFromRow(row)), page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOwned(projectId: string, ownerId: string): Promise<ProjectDetail | null> {
    const db = getDatabase();
    const [project] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId), isNull(projects.deletedAt))).limit(1);
    if (!project) return null;
    const assets = await db.select({ id: inspirationAssets.id, kind: inspirationAssets.kind, content: inspirationAssets.content, included: inspirationAssets.included, status: inspirationAssets.status, originalName: inspirationAssets.originalName, mimeType: inspirationAssets.mimeType, sizeBytes: inspirationAssets.sizeBytes, objectKey: inspirationAssets.objectKey }).from(inspirationAssets).where(eq(inspirationAssets.projectId, projectId));
    const combination = detectCombination({ hasText: Boolean(project.currentLyrics) || assets.some((asset) => asset.kind === "text" || asset.kind === "lyrics"), hasMelody: assets.some((asset) => asset.kind === "audio"), hasVisual: assets.some((asset) => asset.kind === "image" || asset.kind === "video") });
    return { ...summaryFromRow(project, combination), lyrics: project.currentLyrics ?? assets.find((asset) => asset.kind === "lyrics")?.content ?? null, creativeContext: project.creativeContext ?? {}, assets };
  }

  async updateDraft(projectId: string, ownerId: string, input: UpdateProjectDraftInput): Promise<ProjectDetail | null> {
    const current = await this.findOwned(projectId, ownerId);
    if (!current) return null;
    const artist = input.artistId === undefined ? current.artist : await resolveArtist(input.artistId);
    const context = { ...current.creativeContext, ...(input.creativeContext ?? {}) };
    if (input.eventId !== undefined) context.eventId = input.eventId;
    const values: Partial<typeof projects.$inferInsert> = {
      updatedAt: new Date(),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.artistId !== undefined ? { artistId: artist?.id ?? null, artistSnapshot: artist as unknown as Record<string, unknown> | null } : {}),
      ...(input.currentLyrics !== undefined ? { currentLyrics: input.currentLyrics } : {}),
      creativeContext: context,
    };
    await getDatabase().update(projects).set(values).where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)));
    return this.findOwned(projectId, ownerId);
  }
}

const songDraftProjectStore = globalThis as typeof globalThis & {
  __songDraftProjects?: Map<string, ProjectDetail>;
};
const memoryProjects = songDraftProjectStore.__songDraftProjects ??= new Map<string, ProjectDetail>();

export class MockProjectRepository implements ProjectRepository {
  async create(owner: AuthUser, input: CreateProjectInput): Promise<ProjectDetail> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const artist = await resolveArtist(input.artistId);
    const creativeContext = input.eventId ? { eventId: input.eventId } : {};
    const assets: ProjectDetail["assets"] = [];
    if (input.description) assets.push({ id: crypto.randomUUID(), kind: "text", content: input.description, included: true, status: "ready" });
    if (input.lyrics) assets.push({ id: crypto.randomUUID(), kind: "lyrics", content: input.lyrics, included: true, status: "ready" });
    const project: ProjectDetail = { id, ownerId: owner.id, title: input.title, description: input.description || null, lyrics: input.lyrics || null, status: "draft", combination: detectCombination({ hasText: assets.length > 0, hasMelody: Boolean(input.melodyAssetId), hasVisual: Boolean(input.visualAssetId) }), artist, eventId: input.eventId ?? null, creativeContext, createdAt: now, updatedAt: now, assets };
    memoryProjects.set(id, project);
    return structuredClone(project);
  }

  async list(ownerId: string) { return (await this.listPage(ownerId, 1, 100)).items; }

  async listPage(ownerId: string, page: number, pageSize: number): Promise<ProjectListPage> {
    const all = [...memoryProjects.values()].filter((project) => project.ownerId === ownerId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(({ lyrics: _lyrics, assets: _assets, creativeContext: _creativeContext, ...summary }) => summary);
    const items = all.slice((page - 1) * pageSize, page * pageSize);
    return { items, page, pageSize, total: all.length, totalPages: Math.max(1, Math.ceil(all.length / pageSize)) };
  }

  async findOwned(projectId: string, ownerId: string) { const project = memoryProjects.get(projectId); return project?.ownerId === ownerId ? structuredClone(project) : null; }

  async updateDraft(projectId: string, ownerId: string, input: UpdateProjectDraftInput) {
    const project = memoryProjects.get(projectId);
    if (!project || project.ownerId !== ownerId) return null;
    if (input.title !== undefined) project.title = input.title;
    if (input.description !== undefined) project.description = input.description;
    if (input.artistId !== undefined) project.artist = await resolveArtist(input.artistId);
    if (input.eventId !== undefined) project.eventId = input.eventId;
    if (input.currentLyrics !== undefined) project.lyrics = input.currentLyrics;
    project.creativeContext = { ...project.creativeContext, ...(input.creativeContext ?? {}), ...(input.eventId !== undefined ? { eventId: input.eventId } : {}) };
    project.updatedAt = new Date().toISOString();
    return structuredClone(project);
  }
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
