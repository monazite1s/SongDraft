import { expect, test } from "vitest";

import type { AuthUser } from "@/modules/auth/types";
import { MockInspirationRepository } from "./inspiration-repository";
import { InspirationService } from "./inspiration-service";
import type { InspirationSnapshot } from "./inspiration-schema";

const owner: AuthUser = { id: "00000000-0000-4000-8000-000000000020", email: "lib@example.test", displayName: "灵感库" };
const other: AuthUser = { id: "00000000-0000-4000-8000-000000000021", email: "other@example.test", displayName: "他人" };

const service = () => new InspirationService(new MockInspirationRepository(new Map(), new Map()));

function textSnapshot(content: string, tags: string[] = []): InspirationSnapshot {
  return { primaryKind: "text", title: "", tags, text: { inspirationType: "lyric", content } } as unknown as InspirationSnapshot;
}
function audioSnapshot(label = "旋律"): InspirationSnapshot {
  return { primaryKind: "audio", title: "", tags: [], audio: { items: [{ assetId: crypto.randomUUID(), label }] } } as unknown as InspirationSnapshot;
}

test("listPage filters by kind/tag and paginates server-side", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const svc = service();
  await svc.create(owner, { snapshot: textSnapshot("歌词一", ["怀旧"]) });
  await svc.create(owner, { snapshot: audioSnapshot() });
  await svc.create(owner, { snapshot: textSnapshot("歌词二") });

  expect((await svc.list(owner.id, {})).total).toBe(3);
  expect((await svc.list(owner.id, { kinds: ["text"] })).total).toBe(2);
  expect((await svc.list(owner.id, { tags: ["怀旧"] })).total).toBe(1);

  const page1 = await svc.list(owner.id, { pageSize: 2, page: 1 });
  expect(page1.items).toHaveLength(2);
  expect(page1.totalPages).toBe(2);
  const page2 = await svc.list(owner.id, { pageSize: 2, page: 2 });
  expect(page2.items).toHaveLength(1);
  if (original) process.env.DATABASE_URL = original;
});

test("records are isolated by owner", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const svc = service();
  await svc.create(owner, { snapshot: textSnapshot("只属于我") });
  expect((await svc.list(other.id, {})).total).toBe(0);
  await expect(svc.getDetail(other.id, (await svc.list(owner.id, {})).items[0]!.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  if (original) process.env.DATABASE_URL = original;
});

test("restoreVersion re-points current to the target snapshot without deleting history", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const svc = service();
  const record = await svc.create(owner, { snapshot: textSnapshot("原始歌词") });
  const autosaved = await svc.autosave(owner.id, record.id, { snapshot: textSnapshot("修改后歌词"), reason: "manual" });
  expect(autosaved.versionCreated).toBe(true);

  const versions = await svc.listVersions(owner.id, record.id);
  expect(versions).toHaveLength(2);
  const v1 = versions.find((v) => v.versionNo === 1)!;

  const restored = await svc.restoreVersion(owner.id, record.id, v1.id);
  expect(restored.currentSnapshot.text?.content).toBe("原始歌词");
  // 去重模型下恢复不新增/删除版本行，历史仍为 2 条。
  expect((await svc.listVersions(owner.id, record.id))).toHaveLength(2);
  if (original) process.env.DATABASE_URL = original;
});

test("soft delete makes the record inaccessible", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const svc = service();
  const record = await svc.create(owner, { snapshot: textSnapshot("删我") });
  await svc.remove(owner.id, record.id);
  expect((await svc.list(owner.id, {})).total).toBe(0);
  await expect(svc.getDetail(owner.id, record.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  if (original) process.env.DATABASE_URL = original;
});
