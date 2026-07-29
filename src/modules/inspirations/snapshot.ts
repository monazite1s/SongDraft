import { createHash } from "node:crypto";

import type { InspirationSnapshot } from "./inspiration-schema";

type CanonicalValue = null | boolean | number | string | CanonicalValue[] | { [key: string]: CanonicalValue };

/**
 * Produces deterministic JSON for snapshots. Object keys are sorted while array
 * order is preserved because audio and image order is part of the user intent.
 */
export function canonicalizeSnapshot(value: unknown): CanonicalValue {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.replace(/\r\n?/g, "\n");
  if (Array.isArray(value)) return value.map(canonicalizeSnapshot);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.keys(record).sort().reduce<Record<string, CanonicalValue>>((result, key) => {
      result[key] = canonicalizeSnapshot(record[key]);
      return result;
    }, {});
  }
  throw new TypeError("灵感快照包含不支持的值");
}

export function hashSnapshot(snapshot: InspirationSnapshot) {
  return createHash("sha256").update(JSON.stringify(canonicalizeSnapshot(snapshot))).digest("hex");
}

export function summarizeSnapshot(snapshot: InspirationSnapshot) {
  const title = snapshot.title.trim();
  if (title) return title.slice(0, 120);
  if (snapshot.primaryKind === "text") return snapshot.text?.content.slice(0, 120) ?? null;
  if (snapshot.primaryKind === "audio") return snapshot.audio?.note || snapshot.audio?.items[0]?.label || null;
  return snapshot.image?.note || "图片灵感";
}
