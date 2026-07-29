/**
 * 创作库前端筛选模型：URL ↔ state 双向同步。
 * 与灵感库一致，搜索框 query + 排序 sort，分页上限 48。
 */
import type {
  ProjectListItem,
  ProjectListPage,
} from "@/modules/projects/project-types";

export type WorksSort = "updated" | "created";

/** 创作库列表项 = 带灵感数/歌曲数/封面的项目摘要。 */
export type WorksItem = ProjectListItem;
/** 创作库分页结果（items 为 ProjectListItem）。 */
export type WorksListPage = ProjectListPage<ProjectListItem>;

export type WorksFilters = {
  query: string;
  sort: WorksSort;
  page: number;
  pageSize: number;
};

export const DEFAULT_FILTERS: WorksFilters = {
  query: "",
  sort: "updated",
  page: 1,
  pageSize: 20,
};

export function parseWorksFilters(
  params: Record<string, string | string[] | undefined>,
): WorksFilters {
  const one = (k: string) =>
    typeof params[k] === "string" ? (params[k] as string) : undefined;
  const sort = one("sort");
  return {
    query: one("query") ?? "",
    sort: sort === "created" ? "created" : "updated",
    page: Math.max(1, Number(one("page") ?? "1") || 1),
    pageSize: Math.max(1, Math.min(48, Number(one("pageSize") ?? "20") || 20)),
  };
}

export function toWorksQuery(f: WorksFilters): string {
  const p = new URLSearchParams();
  if (f.query.trim()) p.set("query", f.query.trim());
  if (f.sort !== "updated") p.set("sort", f.sort);
  if (f.page !== 1) p.set("page", String(f.page));
  p.set("pageSize", String(f.pageSize));
  return p.toString();
}
