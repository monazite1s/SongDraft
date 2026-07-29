"use client";

/**
 * 公开分享页客户端：收听 Demo + 基于音频时间点发表评论。
 * 被分享用户仅有「收听 + 评论」权限，不显示分享/编辑/历史切换等管理操作（docs/SPEC.md §7 分享页）。
 * 评论必须绑定具体播放时间点后才能发送（SPEC §7 评论绑定音频时间点）。
 */
import { LoaderCircle, MessageSquare, Music2, Send, Tag } from "lucide-react";
import { useMemo, useState } from "react";

import type { PublicComment, PublicShare } from "@/modules/sharing/share-service";
import { AudioPlayer } from "@/components/inspire/audio-player";
import { ModeTag } from "@/components/inspire/ui";
import { cn } from "@/lib/utils";

type Tab = "lyrics" | "comments";

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** 把评论时间点格式化为 mm:ss；atMs 缺失时回退到 createdAt 的相对描述。 */
function commentTimeLabel(comment: PublicComment): string {
  if (comment.atMs !== null && Number.isFinite(comment.atMs)) {
    return fmtTime(comment.atMs / 1000);
  }
  // 无时间点的评论按 createdAt 兜底，仅展示日期（不带时间，避免冗余）。
  const date = new Date(comment.createdAt);
  return Number.isFinite(date.getTime()) ? `${date.getMonth() + 1}/${date.getDate()}` : "—";
}

export function PublicShareClient({ token, share }: { token: string; share: PublicShare }) {
  const [comments, setComments] = useState<PublicComment[]>(share.comments);
  const [tab, setTab] = useState<Tab>("lyrics");
  const [content, setContent] = useState("");
  const [guestName, setGuestName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  // 播放器当前播放时间（秒），由 AudioPlayer 同步；评论绑定该时间点。
  const [currentTime, setCurrentTime] = useState(0);
  // 已选定的评论时间点（ms）；发送评论前必须先「添加时间点」。
  const [selectedAtMs, setSelectedAtMs] = useState<number | null>(null);

  // executionKind 映射到 ModeTag 的 real/simulated。
  const runMode = share.executionKind === "simulated" ? "simulated" : "real";

  // 评论时间轴：按 atMs 升序；无 atMs 的按 createdAt 兜底排在末尾（SPEC §7 按时间轴展示）。
  const timeline = useMemo(() => {
    return [...comments].sort((a, b) => {
      const at = a.atMs ?? Number.MAX_SAFE_INTEGER;
      const bt = b.atMs ?? Number.MAX_SAFE_INTEGER;
      if (at !== bt) return at - bt;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }, [comments]);

  // 评论标记点（在播放器波形上标位置）。
  const markers = useMemo(
    () =>
      timeline
        .filter((c) => c.atMs !== null)
        .map((c) => ({ at: (c.atMs as number) / 1000 })),
    [timeline],
  );

  // Demo 时长标签：mock 无真实时长时给一个稳定占位，保证播放器可用。
  const durationLabel = share.hasAudio ? "3:20" : "0:00";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (selectedAtMs === null) {
      setError("请先点击「添加时间点」选定评论的音频位置");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/public/shares/${token}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, guestName, atMs: selectedAtMs }),
      });
      const body = (await response.json()) as { ok: boolean; data?: PublicComment; error?: { message?: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message || "评论发送失败");
      setComments((previous) => [...previous, body.data!]);
      setContent("");
      setSelectedAtMs(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "评论发送失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  function addTimestamp() {
    setSelectedAtMs(Math.round(currentTime * 1000));
  }

  function clearTimestamp() {
    setSelectedAtMs(null);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      {/* 顶部歌曲信息区：封面占位 / 标题 / 作者 / 版本号 / 描述 */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6">
        <div className="flex items-start gap-4">
          {/* 封面占位：无图片资源时使用克制色块 + 图标，不暴露私有素材 */}
          <div className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50">
            <Music2 className="size-7 text-muted-foreground" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-foreground">{share.title}</h1>
              <ModeTag mode={runMode} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {share.author} · 版本 v{share.versionNo}
            </p>
            {share.description ? (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{share.description}</p>
            ) : null}
          </div>
        </div>

        {/* 统一播放器：AudioPlayer；executionKind 已用 ModeTag 标注真实/模拟 */}
        <div className="mt-5 rounded-lg border border-border bg-muted/20 p-3">
          {share.hasAudio ? (
            <AudioPlayer
              durationLabel={durationLabel}
              seed={share.versionId.charCodeAt(0) || 7}
              markers={markers}
              current={currentTime}
              onSeek={(sec) => setCurrentTime(sec)}
              onTimeUpdate={(sec) => setCurrentTime(sec)}
            />
          ) : (
            <p className="py-2 text-center text-sm text-muted-foreground">该版本无音频</p>
          )}
        </div>
      </section>

      {/* Tabs[歌词 | 评论] */}
      <div className="mt-5 flex items-center gap-1 border-b border-border">
        <TabButton active={tab === "lyrics"} onClick={() => setTab("lyrics")} label="歌词" />
        <TabButton active={tab === "comments"} onClick={() => setTab("comments")} label="评论" count={timeline.length} />
      </div>

      {tab === "lyrics" ? (
        <section className="mx-auto max-w-[720px] py-5">
          {share.lyrics && share.lyrics.trim() ? (
            <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">{share.lyrics}</p>
          ) : (
            <p className="rounded-lg border border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
              当前版本暂无歌词
            </p>
          )}
        </section>
      ) : (
        <section className="py-5">
          {timeline.length ? (
            <ol className="space-y-2.5">
              {timeline.map((comment) => (
                <li
                  key={comment.id}
                  className="flex gap-3 rounded-lg border border-border bg-card px-3.5 py-3"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (comment.atMs !== null && share.hasAudio) {
                        const sec = comment.atMs / 1000;
                        setCurrentTime(sec);
                      }
                    }}
                    className="mt-0.5 inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-brand/30 bg-brand-muted/40 px-1.5 text-[11px] font-medium tabular-nums text-brand"
                    aria-label="跳转到该评论的音频时间点"
                  >
                    {commentTimeLabel(comment)}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground">{comment.author}</p>
                    <p className="mt-1 text-sm leading-6 text-foreground/90">{comment.content}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-lg border border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
              还没有反馈，留下第一条创作建议吧
            </p>
          )}

          {/* 评论输入区：未开放评论时提示；否则固定底部，需先选时间点 */}
          {share.allowComments ? (
            <form
              onSubmit={submit}
              className="sticky bottom-0 mt-5 space-y-2.5 rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
            >
              {/* 当前选中时间点：必须先添加时间点才能发送 */}
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Tag className="size-3.5" aria-hidden />
                  {selectedAtMs !== null ? (
                    <span className="tabular-nums text-brand">
                      评论时间点 {fmtTime(selectedAtMs / 1000)}
                    </span>
                  ) : (
                    <span>未选定时间点</span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  {selectedAtMs !== null ? (
                    <button
                      type="button"
                      onClick={clearTimestamp}
                      className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                    >
                      清除
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={addTimestamp}
                    disabled={!share.hasAudio}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    <Tag className="size-3.5" aria-hidden />
                    添加时间点
                  </button>
                </div>
              </div>

              <label className="block text-xs font-medium text-foreground">
                昵称
                <input
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  maxLength={40}
                  placeholder="访客昵称（登录用户可留空）"
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </label>
              <label className="block text-xs font-medium text-foreground">
                评论
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  required
                  maxLength={1000}
                  placeholder="例如：副歌可以再提前四拍进入。"
                  className="mt-1 min-h-20 w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </label>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <button
                disabled={isSubmitting || selectedAtMs === null}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                {isSubmitting ? "发送中" : "发送反馈"}
              </button>
            </form>
          ) : (
            <p className="mt-5 rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              未开放评论
            </p>
          )}
        </section>
      )}
    </main>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-brand text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {label === "评论" ? <MessageSquare className="size-3.5" aria-hidden /> : null}
      {label}
      {typeof count === "number" ? (
        <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
          {count}
        </span>
      ) : null}
    </button>
  );
}
