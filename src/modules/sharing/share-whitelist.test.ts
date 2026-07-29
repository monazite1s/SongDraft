/**
 * 分享白名单授权测试（docs/SPEC.md §7 分享权限）。
 * 覆盖：未登录 401、owner 放行、首次有效访问授权、撤销后 403、owner 列/撤销 grant。
 */
import { afterEach, expect, test } from "vitest";

import { GenerationService } from "@/modules/generation/generation-service";
import { BriefService } from "@/modules/projects/brief-service";
import { MockProjectRepository } from "@/modules/projects/project-repository";
import { ProjectService } from "@/modules/projects/project-service";
import { ShareService } from "./share-service";
import type { AuthUser } from "@/modules/auth/types";

const owner: AuthUser = { id: "00000000-0000-4000-8000-000000000077", email: "owner@example.test", displayName: "分享作者" };
const visitor: AuthUser = { id: "00000000-0000-4000-8000-000000000088", email: "visitor@example.test", displayName: "访问者甲" };
const visitor2: AuthUser = { id: "00000000-0000-4000-8000-000000000099", email: "visitor2@example.test", displayName: "访问者乙" };

/** 清空 mock grant store，避免用例间相互污染。 */
afterEach(() => {
  const store = globalThis as typeof globalThis & { __songDraftShareGrants?: Map<string, unknown> };
  store.__songDraftShareGrants?.clear();
});

async function seedShare() {
  const project = await new ProjectService(new MockProjectRepository()).create(owner, { title: "夜航", description: "夜航灯光", lyrics: "夜色铺开回家的路" });
  const brief = await new BriefService().generate(owner, project.id);
  const generation = await new GenerationService().generate(owner, { projectId: project.id, briefId: brief.id, lyrics: project.lyrics });
  const { saved } = await new GenerationService().saveCandidates(owner, { projectId: project.id, candidateIds: [generation.candidates[0]!.id] });
  const link = await new ShareService().create(owner, project.id, { versionId: saved[0]!.id });
  return { project, link };
}

test("getPublic 未登录返回 401", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const { link } = await seedShare();
  await expect(new ShareService().getPublic(link.token, null)).rejects.toMatchObject({ code: "UNAUTHENTICATED", status: 401 });
  if (original) process.env.DATABASE_URL = original;
});

test("owner 直接放行 getPublic", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const { link } = await seedShare();
  const share = await new ShareService().getPublic(link.token, owner);
  expect(share.title).toBe("夜航");
  if (original) process.env.DATABASE_URL = original;
});

test("已登录访问者首次访问自动建立授权并放行", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const { link } = await seedShare();
  const service = new ShareService();
  // 首次访问：自动授权。
  const share = await service.getPublic(link.token, visitor);
  expect(share.title).toBe("夜航");
  // owner 可在 grant 列表中看到该访问者。
  const grants = await service.listGrants(owner, link.id);
  expect(grants).toHaveLength(1);
  expect(grants[0]?.accessorId).toBe(visitor.id);
  expect(grants[0]?.revokedAt).toBeNull();
  if (original) process.env.DATABASE_URL = original;
});

test("owner 撤销授权后访问者再次访问被拒（403）", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const { link } = await seedShare();
  const service = new ShareService();
  // 首次访问建立授权。
  await service.getPublic(link.token, visitor);
  const grants = await service.listGrants(owner, link.id);
  const grantId = grants[0]!.id;
  // owner 撤销该授权。
  await service.revokeGrant(owner, link.id, grantId);
  // 访问者再次访问 → 403，且不泄露标题。
  await expect(service.getPublic(link.token, visitor)).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  if (original) process.env.DATABASE_URL = original;
});

test("已被撤销授权的访问者评论被拒（403）", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const { link } = await seedShare();
  const service = new ShareService();
  await service.getPublic(link.token, visitor);
  const grantId = (await service.listGrants(owner, link.id))[0]!.id;
  await service.revokeGrant(owner, link.id, grantId);
  // 被撤销后登录用户评论 → 403。
  await expect(service.comment(link.token, { content: "再来一句", atMs: 1000 }, visitor)).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  if (original) process.env.DATABASE_URL = original;
});

test("未授权登录用户直进评论被拒（403）", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const { link } = await seedShare();
  const service = new ShareService();
  // visitor2 从未通过 getPublic 建立授权，直接评论 → 403。
  await expect(service.comment(link.token, { content: "直进评论", atMs: 1000 }, visitor2)).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  if (original) process.env.DATABASE_URL = original;
});

test("owner 可列出与撤销 grant，且非 owner 不可操作", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const { link } = await seedShare();
  const service = new ShareService();
  await service.getPublic(link.token, visitor);
  await service.getPublic(link.token, visitor2);
  // owner 列出 → 两条授权。
  let grants = await service.listGrants(owner, link.id);
  expect(grants).toHaveLength(2);
  // 撤销其中一条。
  await service.revokeGrant(owner, link.id, grants[0]!.id);
  grants = await service.listGrants(owner, link.id);
  const revoked = grants.find((g) => g.id === grants[0]!.id) ?? grants.find((g) => g.revokedAt);
  expect(revoked?.revokedAt).not.toBeNull();
  // 非 owner 列 grant → NOT_FOUND（不泄露归属信息）。
  await expect(service.listGrants(visitor, link.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  // 非 owner 撤销 grant → NOT_FOUND。
  await expect(service.revokeGrant(visitor, link.id, grants[0]!.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  if (original) process.env.DATABASE_URL = original;
});

test("访客评论（未登录）保留 guestName 兼容", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const { link } = await seedShare();
  const comment = await new ShareService().comment(link.token, { guestName: "制作人", content: "副歌再亮一点", atMs: 2000 }, null);
  expect(comment.author).toBe("制作人");
  if (original) process.env.DATABASE_URL = original;
});
