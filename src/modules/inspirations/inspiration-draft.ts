import type { AuthUser } from "@/modules/auth/types";
import { getInspirationRepository } from "./inspiration-repository";
import type { InspirationPrimaryKind, InspirationSnapshot } from "./inspiration-schema";
import { hashSnapshot, summarizeSnapshot } from "./snapshot";

/**
 * 创建私有灵感草稿（docs/SPEC.md：先持久化再关联项目）。
 * 音频/图片上传前必须先有 durable record；未 autosave 有实质内容前不可 attach 到项目。
 */
export async function createInspirationDraft(owner: AuthUser, primaryKind: Exclude<InspirationPrimaryKind, "text">) {
  const snapshot = (primaryKind === "audio"
    ? { primaryKind, title: "", tags: [], audio: { note: "", items: [] } }
    : { primaryKind, title: "", tags: [], image: { note: "", assetIds: [], moods: [] } }
  ) as InspirationSnapshot;

  return getInspirationRepository().create(owner, {
    snapshot,
    contentHash: hashSnapshot(snapshot),
    summary: summarizeSnapshot(snapshot),
    reason: "manual",
  });
}
