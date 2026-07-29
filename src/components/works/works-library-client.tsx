"use client";

/**
 * 创作库客户端（/works）。
 * 管理 URL ↔ 筛选状态双向同步、服务端分页请求；桌面表格 / H5 卡片；行点击进入项目详情。
 * 照搬灵感库（inspiration-library-client）的结构。
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, FolderClosed, Plus, RotateCcw, Search, X } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StatusBadge, projectStatusVariant } from "@/components/library/status-badge";
import type { ProjectStatus } from "@/modules/projects/project-types";
import { CreateProjectDialog } from "./create-project-dialog";
import {
  DEFAULT_FILTERS,
  parseWorksFilters,
  toWorksQuery,
  type WorksFilters,
  type WorksItem,
  type WorksListPage,
} from "./works-filters";

type Envelope = { ok: boolean; data?: WorksListPage; error?: { message?: string } };

const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "草稿",
  analyzing: "分析中",
  review: "待确认",
  ready: "已完成",
  collaborating: "协作中",
  archived: "已归档",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function WorksLibraryClient({
  initialParams,
}: {
  initialParams: Record<string, string | string[] | undefined>;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<WorksFilters>(() => parseWorksFilters(initialParams));
  const [data, setData] = useState<WorksListPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const applyFilters = useCallback(
    (next: WorksFilters) => {
      setFilters(next);
      router.replace(`/works?${toWorksQuery(next)}`, { scroll: false });
    },
    [router],
  );

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch(`/api/works?${toWorksQuery(filters)}`)
      .then(async (r) => {
        const body = (await r.json()) as Envelope;
        if (!r.ok || !body.data) throw new Error(body.error?.message || "加载失败");
        return body.data;
      })
      .then((d) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [filters]);

  // 数据获取的 loading 态在 effect 内同步设置是合规用法（非派生 state）。
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const total = data?.total ?? 0;
  const hasFilters = filters.query.trim() !== "";
  // 真空状态：无任何项目且没有筛选条件时，隐藏搜索栏，展示引导。
  const isEmptyStore = !loading && !error && data !== null && data.items.length === 0 && !hasFilters;

  const createDialog = (
    <CreateProjectDialog
      open={createOpen}
      onClose={() => setCreateOpen(false)}
      onCreated={(projectId) => {
        setCreateOpen(false);
        router.push(`/works/${projectId}`);
      }}
    />
  );

  if (isEmptyStore) {
    return (
      <>
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-center px-5 py-24 text-center lg:px-8">
          <div className="flex size-10 items-center justify-center rounded-full bg-muted">
            <FolderClosed className="size-5 text-muted-foreground" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">还没有项目</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            在灵感记录页保存到项目后，项目会自动出现在这里
          </p>
          <div className="mt-4 flex gap-2">
            <Link href="/">
              <Button variant="outline">记录灵感</Button>
            </Link>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              新建项目
            </Button>
          </div>
        </div>
        {createDialog}
      </>
    );
  }

  return (
    <>
    <div className="mx-auto w-full max-w-6xl px-5 py-6 lg:px-8 lg:py-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand">
            <FolderClosed className="size-4" />
            <span className="text-sm font-medium">创作库</span>
          </div>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">
            创作库 · 共 {total} 个项目
          </h1>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          新建项目
        </Button>
      </header>

      <div className="mt-5">
        <WorksSearchForm value={filters} onApply={applyFilters} />
      </div>

      {/* 当前条件 Chips */}
      <ActiveChips filters={filters} onClear={(patch) => applyFilters({ ...filters, ...patch, page: 1 })} />

      {/* 结果 */}
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-4">
        {loading && !data ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : data && data.items.length > 0 ? (
          <>
            {/* 桌面表格 */}
            <div className="hidden overflow-hidden rounded-lg border border-border bg-card lg:block">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">项目</th>
                    <th className="px-3 py-2.5 font-medium">状态</th>
                    <th className="px-3 py-2.5 text-right font-medium">灵感数</th>
                    <th className="px-3 py-2.5 text-right font-medium">歌曲数</th>
                    <th className="px-3 py-2.5 text-right font-medium">更新时间</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <DesktopRow key={item.id} item={item} onOpen={() => router.push(`/works/${item.id}`)} />
                  ))}
                </tbody>
              </table>
            </div>
            {/* H5 卡片/行 */}
            <div className="grid gap-2 lg:hidden">
              {data.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => router.push(`/works/${item.id}`)}
                  className="rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/40"
                >
                  <MobileCardInner item={item} />
                </button>
              ))}
            </div>
            <Pagination
              data={data}
              onPage={(page) => applyFilters({ ...filters, page })}
            />
          </>
        ) : (
          <NoMatchState onClear={() => applyFilters({ ...DEFAULT_FILTERS, pageSize: filters.pageSize })} />
        )}
      </div>
    </div>
    {createDialog}
    </>
  );
}

function CoverTile({ title, coverUrl }: { title: string; coverUrl: string | null }) {
  if (coverUrl) {
    // 封面优先；外部 URL 直接用 img（项目内素材未托管时不走 next/image 域白名单）。
    return (
      <span className="relative size-8 shrink-0 overflow-hidden rounded-md bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverUrl} alt="" className="size-full object-cover" />
      </span>
    );
  }
  const first = title.trim().charAt(0) || "项";
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-muted text-xs font-medium text-foreground">
      {first}
    </span>
  );
}

function DesktopRow({ item, onOpen }: { item: WorksItem; onOpen: () => void }) {
  return (
    <tr
      className="cursor-pointer border-b border-border last:border-b-0 px-4 py-3 transition-colors hover:bg-muted/30"
      onClick={onOpen}
    >
      <td className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <CoverTile title={item.title} coverUrl={item.coverUrl} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{item.title}</span>
            {item.description && (
              <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
            )}
          </span>
        </div>
      </td>
      <td className="px-3 py-3">
        <StatusBadge variant={projectStatusVariant(item.status)}>{STATUS_LABEL[item.status]}</StatusBadge>
      </td>
      <td className="px-3 py-3 text-right text-xs tabular-nums text-muted-foreground">{item.inspirationCount}</td>
      <td className="px-3 py-3 text-right text-xs tabular-nums text-muted-foreground">{item.versionCount}</td>
      <td className="px-3 py-3 text-right text-xs text-muted-foreground">{formatDate(item.updatedAt)}</td>
    </tr>
  );
}

function MobileCardInner({ item }: { item: WorksItem }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <CoverTile title={item.title} coverUrl={item.coverUrl} />
        <span className="min-w-0 truncate text-sm font-medium text-foreground">{item.title}</span>
        <span className="ml-auto">
          <StatusBadge variant={projectStatusVariant(item.status)}>{STATUS_LABEL[item.status]}</StatusBadge>
        </span>
      </div>
      {item.description && (
        <p className="mt-1.5 line-clamp-1 pl-10 text-xs text-muted-foreground">{item.description}</p>
      )}
      <div className="mt-1.5 flex items-center justify-between pl-10 text-[11px] text-muted-foreground">
        <span>灵感 {item.inspirationCount} · 歌曲 {item.versionCount}</span>
        <span>{formatDate(item.updatedAt)}</span>
      </div>
    </div>
  );
}

/**
 * 创作库查询表单：关键词 + 排序。受控草稿，点「查询」提交。
 */
function WorksSearchForm({
  value,
  onApply,
}: {
  value: WorksFilters;
  onApply: (next: WorksFilters) => void;
}) {
  const [draft, setDraft] = useState<WorksFilters>(value);

  function apply() {
    onApply({ ...draft, page: 1 });
  }
  function reset() {
    const cleared: WorksFilters = { query: "", sort: "updated", page: 1, pageSize: value.pageSize };
    setDraft(cleared);
    onApply(cleared);
  }

  const inputClass =
    "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20";

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">关键词</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={cn(inputClass, "pl-8")}
              value={draft.query}
              onChange={(e) => setDraft((d) => ({ ...d, query: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") apply();
              }}
              placeholder="搜索项目标题或描述"
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">排序</span>
          <select
            className={inputClass}
            value={draft.sort}
            onChange={(e) => setDraft((d) => ({ ...d, sort: e.target.value as WorksFilters["sort"] }))}
          >
            <option value="updated">最近更新</option>
            <option value="created">最新创建</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <Button type="button" onClick={apply}>
            查询
          </Button>
          <Button type="button" variant="outline" onClick={reset}>
            <RotateCcw className="size-3.5" />
            重置
          </Button>
        </div>
      </div>
    </div>
  );
}

function ActiveChips({
  filters,
  onClear,
}: {
  filters: WorksFilters;
  onClear: (patch: Partial<WorksFilters>) => void;
}) {
  const chips: { label: string; clear: () => void }[] = [];
  if (filters.query) chips.push({ label: `关键词：${filters.query}`, clear: () => onClear({ query: "" }) });
  if (filters.sort !== "updated")
    chips.push({
      label: filters.sort === "created" ? "排序：最新创建" : "排序：最近更新",
      clear: () => onClear({ sort: "updated" }),
    });
  if (chips.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {chips.map((c, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
        >
          {c.label}
          <button
            type="button"
            onClick={c.clear}
            aria-label="移除条件"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

function Pagination({
  data,
  onPage,
}: {
  data: WorksListPage;
  onPage: (page: number) => void;
}) {
  if (data.totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
      <span>
        第 {data.page} / {data.totalPages} 页 · 共 {data.total} 个项目
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>
          <ChevronLeft className="size-3.5" />
          上一页
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={data.page >= data.totalPages}
          onClick={() => onPage(data.page + 1)}
        >
          下一页
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function NoMatchState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        <FolderClosed className="size-5 text-muted-foreground" />
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">没有匹配的项目</p>
      <p className="mt-1 text-xs text-muted-foreground">试试清除部分筛选条件</p>
      <div className="mt-4">
        <Button variant="outline" onClick={onClear}>
          清除筛选
        </Button>
      </div>
    </div>
  );
}
