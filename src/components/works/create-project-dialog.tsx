"use client";

/**
 * 歌曲库内新建歌曲弹窗。
 * 独立于制作台 `/create` 引导：只填名称 → POST /api/projects → 进入歌曲详情。
 */
import { useEffect, useState } from "react";
import { FolderPlus, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type CreateEnvelope = { ok: boolean; data?: { id: string }; error?: { message?: string } };

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20";

export function CreateProjectDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // 弹窗每次打开时重置表单：用渲染期调整 state（prevOpen 比对），避免 effect 内 setState。
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setTitle("");
      setError("");
      setCreating(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleCreate() {
    const trimmed = title.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      const body = (await response.json()) as CreateEnvelope;
      if (!response.ok || !body.ok || !body.data?.id) {
        throw new Error(body.error?.message || "创建歌曲失败");
      }
      onCreated(body.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建歌曲失败");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="works-create-project-title">
      <div className="absolute inset-0 bg-foreground/25 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-[0_8px_24px_rgba(16,24,40,0.12)]">
        <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <FolderPlus className="size-4 text-brand" />
            <h2 id="works-create-project-title" className="text-sm font-semibold text-foreground">
              新建歌曲
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="space-y-3 px-5 py-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">歌曲名称</span>
            <input
              className={inputClass}
              value={title}
              autoFocus
              maxLength={80}
              placeholder="为这首歌曲起个名字"
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleCreate();
              }}
            />
          </label>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={creating}>
              取消
            </Button>
            <Button type="button" disabled={!title.trim() || creating} onClick={() => void handleCreate()}>
              {creating ? <Loader2 className="size-4 animate-spin" /> : null}
              {creating ? "创建中…" : "创建"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
