"use client";

/**
 * 归档到项目弹窗（docs/implementation-todo.md §5.6）。
 * 把未归档灵感（projectId=null）挂到「新建项目」或「已有项目」。
 * 调 POST /api/inspirations/{recordId}/attach，成功后 onSuccess(projectId)。
 */
import { useCallback, useEffect, useState } from "react";
import { FolderInput, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InspirationRecord } from "@/modules/inspirations/inspiration-types";
import type { ProjectSummary } from "@/modules/projects/project-types";

type Mode = "new_project" | "existing_project";
type Envelope<T> = { ok: boolean; data?: T; error?: { message?: string } };

const STATUS_LABEL: Record<ProjectSummary["status"], string> = {
  draft: "灵感草稿",
  analyzing: "分析中",
  review: "待确认",
  ready: "已生成 Demo",
  collaborating: "协作中",
  archived: "已归档",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ArchiveToProjectDialog({
  recordId,
  onClose,
  onSuccess,
}: {
  recordId: string;
  onClose: () => void;
  onSuccess: (projectId: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("new_project");
  const [title, setTitle] = useState("");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadProjects = useCallback(() => {
    setProjectsLoading(true);
    fetch("/api/projects?page=1&pageSize=48")
      .then(async (r) => {
        const body = (await r.json()) as Envelope<{ items: ProjectSummary[] }>;
        if (!r.ok || !body.data) throw new Error(body.error?.message || "项目列表加载失败");
        return body.data.items;
      })
      .then((items) => {
        setProjects(items);
        if (items.length > 0) setSelectedId(items[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "项目列表加载失败"))
      .finally(() => setProjectsLoading(false));
  }, []);

  // 数据获取的 loading 态在 effect 内同步设置是合规用法（非派生 state）。
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadProjects(); }, [loadProjects]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    setError("");
    const body =
      mode === "new_project"
        ? { destination: "new_project" as const, title: title.trim() }
        : { destination: "existing_project" as const, projectId: selectedId };

    if (mode === "new_project" && !body.title) {
      setError("请输入项目名称");
      return;
    }
    if (mode === "existing_project" && !selectedId) {
      setError("请选择一个项目");
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch(`/api/inspirations/${recordId}/attach`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const res = (await r.json()) as Envelope<InspirationRecord>;
      if (!r.ok || !res.data) throw new Error(res.error?.message || "归档失败");
      // attach 成功后 projectId 必然存在；防御性校验兜底异常数据。
      const projectId = res.data.projectId;
      if (!projectId) throw new Error("归档失败：未返回项目");
      onSuccess(projectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "归档失败");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    mode === "new_project" ? title.trim().length > 0 : Boolean(selectedId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="归档到项目">
      <div className="absolute inset-0 bg-foreground/25 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <div className="relative flex w-full max-w-md flex-col rounded-xl border border-border bg-background shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <FolderInput className="size-4 text-brand" />
            <h2 className="text-sm font-semibold text-foreground">归档到项目</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          {/* segmented control */}
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
            {(["new_project", "existing_project"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={
                  "rounded-[6px] px-3 py-1 font-medium transition-colors " +
                  (mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")
                }
              >
                {m === "new_project" ? "新建项目" : "已有项目"}
              </button>
            ))}
          </div>

          {mode === "new_project" ? (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">项目名称</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                autoFocus
                placeholder="为这条灵感起个项目名"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-brand/50 focus:ring-2 focus:ring-brand/20"
              />
            </label>
          ) : projectsLoading ? (
            <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />加载项目列表…
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
              还没有项目，切换到「新建项目」创建一个。
            </div>
          ) : (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">选择项目</span>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/20"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} · {STATUS_LABEL[p.status]} · {formatDate(p.updatedAt)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>取消</Button>
          <Button onClick={submit} disabled={!canSubmit || submitting}>
            {submitting ? (<><Loader2 className="size-3.5 animate-spin" />归档中…</>) : "确认归档"}
          </Button>
        </footer>
      </div>
    </div>
  );
}
