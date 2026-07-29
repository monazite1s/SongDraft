"use client";

/**
 * 公开分享页客户端：收听 Demo + 基于音频时间点发表评论。
 * 被分享用户仅有「收听 + 评论」权限，不显示分享/编辑/历史切换等管理操作（docs/SPEC.md §7 分享页）。
 * 评论必须绑定具体播放时间点后才能发送（SPEC §7 评论绑定音频时间点）。
 */
import { LoaderCircle, MessageSquare, Music2, Pause, Play, Send, Tag } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import type { PublicComment, PublicShare } from "@/modules/sharing/share-service";
import { cn } from "@/lib/utils";

type Tab = "lyrics" | "comments";

function fmtTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** 确定性装饰波形（低对比度，仅用于进度可视化，非真实频谱）。 */
function waveform(seed: number, count: number) {
  const bars: number[] = [];
  let x = seed * 9301 + 49297;
  for (let i = 0; i < count; i++) {
    x = (x * 9301 + 49297) % 233280;
    const r = x / 233280;
    bars.push(0.28 + r * 0.6);
  }
  return bars;
}

/** 按 versionId 生成稳定的波形 seed（避免每次渲染抖动）。 */
function seedFromVersionId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 100000 || 7;
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
  // 播放器当前播放时间（秒），由真实 <audio> 元素同步；评论绑定该时间点。
  const [currentTime, setCurrentTime] = useState(0);
  // 已选定的评论时间点（ms）；发送评论前必须先「添加时间点」。
  const [selectedAtMs, setSelectedAtMs] = useState<number | null>(null);

  // 真实音频播放状态：有 audioUrl 时用原生 <audio> 承载，不再用确定性伪波形冒充。
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);

  const hasRealAudio = Boolean(share.audioUrl);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().catch(() => {
        // 自动播放策略拦截 → 保持暂停态，不抛错。
      });
    } else {
      audio.pause();
    }
  }

  // 点击评论时间标签 / 评论时间轴节点 → 外部 seek 到该时间点。
  function seekTo(sec: number) {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = Math.max(0, Math.min(sec, Number.isFinite(duration) ? duration : sec));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }

  function seekFromEvent(e: React.MouseEvent<HTMLDivElement>) {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    seekTo(ratio * duration);
  }

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  // 确定性装饰波形（仅作进度可视化，非真实频谱；无音频时不渲染）。
  const wf = useMemo(() => waveform(seedFromVersionId(share.versionId), 56), [share.versionId]);


  // 评论时间轴：按 atMs 升序；无 atMs 的按 createdAt 兜底排在末尾（SPEC §7 按时间轴展示）。
  const timeline = useMemo(() => {
    return [...comments].sort((a, b) => {
      const at = a.atMs ?? Number.MAX_SAFE_INTEGER;
      const bt = b.atMs ?? Number.MAX_SAFE_INTEGER;
      if (at !== bt) return at - bt;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }, [comments]);

  // 评论标记点（在播放器进度条上标位置）。
  const markers = useMemo(
    () =>
      timeline
        .filter((c) => c.atMs !== null)
        .map((c) => ({ at: (c.atMs as number) / 1000 })),
    [timeline],
  );

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
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {share.author} · 版本 v{share.versionNo}
            </p>
            {share.description ? (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{share.description}</p>
            ) : null}
          </div>
        </div>

        {/* 播放器：有 audioUrl 时用真实音频；无音频时占位。 */}
        <div className="mt-5 rounded-lg border border-border bg-muted/20 p-3">
          {hasRealAudio && share.audioUrl ? (
            <div className="flex items-center gap-3">
              <audio
                ref={audioRef}
                src={share.audioUrl}
                preload="metadata"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => {
                  const d = e.currentTarget.duration;
                  setDuration(Number.isFinite(d) ? d : 0);
                }}
                onEnded={() => setPlaying(false)}
              />
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? "暂停" : "播放"}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
              </button>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{fmtTime(currentTime)}</span>
              <div
                className="relative flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-[2px]"
                onClick={seekFromEvent}
                role="slider"
                aria-label="播放进度"
                aria-valuenow={Math.round(progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                tabIndex={0}
              >
                {wf.map((h, i) => {
                  const on = i / wf.length <= progress;
                  return (
                    <span
                      key={i}
                      className={cn("w-full flex-1 rounded-full transition-colors", on ? "bg-brand" : "bg-border")}
                      style={{ height: `${Math.round(h * 100)}%` }}
                    />
                  );
                })}
                {markers.map((m, i) => (
                  <span
                    key={`m-${i}`}
                    className="absolute top-0 h-full w-px bg-warning/70"
                    style={{ left: duration > 0 ? `${(m.at / duration) * 100}%` : undefined }}
                    aria-hidden
                  />
                ))}
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {duration > 0 ? fmtTime(duration) : "--:--"}
              </span>
            </div>
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
                      if (comment.atMs !== null && hasRealAudio) {
                        seekTo(comment.atMs / 1000);
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
                    disabled={!hasRealAudio}
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
