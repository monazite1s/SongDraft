"use client";

/**
 * 灵感详情 Sheet（docs/implementation-todo.md §5.4，按 UI-design 重做）。
 * 桌面右侧 480px 滑出 / H5 全屏；按类型统一预览 + 版本时间线 + 恢复历史快照。
 */
import { useCallback, useEffect, useState } from "react";
import { AudioLines, FileText, ImageIcon, RotateCcw, X, FolderInput } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { InspirationDetail } from "@/modules/inspirations/inspiration-types";
import type { InspirationSnapshot } from "@/modules/inspirations/inspiration-schema";

type Envelope<T> = { ok: boolean; data?: T; error?: { message?: string } };

const KIND_LABEL = { audio: "录音/音频", image: "图片", text: "文本" } as const;
const REASON_LABEL: Record<string, string> = { manual: "手动保存", autosave: "自动保存", restore: "恢复", attach: "归档" };

function snapshotSummary(s: InspirationSnapshot): string {
  if (s.title.trim()) return s.title;
  if (s.primaryKind === "text") return (s.text?.content ?? "").slice(0, 60);
  if (s.primaryKind === "audio") return s.audio?.note || s.audio?.items[0]?.label || "音频灵感";
  return s.image?.note || "图片灵感";
}

export function InspirationDetailSheet({ recordId, onClose, onProject }: { recordId: string; onClose: () => void; onProject: (projectId: string) => void }) {
  const [detail, setDetail] = useState<InspirationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError("");
    fetch(`/api/inspirations/${recordId}`).then(async (r) => {
      const body = await r.json() as Envelope<InspirationDetail>;
      if (!r.ok || !body.data) throw new Error(body.error?.message || "加载失败");
      setDetail(body.data);
    }).catch((e) => setError(e instanceof Error ? e.message : "加载失败")).finally(() => setLoading(false));
  }, [recordId]);

  // 数据获取的 loading 态在 effect 内同步设置是合规用法（非派生 state）。
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function restore(versionId: string) {
    setRestoringId(versionId); setError("");
    try {
      const r = await fetch(`/api/inspirations/${recordId}/versions/${versionId}/restore`, { method: "POST" });
      const body = await r.json() as Envelope<unknown>;
      if (!r.ok) throw new Error(body.error?.message || "恢复失败");
      setConfirmId(null);
      load();
    } catch (e) { setError(e instanceof Error ? e.message : "恢复失败"); }
    finally { setRestoringId(null); }
  }

  const record = detail?.record;
  const snapshot = record?.currentSnapshot;
  const Icon = snapshot ? (snapshot.primaryKind === "audio" ? AudioLines : snapshot.primaryKind === "image" ? ImageIcon : FileText) : FileText;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-foreground/25 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <aside className="relative flex h-full w-full max-w-[480px] flex-col border-l border-border bg-background shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-brand"><Icon className="size-4" /><span className="text-xs font-medium">{snapshot ? KIND_LABEL[snapshot.primaryKind] : "灵感"}</span></div>
            <h2 className="mt-1 truncate text-base font-semibold text-foreground">{record?.title || record?.summary || "未命名灵感"}</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{record ? `v${record.versionCount} · 更新于 ${new Date(record.updatedAt).toLocaleString("zh-CN")}` : ""}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-4" /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
          {loading && !detail ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-4 animate-pulse rounded bg-muted" />)}</div>
          ) : detail && snapshot ? (
            <div className="space-y-5">
              <SnapshotPreview snapshot={snapshot} />
              {record?.projectId && (
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">所属项目</span>
                  <button type="button" onClick={() => onProject(record.projectId!)} className="flex items-center gap-1 text-brand hover:underline"><FolderInput className="size-3.5" />打开制作台</button>
                </div>
              )}
              <VersionTimeline detail={detail} restoringId={restoringId} confirmId={confirmId} onAskRestore={(id) => setConfirmId(id)} onConfirmRestore={restore} onCancelConfirm={() => setConfirmId(null)} />
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function SnapshotPreview({ snapshot }: { snapshot: InspirationSnapshot }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">内容</h3>
      {snapshot.primaryKind === "text" && snapshot.text && (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">类型 · {snapshot.text.inspirationType}</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{snapshot.text.content}</p>
          {snapshot.text.moods.length > 0 && <Tags label="情绪" values={snapshot.text.moods} />}
        </div>
      )}
      {snapshot.primaryKind === "audio" && snapshot.audio && (
        <div className="space-y-2">
          {snapshot.audio.note && <p className="text-sm text-foreground">{snapshot.audio.note}</p>}
          <ul className="space-y-1.5">
            {snapshot.audio.items.map((item) => (
              <li key={item.assetId} className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs">
                <AudioLines className="size-3.5 text-brand" />
                <span className="truncate text-foreground">{item.label}</span>
                {item.role && <span className="ml-auto text-muted-foreground">{item.role}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {snapshot.primaryKind === "image" && snapshot.image && (
        <div className="space-y-2">
          {snapshot.image.note && <p className="text-sm text-foreground">{snapshot.image.note}</p>}
          <p className="text-[11px] text-muted-foreground">{snapshot.image.assetIds.length} 张图片</p>
          {snapshot.image.moods.length > 0 && <Tags label="氛围" values={snapshot.image.moods} />}
        </div>
      )}
      {snapshot.tags.length > 0 && <Tags label="标签" values={snapshot.tags} />}
    </section>
  );
}

function Tags({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {values.map((v) => <span key={v} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground">{v}</span>)}
    </div>
  );
}

function VersionTimeline({ detail, restoringId, confirmId, onAskRestore, onConfirmRestore, onCancelConfirm }: {
  detail: InspirationDetail;
  restoringId: string | null;
  confirmId: string | null;
  onAskRestore: (id: string) => void;
  onConfirmRestore: (id: string) => void;
  onCancelConfirm: () => void;
}) {
  if (detail.versions.length === 0) return null;
  const currentHash = detail.record.currentContentHash;
  return (
    <section>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">版本记录 · {detail.versions.length}</h3>
      <ol className="space-y-2">
        {detail.versions.map((v) => {
          const isCurrent = v.contentHash === currentHash;
          const confirming = confirmId === v.id;
          return (
            <li key={v.id} className={cn("rounded-lg border p-2.5", isCurrent ? "border-brand/40 bg-brand-muted/30" : "border-border bg-card")}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">v{v.versionNo}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{REASON_LABEL[v.reason] ?? v.reason}</span>
                {isCurrent && <span className="rounded bg-brand px-1.5 py-0.5 text-[10px] font-medium text-brand-foreground">当前</span>}
                <span className="ml-auto text-[10px] text-muted-foreground">{new Date(v.createdAt).toLocaleString("zh-CN")}</span>
              </div>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">{snapshotSummary(v.snapshot)}</p>
              {!isCurrent && (
                <div className="mt-2">
                  {confirming ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">恢复会覆盖当前内容，确认？</span>
                      <Button size="xs" onClick={() => onConfirmRestore(v.id)} disabled={restoringId !== null}>{restoringId === v.id ? "恢复中…" : "确认恢复"}</Button>
                      <Button size="xs" variant="ghost" onClick={onCancelConfirm} disabled={restoringId !== null}>取消</Button>
                    </div>
                  ) : (
                    <Button size="xs" variant="outline" onClick={() => onAskRestore(v.id)}><RotateCcw className="size-3" />恢复此版本</Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
