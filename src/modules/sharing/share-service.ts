/**
 * 分享与评论流程（docs/SPEC.md 分享页）
 *
 * 所有者为某版本生成 Token 链接；公开页只读播放/评论；支持过期与撤回。
 * 入口：POST /api/projects/[id]/shares、GET /api/public/shares/[token]。
 */
import { createHash, randomBytes } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { getDatabase } from "@/infrastructure/db/client";
import { comments, demoAssets, demoVersions, projects, shareLinks } from "@/infrastructure/db/schema";
import type { AuthUser } from "@/modules/auth/types";
import { getMockVersion } from "@/modules/generation/generation-service";
import { getProjectRepository } from "@/modules/projects/project-repository";
import type { ArtistProfile } from "@/modules/artists/artist-types";
import { DomainError } from "@/shared/errors/domain-error";

export interface PublicComment { id: string; author: string; content: string; atMs: number | null; createdAt: string; }
export interface PublicShare { title: string; description: string | null; lyrics: string | null; artist: ArtistProfile | null; author: string; versionId: string; versionNo: number; demoTitle: string; hasAudio: boolean; audioUrl: string | null; executionKind: "real_local" | "real_external" | "simulated"; allowComments: boolean; comments: PublicComment[]; }
export interface OwnerShareView { id: string; versionId: string; allowComments: boolean; expiresAt: string | null; revokedAt: string | null; createdAt: string; }
export interface OwnerCommentView extends PublicComment { versionId: string; shareId: string; read: boolean; }
interface StoredShare { id: string; token: string; projectId: string; versionId: string; ownerId: string; allowComments: boolean; expiresAt: string | null; revokedAt: string | null; public: PublicShare; }
const songDraftShareStore = globalThis as typeof globalThis & {
  __songDraftShares?: Map<string, StoredShare>;
  __songDraftReadComments?: Set<string>;
  __songDraftDeletedComments?: Set<string>;
};
const mockShares = songDraftShareStore.__songDraftShares ??= new Map<string, StoredShare>();
const mockReadComments = songDraftShareStore.__songDraftReadComments ??= new Set<string>();
const mockDeletedComments = songDraftShareStore.__songDraftDeletedComments ??= new Set<string>();

function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
function freshToken() { return randomBytes(24).toString("base64url"); }
function assertActive(share: Pick<StoredShare, "revokedAt" | "expiresAt">) {
  if (share.revokedAt || (share.expiresAt && new Date(share.expiresAt).getTime() <= Date.now())) throw new DomainError("NOT_FOUND", 404, "分享链接不存在、已过期或已撤回");
}

export class ShareService {
  /** 为指定版本创建分享 Token（库内只存 hash）。 */
  async create(owner: AuthUser, projectId: string, input: { versionId: string; allowComments?: boolean; expiresAt?: string | null }) {
    const allowComments = input.allowComments ?? true;
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date())) throw new DomainError("VALIDATION_FAILED", 422, "有效期必须晚于当前时间");
    const token = freshToken();
    if (!process.env.DATABASE_URL) {
      const version = getMockVersion(input.versionId);
      if (!version || version.ownerId !== owner.id || version.projectId !== projectId) throw new DomainError("NOT_FOUND", 404, "版本不存在或无权分享");
      const project = await getProjectRepository().findOwned(projectId, owner.id);
      const stored: StoredShare = { id: crypto.randomUUID(), token, projectId, versionId: input.versionId, ownerId: owner.id, allowComments, expiresAt: expiresAt?.toISOString() ?? null, revokedAt: null, public: { title: project?.title ?? version.candidate.title, description: project?.description ?? "SongDraft 应援歌曲分享", lyrics: project?.lyrics ?? (String(version.snapshot.lyrics || "") || null), artist: project?.artist ?? null, author: owner.displayName, versionId: input.versionId, versionNo: version.versionNo, demoTitle: version.candidate.title, hasAudio: version.candidate.hasAudio, audioUrl: version.candidate.audioUrl ?? null, executionKind: version.candidate.executionKind, allowComments, comments: [] } };
      mockShares.set(token, stored);
      return { id: stored.id, token, expiresAt: stored.expiresAt, allowComments };
    }
    const db = getDatabase();
    const [version] = await db.select({ id: demoVersions.id, projectId: demoVersions.projectId }).from(demoVersions).innerJoin(projects, eq(projects.id, demoVersions.projectId)).where(and(eq(demoVersions.id, input.versionId), eq(demoVersions.projectId, projectId), eq(projects.ownerId, owner.id))).limit(1);
    if (!version) throw new DomainError("NOT_FOUND", 404, "版本不存在或无权分享");
    const [share] = await db.insert(shareLinks).values({ projectId, versionId: input.versionId, tokenHash: tokenHash(token), allowComments, expiresAt, createdBy: owner.id }).returning({ id: shareLinks.id, expiresAt: shareLinks.expiresAt });
    if (!share) throw new Error("Share creation failed");
    return { id: share.id, token, expiresAt: share.expiresAt?.toISOString() ?? null, allowComments };
  }

  /** 公开访问：校验 Token 有效后返回可播放 Demo 与评论（无管理操作）。 */
  async getPublic(token: string): Promise<PublicShare> {
    if (!process.env.DATABASE_URL) { const share = mockShares.get(token); if (!share) throw new DomainError("NOT_FOUND", 404, "分享链接不存在"); assertActive(share); return { ...share.public, comments: share.public.comments.filter((comment) => !mockDeletedComments.has(comment.id)) }; }
    const db = getDatabase();
    const [share] = await db.select({ id: shareLinks.id, projectId: shareLinks.projectId, versionId: shareLinks.versionId, allowComments: shareLinks.allowComments, expiresAt: shareLinks.expiresAt, revokedAt: shareLinks.revokedAt, title: projects.title, description: projects.description, lyrics: projects.currentLyrics, artist: projects.artistSnapshot, versionNo: demoVersions.versionNo }).from(shareLinks).innerJoin(projects, eq(projects.id, shareLinks.projectId)).innerJoin(demoVersions, eq(demoVersions.id, shareLinks.versionId)).where(eq(shareLinks.tokenHash, tokenHash(token))).limit(1);
    if (!share) throw new DomainError("NOT_FOUND", 404, "分享链接不存在"); assertActive({ expiresAt: share.expiresAt?.toISOString() ?? null, revokedAt: share.revokedAt?.toISOString() ?? null });
    const [asset] = await db.select({ metadata: demoAssets.metadata, executionKind: demoAssets.executionKind }).from(demoAssets).where(eq(demoAssets.versionId, share.versionId)).limit(1);
    const rows = await db.select({ id: comments.id, guestName: comments.guestName, content: comments.content, atMs: comments.atMs, createdAt: comments.createdAt }).from(comments).where(and(eq(comments.shareId, share.id), isNull(comments.deletedAt)));
    return { title: share.title, description: share.description, lyrics: share.lyrics, artist: share.artist as unknown as ArtistProfile | null, author: "SongDraft 创作者", versionId: share.versionId, versionNo: share.versionNo, demoTitle: String(asset?.metadata.title || `${share.title} Demo`), hasAudio: Boolean(asset?.metadata.hasAudio), audioUrl: typeof asset?.metadata.audioUrl === "string" ? asset.metadata.audioUrl : null, executionKind: asset?.executionKind || "simulated", allowComments: share.allowComments, comments: rows.map((row) => ({ id: row.id, author: row.guestName || "SongDraft 用户", content: row.content, atMs: row.atMs, createdAt: row.createdAt.toISOString() })) };
  }

  async list(owner: AuthUser, projectId: string): Promise<OwnerShareView[]> {
    if (!process.env.DATABASE_URL) return [...mockShares.values()].filter((share) => share.ownerId === owner.id && share.projectId === projectId).map((share) => ({ id: share.id, versionId: share.versionId, allowComments: share.allowComments, expiresAt: share.expiresAt, revokedAt: share.revokedAt, createdAt: new Date().toISOString() }));
    const db = getDatabase();
    const rows = await db.select({ id: shareLinks.id, versionId: shareLinks.versionId, allowComments: shareLinks.allowComments, expiresAt: shareLinks.expiresAt, revokedAt: shareLinks.revokedAt, createdAt: shareLinks.createdAt }).from(shareLinks).innerJoin(projects, eq(projects.id, shareLinks.projectId)).where(and(eq(shareLinks.projectId, projectId), eq(projects.ownerId, owner.id)));
    return rows.map((row) => ({ id: row.id, versionId: row.versionId, allowComments: row.allowComments, expiresAt: row.expiresAt?.toISOString() ?? null, revokedAt: row.revokedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString() }));
  }

  /** 撤回分享链接，后续公开访问返回不存在。 */
  async revoke(owner: AuthUser, shareId: string) {
    if (!process.env.DATABASE_URL) { const share = [...mockShares.values()].find((item) => item.id === shareId && item.ownerId === owner.id); if (!share) throw new DomainError("NOT_FOUND", 404, "分享链接不存在"); share.revokedAt = new Date().toISOString(); return { id: shareId, revokedAt: share.revokedAt }; }
    const db = getDatabase();
    const [share] = await db.select({ id: shareLinks.id }).from(shareLinks).innerJoin(projects, eq(projects.id, shareLinks.projectId)).where(and(eq(shareLinks.id, shareId), eq(projects.ownerId, owner.id))).limit(1);
    if (!share) throw new DomainError("NOT_FOUND", 404, "分享链接不存在"); const revokedAt = new Date(); await db.update(shareLinks).set({ revokedAt }).where(eq(shareLinks.id, shareId)); return { id: shareId, revokedAt: revokedAt.toISOString() };
  }

  async listComments(owner: AuthUser, projectId: string): Promise<OwnerCommentView[]> {
    if (!process.env.DATABASE_URL) return [...mockShares.values()].filter((share) => share.ownerId === owner.id && share.projectId === projectId).flatMap((share) => share.public.comments.filter((comment) => !mockDeletedComments.has(comment.id)).map((comment) => ({ ...comment, versionId: share.versionId, shareId: share.id, read: mockReadComments.has(comment.id) }))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const db = getDatabase();
    const rows = await db.select({ id: comments.id, versionId: comments.versionId, shareId: comments.shareId, guestName: comments.guestName, content: comments.content, atMs: comments.atMs, createdAt: comments.createdAt, readAt: comments.readAt }).from(comments).innerJoin(projects, eq(projects.id, comments.projectId)).where(and(eq(comments.projectId, projectId), eq(projects.ownerId, owner.id), isNull(comments.deletedAt)));
    return rows.map((row) => ({ id: row.id, versionId: row.versionId, shareId: row.shareId, author: row.guestName || "SongDraft 用户", content: row.content, atMs: row.atMs, createdAt: row.createdAt.toISOString(), read: Boolean(row.readAt) })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async markCommentRead(owner: AuthUser, commentId: string) {
    if (!process.env.DATABASE_URL) { const exists = [...mockShares.values()].some((share) => share.ownerId === owner.id && share.public.comments.some((comment) => comment.id === commentId)); if (!exists || mockDeletedComments.has(commentId)) throw new DomainError("NOT_FOUND", 404, "评论不存在"); mockReadComments.add(commentId); return { id: commentId, read: true }; }
    const db = getDatabase();
    const [comment] = await db.select({ id: comments.id }).from(comments).innerJoin(projects, eq(projects.id, comments.projectId)).where(and(eq(comments.id, commentId), eq(projects.ownerId, owner.id), isNull(comments.deletedAt))).limit(1);
    if (!comment) throw new DomainError("NOT_FOUND", 404, "评论不存在"); await db.update(comments).set({ readAt: new Date() }).where(eq(comments.id, commentId)); return { id: commentId, read: true };
  }

  async deleteComment(owner: AuthUser, commentId: string) {
    if (!process.env.DATABASE_URL) { const exists = [...mockShares.values()].some((share) => share.ownerId === owner.id && share.public.comments.some((comment) => comment.id === commentId)); if (!exists || mockDeletedComments.has(commentId)) throw new DomainError("NOT_FOUND", 404, "评论不存在"); mockDeletedComments.add(commentId); return { id: commentId, deleted: true }; }
    const db = getDatabase();
    const [comment] = await db.select({ id: comments.id }).from(comments).innerJoin(projects, eq(projects.id, comments.projectId)).where(and(eq(comments.id, commentId), eq(projects.ownerId, owner.id), isNull(comments.deletedAt))).limit(1);
    if (!comment) throw new DomainError("NOT_FOUND", 404, "评论不存在"); await db.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, commentId)); return { id: commentId, deleted: true };
  }

  async comment(token: string, input: { content: string; guestName?: string; atMs?: number | null }, user: AuthUser | null) {
    const content = input.content.trim();
    if (!content || content.length > 1000) throw new DomainError("VALIDATION_FAILED", 422, "评论需为 1–1000 字");
    const atMs = input.atMs ?? null;
    if (atMs !== null && (!Number.isInteger(atMs) || atMs < 0)) throw new DomainError("VALIDATION_FAILED", 422, "时间点无效");
    if (!user && (!input.guestName?.trim() || input.guestName.trim().length > 40)) throw new DomainError("VALIDATION_FAILED", 422, "访客昵称需为 1–40 字");
    if (!process.env.DATABASE_URL) { const share = mockShares.get(token); if (!share) throw new DomainError("NOT_FOUND", 404, "分享链接不存在"); assertActive(share); if (!share.allowComments) throw new DomainError("FORBIDDEN", 403, "该分享未开放评论"); const comment: PublicComment = { id: crypto.randomUUID(), author: user?.displayName || input.guestName!.trim(), content, atMs, createdAt: new Date().toISOString() }; share.public.comments.push(comment); return comment; }
    const db = getDatabase();
    const [share] = await db.select({ id: shareLinks.id, projectId: shareLinks.projectId, versionId: shareLinks.versionId, allowComments: shareLinks.allowComments, expiresAt: shareLinks.expiresAt, revokedAt: shareLinks.revokedAt }).from(shareLinks).where(eq(shareLinks.tokenHash, tokenHash(token))).limit(1);
    if (!share) throw new DomainError("NOT_FOUND", 404, "分享链接不存在"); assertActive({ expiresAt: share.expiresAt?.toISOString() ?? null, revokedAt: share.revokedAt?.toISOString() ?? null }); if (!share.allowComments) throw new DomainError("FORBIDDEN", 403, "该分享未开放评论");
    const [comment] = await db.insert(comments).values({ projectId: share.projectId, versionId: share.versionId, shareId: share.id, authorUserId: user?.id ?? null, guestName: user ? null : input.guestName!.trim(), content, atMs }).returning();
    if (!comment) throw new Error("Comment creation failed"); return { id: comment.id, author: user?.displayName || input.guestName!.trim(), content: comment.content, atMs: comment.atMs, createdAt: comment.createdAt.toISOString() };
  }
}
