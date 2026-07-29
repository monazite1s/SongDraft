"use client";

/**
 * 灵感库客户端（docs/implementation-todo.md §5）。
 * 管理 URL ↔ 筛选状态双向同步、服务端分页请求；桌面表格 / H5 卡片；行点击打开详情 Sheet。
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AudioLines, ChevronLeft, ChevronRight, FileText, ImageIcon, Lightbulb, Plus, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { InspirationSearchForm } from "./inspiration-search-form";
import { InspirationDetailSheet } from "./inspiration-detail-sheet";
import {
  DEFAULT_FILTERS,
  parseFilters,
  toQuery,
  type LibFilters,
  type LibItem,
  type LibListPage,
  type LibPrimaryKind,
} from "./library-filters";

const KIND_ICON: Record<LibPrimaryKind, typeof AudioLines> = { audio: AudioLines, image: ImageIcon, text: FileText };
const KIND_LABEL: Record<LibPrimaryKind, string> = { audio: "音频", image: "图片", text: "文本" };

type Envelope = { ok: boolean; data?: LibListPage; error?: { message?: string } };

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function InspirationLibraryClient({ initialParams }: { initialParams: Record<string, string | string[] | undefined> }) {
  const router = useRouter();
  const [filters, setFilters] = useState<LibFilters>(() => parseFilters(initialParams));
  const [data, setData] = useState<LibListPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const applyFilters = useCallback((next: LibFilters) => {
    setFilters(next);
    router.replace(`/inspirations?${toQuery(next)}`, { scroll: false });
  }, [router]);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch(`/api/inspirations?${toQuery(filters)}`)
      .then(async (r) => {
        const body = await r.json() as Envelope;
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

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-6 lg:px-8 lg:py-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand"><Lightbulb className="size-4" /><span className="text-sm font-medium">灵感库</span></div>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">灵感记录 · 共 {total} 条</h1>
        </div>
        <Link href="/">
          <Button><Plus className="size-4" />记录新灵感</Button>
        </Link>
      </header>

      <div className="mt-5"><InspirationSearchForm value={filters} onApply={applyFilters} /></div>

      {/* 当前条件 Chips */}
      <ActiveChips filters={filters} onClear={(patch) => applyFilters({ ...filters, ...patch, page: 1 })} />

      {/* 结果 */}
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      <div className="mt-4">
        {loading && !data ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />)}
          </div>
        ) : data && data.items.length > 0 ? (
          <>
            {/* 桌面表格 */}
            <div className="hidden overflow-hidden rounded-xl border border-border bg-card lg:block">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">灵感</th>
                    <th className="px-3 py-2.5 font-medium">类型</th>
                    <th className="px-3 py-2.5 font-medium">所属项目</th>
                    <th className="px-3 py-2.5 font-medium">版本</th>
                    <th className="px-3 py-2.5 font-medium">更新时间</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => <Row key={item.id} item={item} onOpen={() => setSelectedId(item.id)} onProject={(id) => router.push(`/create/${id}`)} />)}
                </tbody>
              </table>
            </div>
            {/* H5 卡片 */}
            <div className="grid gap-2 lg:hidden">
              {data.items.map((item) => (
                <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className="rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted/40">
                  <CardInner item={item} />
                </button>
              ))}
            </div>
            <Pagination filters={filters} data={data} onPage={(page) => applyFilters({ ...filters, page })} />
          </>
        ) : (
          <EmptyState hasFilters={filters.query !== "" || filters.kinds.length > 0 || filters.attached !== "all" || filters.tags.length > 0} onClear={() => applyFilters({ ...DEFAULT_FILTERS, pageSize: filters.pageSize })} />
        )}
      </div>

      {selectedId && <InspirationDetailSheet recordId={selectedId} onClose={() => setSelectedId(null)} onProject={(id) => router.push(`/create/${id}`)} />}
    </div>
  );
}

function Row({ item, onOpen, onProject }: { item: LibItem; onOpen: () => void; onProject: (id: string) => void }) {
  const Icon = KIND_ICON[item.primaryKind];
  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-muted/30">
      <td className="px-4 py-3">
        <button type="button" onClick={onOpen} className="flex min-w-0 items-center gap-2.5 text-left">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{item.title || item.summary || "未命名灵感"}</span>
            {item.summary && item.title && <span className="block truncate text-xs text-muted-foreground">{item.summary}</span>}
          </span>
        </button>
      </td>
      <td className="px-3 py-3"><span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground">{KIND_LABEL[item.primaryKind]}</span></td>
      <td className="px-3 py-3 text-xs">
        {item.projectId ? (
          <button type="button" onClick={() => onProject(item.projectId!)} className="truncate text-brand hover:underline">{item.projectName || "已归档项目"}</button>
        ) : (
          <span className="text-muted-foreground">未归档</span>
        )}
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">v{item.versionCount}</td>
      <td className="px-3 py-3 text-xs text-muted-foreground">{formatDate(item.updatedAt)}</td>
    </tr>
  );
}

function CardInner({ item }: { item: LibItem }) {
  const Icon = KIND_ICON[item.primaryKind];
  return (
    <div>
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <span className="truncate text-sm font-medium text-foreground">{item.title || item.summary || "未命名灵感"}</span>
        <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground">{KIND_LABEL[item.primaryKind]}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="truncate">{item.projectId ? (item.projectName || "已归档项目") : "未归档"}</span>
        <span>v{item.versionCount} · {formatDate(item.updatedAt)}</span>
      </div>
    </div>
  );
}

function ActiveChips({ filters, onClear }: { filters: LibFilters; onClear: (patch: Partial<LibFilters>) => void }) {
  const chips: { label: string; clear: () => void }[] = [];
  if (filters.query) chips.push({ label: `关键词：${filters.query}`, clear: () => onClear({ query: "" }) });
  filters.kinds.forEach((k) => chips.push({ label: KIND_LABEL[k], clear: () => onClear({ kinds: filters.kinds.filter((x) => x !== k) }) }));
  if (filters.attached !== "all") chips.push({ label: filters.attached === "attached" ? "已归档" : "未归档", clear: () => onClear({ attached: "all" }) });
  if (chips.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {chips.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
          {c.label}
          <button type="button" onClick={c.clear} aria-label="移除条件" className="text-muted-foreground hover:text-foreground"><X className="size-3" /></button>
        </span>
      ))}
    </div>
  );
}

function Pagination({ filters, data, onPage }: { filters: LibFilters; data: LibListPage; onPage: (page: number) => void }) {
  if (data.totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
      <span>第 {data.page} / {data.totalPages} 页 · 共 {data.total} 条</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}><ChevronLeft className="size-3.5" />上一页</Button>
        <Button variant="outline" size="sm" disabled={data.page >= data.totalPages} onClick={() => onPage(data.page + 1)}>下一页<ChevronRight className="size-3.5" /></Button>
      </div>
    </div>
  );
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted"><Lightbulb className="size-5 text-muted-foreground" /></div>
      <p className="mt-3 text-sm font-medium text-foreground">{hasFilters ? "没有匹配结果" : "还没有灵感记录"}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hasFilters ? "试试清除部分筛选条件" : "把脑海里的旋律、画面或歌词先留下来"}</p>
      <div className="mt-4">
        {hasFilters ? (
          <Button variant="outline" onClick={onClear}>清除筛选</Button>
        ) : (
          <Link href="/"><Button><Plus className="size-4" />记录第一条</Button></Link>
        )}
      </div>
    </div>
  );
}
