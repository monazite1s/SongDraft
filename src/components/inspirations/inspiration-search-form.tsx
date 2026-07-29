"use client";

/**
 * 灵感库查询表单（docs/implementation-todo.md §5.2）。
 * 受控表单：编辑本地草稿，点「查询」才提交；Reset 恢复默认并清空 URL 条件。
 */
import { useState } from "react";
import { Search, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { LibFilters } from "./library-filters";

const KIND_OPTIONS: { id: LibFilters["kinds"][number]; label: string }[] = [
  { id: "audio", label: "录音/音频" },
  { id: "image", label: "图片" },
  { id: "text", label: "文本" },
];

const ATTACHED_OPTIONS: { id: LibFilters["attached"]; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "unattached", label: "未归档" },
  { id: "attached", label: "已归档" },
];

const inputClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20";

export function InspirationSearchForm({
  value,
  onApply,
}: {
  value: LibFilters;
  onApply: (next: LibFilters) => void;
}) {
  const [draft, setDraft] = useState<LibFilters>(value);

  function apply() {
    onApply({ ...draft, page: 1 });
  }
  function reset() {
    const cleared: LibFilters = { query: "", kinds: [], attached: "all", tags: [], sort: "updated", page: 1, pageSize: value.pageSize };
    setDraft(cleared);
    onApply(cleared);
  }
  function toggleKind(id: LibFilters["kinds"][number]) {
    setDraft((d) => ({ ...d, kinds: d.kinds.includes(id) ? d.kinds.filter((k) => k !== id) : [...d.kinds, id] }));
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">关键词</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={cn(inputClass, "pl-8")}
              value={draft.query}
              onChange={(e) => setDraft((d) => ({ ...d, query: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") apply(); }}
              placeholder="搜索标题或摘要"
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">关联状态</span>
          <select
            className={inputClass}
            value={draft.attached}
            onChange={(e) => setDraft((d) => ({ ...d, attached: e.target.value as LibFilters["attached"] }))}
          >
            {ATTACHED_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">排序</span>
          <select
            className={inputClass}
            value={draft.sort}
            onChange={(e) => setDraft((d) => ({ ...d, sort: e.target.value as LibFilters["sort"] }))}
          >
            <option value="updated">最近更新</option>
            <option value="created">最新创建</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <Button type="button" onClick={apply}>查询</Button>
          <Button type="button" variant="outline" onClick={reset}>
            <RotateCcw className="size-3.5" />
            重置
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">素材类型</span>
        {KIND_OPTIONS.map((o) => {
          const active = draft.kinds.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => toggleKind(o.id)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                active ? "border-brand bg-brand-muted text-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
