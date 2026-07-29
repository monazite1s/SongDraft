/**
 * 灵感库前端筛选模型：URL ↔ state 双向同步，分页上限 50。
 */
import type {
  InspirationDetail,
  InspirationListItem,
  InspirationListPage,
} from "@/modules/inspirations/inspiration-types";

export type LibPrimaryKind = "audio" | "image" | "text";

export type LibFilters = {
  query: string;
  kinds: LibPrimaryKind[];
  attached: "all" | "unattached" | "attached";
  tags: string[];
  moods: string[];
  createdFrom: string;
  createdTo: string;
  sort: "updated" | "created";
  page: number;
  pageSize: number;
};

export const DEFAULT_FILTERS: LibFilters = {
  query: "",
  kinds: [],
  attached: "all",
  tags: [],
  moods: [],
  createdFrom: "",
  createdTo: "",
  sort: "updated",
  page: 1,
  pageSize: 20,
};

const KINDS: LibPrimaryKind[] = ["audio", "image", "text"];

export function parseFilters(params: Record<string, string | string[] | undefined>): LibFilters {
  const one = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : undefined);
  const csv = (k: string): string[] => {
    const v = params[k];
    if (Array.isArray(v)) return v.filter(Boolean);
    if (typeof v === "string" && v.trim()) return v.split(",").filter(Boolean);
    return [];
  };
  const attached = one("attached");
  const sort = one("sort");
  return {
    query: one("query") ?? "",
    kinds: csv("kinds").filter((k): k is LibPrimaryKind => (KINDS as string[]).includes(k)),
    attached: attached === "unattached" || attached === "attached" ? attached : "all",
    tags: csv("tags"),
    moods: csv("moods"),
    createdFrom: one("createdFrom") ?? "",
    createdTo: one("createdTo") ?? "",
    sort: sort === "created" ? "created" : "updated",
    page: Math.max(1, Number(one("page") ?? "1") || 1),
    pageSize: Math.max(1, Math.min(50, Number(one("pageSize") ?? "20") || 20)),
  };
}

export function toQuery(f: LibFilters): string {
  const p = new URLSearchParams();
  if (f.query.trim()) p.set("query", f.query.trim());
  if (f.kinds.length) p.set("kinds", f.kinds.join(","));
  if (f.attached !== "all") p.set("attached", f.attached);
  if (f.tags.length) p.set("tags", f.tags.join(","));
  if (f.moods.length) p.set("moods", f.moods.join(","));
  if (f.createdFrom) p.set("createdFrom", f.createdFrom);
  if (f.createdTo) p.set("createdTo", f.createdTo);
  if (f.sort !== "updated") p.set("sort", f.sort);
  if (f.page !== 1) p.set("page", String(f.page));
  p.set("pageSize", String(f.pageSize));
  return p.toString();
}

export type { InspirationListItem as LibItem, InspirationListPage as LibListPage, InspirationDetail as LibDetail };
