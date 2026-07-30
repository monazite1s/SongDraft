/**
 * 分享与评论流程（docs/SPEC.md 分享页）
 *
 * 所有者为某版本生成 Token 链接；公开页只读播放/评论；支持过期与撤回。
 * 入口：POST /api/projects/[id]/shares、GET /api/public/shares/[token]。
 */
import { createHash, randomBytes } from "node:crypto";

import { and, desc, eq, isNull } from "drizzle-orm";

import { getDatabase } from "@/infrastructure/db/client";
import { comments, demoAssets, demoVersions, profiles, projects, shareAccessGrants, shareLinks } from "@/infrastructure/db/schema";
import { resolveAudioUrl } from "@/infrastructure/storage/transfer";
import type { AuthUser } from "@/modules/auth/types";
import { getMockVersion } from "@/modules/generation/generation-service";
import { getProjectRepository } from "@/modules/projects/project-repository";
import type { ArtistProfile } from "@/modules/artists/artist-types";
import { DomainError } from "@/shared/errors/domain-error";

export interface PublicComment { id: string; author: string; content: string; atMs: number | null; createdAt: string; }
export interface PublicShare { title: string; description: string | null; lyrics: string | null; artist: ArtistProfile | null; author: string; versionId: string; versionNo: number; demoTitle: string; hasAudio: boolean; audioUrl: string | null; executionKind: "real_local" | "real_external" | "simulated"; allowComments: boolean; comments: PublicComment[]; }
export interface OwnerShareView { id: string; versionId: string; allowComments: boolean; expiresAt: string | null; revokedAt: string | null; createdAt: string; }
export interface OwnerCommentView extends PublicComment { versionId: string; shareId: string | null; read: boolean; }
export interface AccessGrantView { id: string; accessorId: string; accessorDisplayName: string; accessorEmail: string; firstAccessedAt: string | null; lastAccessedAt: string | null; revokedAt: string | null; }
interface StoredShare { id: string; token: string; projectId: string; versionId: string; ownerId: string; allowComments: boolean; expiresAt: string | null; revokedAt: string | null; public: PublicShare; }
interface StoredGrant { id: string; shareId: string; projectId: string; accessorUserId: string; accessorDisplayName: string; accessorEmail: string; grantedBy: string; firstAccessedAt: string | null; lastAccessedAt: string | null; revokedAt: string | null; }
const songDraftShareStore = globalThis as typeof globalThis & {
  __songDraftShares?: Map<string, StoredShare>;
  __songDraftReadComments?: Set<string>;
  __songDraftDeletedComments?: Set<string>;
  __songDraftShareGrants?: Map<string, StoredGrant>;
};
const mockShares = songDraftShareStore.__songDraftShares ??= new Map<string, StoredShare>();
const mockReadComments = songDraftShareStore.__songDraftReadComments ??= new Set<string>();
const mockDeletedComments = songDraftShareStore.__songDraftDeletedComments ??= new Set<string>();
const mockGrants = songDraftShareStore.__songDraftShareGrants ??= new Map<string, StoredGrant>();

function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
function freshToken() { return randomBytes(24).toString("base64url"); }
function assertActive(share: Pick<StoredShare, "revokedAt" | "expiresAt">) {
  if (share.revokedAt || (share.expiresAt && new Date(share.expiresAt).getTime() <= Date.now())) throw new DomainError("NOT_FOUND", 404, "分享链接不存在、已过期或已撤回");
}
function requireLogin(user: AuthUser | null): asserts user is AuthUser {
  if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录后查看分享");
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

  /** 公开访问：校验 Token + 登录 + 白名单授权后返回可播放 Demo 与评论。 */
  async getPublic(token: string, user: AuthUser | null): Promise<PublicShare> {
    requireLogin(user);
    if (!process.env.DATABASE_URL) {
      const share = mockShares.get(token);
      if (!share) throw new DomainError("NOT_FOUND", 404, "分享链接不存在");
      assertActive(share);
      await this.authorizeMockAccess(share, user);
      // 评论归属于版本：owner 在详情页的评论（挂在占位 share 上）与各分享链接下的评论
      // 同属一个 versionId，互相可见（避免按 shareId 切割导致看不到对方的评论）。
      const versionComments = [...mockShares.values()]
        .filter((s) => s.versionId === share.versionId)
        .flatMap((s) => s.public.comments)
        .filter((comment) => !mockDeletedComments.has(comment.id));
      return { ...share.public, comments: versionComments };
    }
    const db = getDatabase();
    const [share] = await db.select({ id: shareLinks.id, projectId: shareLinks.projectId, ownerId: projects.ownerId, versionId: shareLinks.versionId, allowComments: shareLinks.allowComments, expiresAt: shareLinks.expiresAt, revokedAt: shareLinks.revokedAt, title: projects.title, description: projects.description, lyrics: projects.currentLyrics, artist: projects.artistSnapshot, versionNo: demoVersions.versionNo }).from(shareLinks).innerJoin(projects, eq(projects.id, shareLinks.projectId)).innerJoin(demoVersions, eq(demoVersions.id, shareLinks.versionId)).where(eq(shareLinks.tokenHash, tokenHash(token))).limit(1);
    if (!share) throw new DomainError("NOT_FOUND", 404, "分享链接不存在"); assertActive({ expiresAt: share.expiresAt?.toISOString() ?? null, revokedAt: share.revokedAt?.toISOString() ?? null });
    await this.ensureDbGrant(share.id, share.projectId, share.ownerId, user);
    const [asset] = await db.select({ metadata: demoAssets.metadata, objectKey: demoAssets.objectKey, executionKind: demoAssets.executionKind }).from(demoAssets).where(eq(demoAssets.versionId, share.versionId)).limit(1);
    const rows = await db.select({ id: comments.id, authorDisplayName: profiles.displayName, guestName: comments.guestName, content: comments.content, atMs: comments.atMs, createdAt: comments.createdAt }).from(comments).leftJoin(profiles, eq(profiles.id, comments.authorUserId)).where(and(eq(comments.versionId, share.versionId), isNull(comments.deletedAt)));
    // 解析签名播放 URL：有 COS objectKey/cosObjectKey → 短时签名；否则回退 asset 的 audioUrl。
    const shareCosKey = typeof asset?.metadata.cosObjectKey === "string" ? asset.metadata.cosObjectKey : asset?.objectKey;
    const shareFallback = typeof asset?.metadata.audioUrl === "string" ? asset.metadata.audioUrl : null;
    const resolvedAudioUrl = await resolveAudioUrl(shareCosKey, shareFallback);
    return { title: share.title, description: share.description, lyrics: share.lyrics, artist: share.artist as unknown as ArtistProfile | null, author: "SongDraft 创作者", versionId: share.versionId, versionNo: share.versionNo, demoTitle: String(asset?.metadata.title || `${share.title} Demo`), hasAudio: Boolean(asset?.metadata.hasAudio), audioUrl: resolvedAudioUrl, executionKind: asset?.executionKind || "simulated", allowComments: share.allowComments, comments: rows.map((row) => ({ id: row.id, author: row.authorDisplayName ?? row.guestName ?? "SongDraft 用户", content: row.content, atMs: row.atMs, createdAt: row.createdAt.toISOString() })) };
  }

  /**
   * Mock 白名单授权：owner 直接放行；已登录访问者首次有效访问建立授权，
   * 已有未撤销授权则刷新 lastAccessedAt，无授权（含已撤销）则 403（不泄露标题/封面）。
   */
  private async authorizeMockAccess(share: StoredShare, user: AuthUser) {
    if (share.ownerId === user.id) return;
    const grants = [...mockGrants.values()].filter((g) => g.shareId === share.id && g.accessorUserId === user.id);
    const active = grants.find((g) => !g.revokedAt);
    if (active) { active.lastAccessedAt = new Date().toISOString(); return; }
    // 该访问者此前从未建立过授权 → 首次有效访问自动授权；若仅有已撤销记录 → 403。
    if (grants.length > 0) throw new DomainError("FORBIDDEN", 403, "无访问权限");
    const now = new Date().toISOString();
    const grant: StoredGrant = { id: crypto.randomUUID(), shareId: share.id, projectId: share.projectId, accessorUserId: user.id, accessorDisplayName: user.displayName, accessorEmail: user.email, grantedBy: share.ownerId, firstAccessedAt: now, lastAccessedAt: now, revokedAt: null };
    mockGrants.set(grant.id, grant);
  }

  /**
   * Drizzle 白名单授权：owner 放行；其余访问者——存在未撤销 grant 则刷新 lastAccessedAt，
   * 从无授权记录则首次有效访问自动授权，仅有已撤销记录则 403。
   */
  private async ensureDbGrant(shareId: string, projectId: string, ownerId: string, user: AuthUser) {
    if (ownerId === user.id) return;
    const db = getDatabase();
    const now = new Date();
    const rows = await db.select({ id: shareAccessGrants.id, revokedAt: shareAccessGrants.revokedAt }).from(shareAccessGrants).where(and(eq(shareAccessGrants.shareId, shareId), eq(shareAccessGrants.accessorUserId, user.id)));
    const active = rows.find((r) => !r.revokedAt);
    if (active) { await db.update(shareAccessGrants).set({ lastAccessedAt: now }).where(eq(shareAccessGrants.id, active.id)); return; }
    if (rows.length > 0) throw new DomainError("FORBIDDEN", 403, "无访问权限");
    try { await db.insert(shareAccessGrants).values({ shareId, projectId, accessorUserId: user.id, grantedBy: ownerId, firstAccessedAt: now, lastAccessedAt: now }); }
    catch { /* partial unique 冲突（并发首次访问）→ 视为已授权 */ }
  }

  /** 校验访问者持有未撤销授权或是 owner；否则 403。供 comment 等操作复用。 */
  private async assertMockGrant(share: StoredShare, user: AuthUser) {
    if (share.ownerId === user.id) return;
    const has = [...mockGrants.values()].some((g) => g.shareId === share.id && g.accessorUserId === user.id && !g.revokedAt);
    if (!has) throw new DomainError("FORBIDDEN", 403, "无访问权限");
  }
  private async assertDbGrant(shareId: string, ownerId: string, user: AuthUser) {
    if (ownerId === user.id) return;
    const db = getDatabase();
    const [grant] = await db.select({ id: shareAccessGrants.id }).from(shareAccessGrants).where(and(eq(shareAccessGrants.shareId, shareId), eq(shareAccessGrants.accessorUserId, user.id), isNull(shareAccessGrants.revokedAt))).limit(1);
    if (!grant) throw new DomainError("FORBIDDEN", 403, "无访问权限");
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
    const rows = await db.select({ id: comments.id, versionId: comments.versionId, shareId: comments.shareId, authorDisplayName: profiles.displayName, guestName: comments.guestName, content: comments.content, atMs: comments.atMs, createdAt: comments.createdAt, readAt: comments.readAt }).from(comments).innerJoin(projects, eq(projects.id, comments.projectId)).leftJoin(profiles, eq(profiles.id, comments.authorUserId)).where(and(eq(comments.projectId, projectId), eq(projects.ownerId, owner.id), isNull(comments.deletedAt)));
    return rows.map((row) => ({ id: row.id, versionId: row.versionId, shareId: row.shareId, author: row.authorDisplayName ?? row.guestName ?? "SongDraft 用户", content: row.content, atMs: row.atMs, createdAt: row.createdAt.toISOString(), read: Boolean(row.readAt) })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

  /**
   * Owner 在歌曲详情页（/works/[projectId]/v/[versionId]）按音频时间点发表评论。
   * 与公开分享评论不同：不需要 share token；author 为 owner 自身；readAt 直接置为已读。
   * 评论归属校验：项目属 owner + 版本属项目。
   */
  async ownerComment(owner: AuthUser, projectId: string, input: { versionId: string; content: string; atMs?: number | null }): Promise<OwnerCommentView> {
    const content = input.content.trim();
    if (!content || content.length > 1000) throw new DomainError("VALIDATION_FAILED", 422, "评论需为 1–1000 字");
    const atMs = input.atMs ?? null;
    if (atMs !== null && (!Number.isInteger(atMs) || atMs < 0)) throw new DomainError("VALIDATION_FAILED", 422, "时间点无效");
    if (!process.env.DATABASE_URL) {
      // Mock：校验版本属该项目所有者后，落内存 store（挂在一条占位 share 上便于 listComments 回读）。
      const version = getMockVersion(input.versionId);
      if (!version || version.ownerId !== owner.id || version.projectId !== projectId) throw new DomainError("NOT_FOUND", 404, "版本不存在或无权评论");
      const now = new Date().toISOString();
      const comment: OwnerCommentView = { id: crypto.randomUUID(), author: owner.displayName, content, atMs, createdAt: now, versionId: input.versionId, shareId: null, read: true };
      // 复用 owner 的占位 share（若无则新建一条仅用于承载 owner 自评）。
      let placeholder = [...mockShares.values()].find((s) => s.ownerId === owner.id && s.projectId === projectId && s.versionId === input.versionId);
      if (!placeholder) {
        const project = await getProjectRepository().findOwned(projectId, owner.id);
        const token = freshToken();
        placeholder = { id: crypto.randomUUID(), token, projectId, versionId: input.versionId, ownerId: owner.id, allowComments: true, expiresAt: null, revokedAt: null, public: { title: project?.title ?? "SongDraft", description: project?.description ?? null, lyrics: project?.lyrics ?? null, artist: project?.artist ?? null, author: owner.displayName, versionId: input.versionId, versionNo: version.versionNo, demoTitle: version.candidate.title, hasAudio: version.candidate.hasAudio, audioUrl: version.candidate.audioUrl ?? null, executionKind: version.candidate.executionKind, allowComments: true, comments: [] } };
        mockShares.set(token, placeholder);
      }
      placeholder.public.comments.push({ id: comment.id, author: comment.author, content: comment.content, atMs: comment.atMs, createdAt: comment.createdAt });
      return comment;
    }
    const db = getDatabase();
    const [version] = await db.select({ id: demoVersions.id }).from(demoVersions).innerJoin(projects, eq(projects.id, demoVersions.projectId)).where(and(eq(demoVersions.id, input.versionId), eq(demoVersions.projectId, projectId), eq(projects.ownerId, owner.id))).limit(1);
    if (!version) throw new DomainError("NOT_FOUND", 404, "版本不存在或无权评论");
    const now = new Date();
    const [comment] = await db.insert(comments).values({ projectId, versionId: input.versionId, shareId: null, authorUserId: owner.id, guestName: null, content, atMs, readAt: now }).returning();
    if (!comment) throw new Error("Comment creation failed");
    return { id: comment.id, versionId: comment.versionId, shareId: comment.shareId, author: owner.displayName, content: comment.content, atMs: comment.atMs, createdAt: comment.createdAt.toISOString(), read: Boolean(comment.readAt) };
  }

  async comment(token: string, input: { content: string; guestName?: string; atMs?: number | null }, user: AuthUser | null) {
    const content = input.content.trim();
    if (!content || content.length > 1000) throw new DomainError("VALIDATION_FAILED", 422, "评论需为 1–1000 字");
    const atMs = input.atMs ?? null;
    if (atMs !== null && (!Number.isInteger(atMs) || atMs < 0)) throw new DomainError("VALIDATION_FAILED", 422, "时间点无效");
    if (!user && (!input.guestName?.trim() || input.guestName.trim().length > 40)) throw new DomainError("VALIDATION_FAILED", 422, "访客昵称需为 1–40 字");
    if (!process.env.DATABASE_URL) {
      const share = mockShares.get(token);
      if (!share) throw new DomainError("NOT_FOUND", 404, "分享链接不存在");
      assertActive(share);
      if (!share.allowComments) throw new DomainError("FORBIDDEN", 403, "该分享未开放评论");
      if (user) await this.assertMockGrant(share, user);
      const comment: PublicComment = { id: crypto.randomUUID(), author: user?.displayName || input.guestName!.trim(), content, atMs, createdAt: new Date().toISOString() };
      share.public.comments.push(comment); return comment;
    }
    const db = getDatabase();
    const [share] = await db.select({ id: shareLinks.id, projectId: shareLinks.projectId, ownerId: projects.ownerId, versionId: shareLinks.versionId, allowComments: shareLinks.allowComments, expiresAt: shareLinks.expiresAt, revokedAt: shareLinks.revokedAt }).from(shareLinks).innerJoin(projects, eq(projects.id, shareLinks.projectId)).where(eq(shareLinks.tokenHash, tokenHash(token))).limit(1);
    if (!share) throw new DomainError("NOT_FOUND", 404, "分享链接不存在"); assertActive({ expiresAt: share.expiresAt?.toISOString() ?? null, revokedAt: share.revokedAt?.toISOString() ?? null }); if (!share.allowComments) throw new DomainError("FORBIDDEN", 403, "该分享未开放评论");
    if (user) await this.assertDbGrant(share.id, share.ownerId, user);
    const [comment] = await db.insert(comments).values({ projectId: share.projectId, versionId: share.versionId, shareId: share.id, authorUserId: user?.id ?? null, guestName: user ? null : input.guestName!.trim(), content, atMs }).returning();
    if (!comment) throw new Error("Comment creation failed"); return { id: comment.id, author: user?.displayName || input.guestName!.trim(), content: comment.content, atMs: comment.atMs, createdAt: comment.createdAt.toISOString() };
  }

  /** Owner 列出某分享的访问授权（含已撤销，便于审计）。 */
  async listGrants(owner: AuthUser, shareId: string): Promise<AccessGrantView[]> {
    if (!process.env.DATABASE_URL) {
      const share = [...mockShares.values()].find((item) => item.id === shareId && item.ownerId === owner.id);
      if (!share) throw new DomainError("NOT_FOUND", 404, "分享链接不存在");
      return [...mockGrants.values()].filter((g) => g.shareId === shareId)
        .map((g) => ({ id: g.id, accessorId: g.accessorUserId, accessorDisplayName: g.accessorDisplayName, accessorEmail: g.accessorEmail, firstAccessedAt: g.firstAccessedAt, lastAccessedAt: g.lastAccessedAt, revokedAt: g.revokedAt }))
        .sort((a, b) => (b.firstAccessedAt ?? "").localeCompare(a.firstAccessedAt ?? ""));
    }
    const db = getDatabase();
    const [share] = await db.select({ id: shareLinks.id }).from(shareLinks).innerJoin(projects, eq(projects.id, shareLinks.projectId)).where(and(eq(shareLinks.id, shareId), eq(projects.ownerId, owner.id))).limit(1);
    if (!share) throw new DomainError("NOT_FOUND", 404, "分享链接不存在");
    const rows = await db.select({ id: shareAccessGrants.id, accessorId: shareAccessGrants.accessorUserId, accessorDisplayName: profiles.displayName, accessorEmail: profiles.email, firstAccessedAt: shareAccessGrants.firstAccessedAt, lastAccessedAt: shareAccessGrants.lastAccessedAt, revokedAt: shareAccessGrants.revokedAt }).from(shareAccessGrants).innerJoin(profiles, eq(profiles.id, shareAccessGrants.accessorUserId)).where(eq(shareAccessGrants.shareId, shareId)).orderBy(desc(shareAccessGrants.firstAccessedAt));
    return rows.map((row) => ({ id: row.id, accessorId: row.accessorId, accessorDisplayName: row.accessorDisplayName, accessorEmail: row.accessorEmail, firstAccessedAt: row.firstAccessedAt?.toISOString() ?? null, lastAccessedAt: row.lastAccessedAt?.toISOString() ?? null, revokedAt: row.revokedAt?.toISOString() ?? null }));
  }

  /** Owner 撤销某访问者的授权，撤销后该访问者再访问将被拒绝（403）。 */
  async revokeGrant(owner: AuthUser, shareId: string, grantId: string) {
    if (!process.env.DATABASE_URL) {
      const share = [...mockShares.values()].find((item) => item.id === shareId && item.ownerId === owner.id);
      if (!share) throw new DomainError("NOT_FOUND", 404, "分享链接不存在");
      const grant = mockGrants.get(grantId);
      if (!grant || grant.shareId !== shareId) throw new DomainError("NOT_FOUND", 404, "授权记录不存在");
      grant.revokedAt = new Date().toISOString();
      return { id: grantId, revokedAt: grant.revokedAt };
    }
    const db = getDatabase();
    const [share] = await db.select({ id: shareLinks.id }).from(shareLinks).innerJoin(projects, eq(projects.id, shareLinks.projectId)).where(and(eq(shareLinks.id, shareId), eq(projects.ownerId, owner.id))).limit(1);
    if (!share) throw new DomainError("NOT_FOUND", 404, "分享链接不存在");
    const [grant] = await db.select({ id: shareAccessGrants.id }).from(shareAccessGrants).where(and(eq(shareAccessGrants.id, grantId), eq(shareAccessGrants.shareId, shareId))).limit(1);
    if (!grant) throw new DomainError("NOT_FOUND", 404, "授权记录不存在");
    const revokedAt = new Date();
    await db.update(shareAccessGrants).set({ revokedAt }).where(eq(shareAccessGrants.id, grantId));
    return { id: grantId, revokedAt: revokedAt.toISOString() };
  }
}
