'use client'

/**
 * 歌曲详情 Tab 区（歌词 / 评论）。docs/UI-design.md + 时间线评论区 UI 与交互规范。
 *
 * 布局：Tab 区 flex-1 min-h-0，内部 overflow-y-auto——主页面不滚动，
 * 歌词/评论内容多时在 Tab 区内部滚动。
 *
 * 时间线评论区（规范要点）：
 * - 评论输入区固定在时间线列表上方：显示已选中的「评论于 mm:ss」；
 *   评论时间一旦选中不随播放推进改变，需点「更新为当前时间」主动替换；
 *   未选择时间时禁用发送（评论必须绑定时间点）。
 * - 同一时间点（整秒）的评论归为一个 TimelineCommentGroup，只生成一个节点；
 *   节点与该分组第一条评论顶部对齐，节点+评论在同一行级 grid 容器中，
 *   由内容高度自动撑开（不按歌曲时长比例定位、不用绝对定位对齐列表）。
 * - 排序：先按音频时间升序，同一时间点内按发布时间升序。
 * - 播放联动：currentTime 落在 [本组时间, 下组时间) 区间时高亮本组节点；
 *   点击节点 → seek + 播放 + 分组浅色闪烁；播放推进不自动滚动页面，
 *   仅点「定位当前评论」时滚动到当前高亮分组。
 * - 移动端（<md）：左列收起，时间标签和节点移到评论组顶部，纵线沿左侧延伸。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Clock3,
  Loader2,
  LocateFixed,
  MessageSquare,
  MoreHorizontal,
  Reply,
  Send,
  ThumbsUp,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OwnerCommentView } from '@/modules/sharing/share-service'

export type SongDetailTab = 'lyrics' | 'comments'

interface Props {
  projectId: string
  versionId: string
  /** 版本号，用于「歌词 · 当前版本 Vn」提示。 */
  versionNo: number
  isMain: boolean
  authorName: string
  lyrics: string
  comments: OwnerCommentView[]
  /** 播放器当前时间（秒，由父组件 SongDetailClient 持有并下沉）。 */
  currentTime: number
  hasAudio: boolean
  /** 点击时间轴节点/评论时间 → 跳转到该时间并开始播放。 */
  onSeekAndPlay: (sec: number) => void
  /** 评论时间锚点（ms）；null = 未选择。提升到父组件，跨 Tab 切换存活。 */
  anchorMs: number | null
  onAnchorChange: (ms: number | null) => void
}

type Tab = SongDetailTab

export function SongDetailTabs(props: Props) {
  const { projectId, versionId, versionNo, isMain, authorName, lyrics, comments, currentTime, hasAudio, onSeekAndPlay, anchorMs, onAnchorChange } = props
  const [tab, setTab] = useState<Tab>('lyrics')

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Tab 头 */}
      <div className="shrink-0 border-b border-border bg-background px-6 sm:px-8">
        <div className="mx-auto flex max-w-5xl gap-6">
          <TabButton active={tab === 'lyrics'} onClick={() => setTab('lyrics')} testId="tab-lyrics">
            歌词
          </TabButton>
          <TabButton active={tab === 'comments'} onClick={() => setTab('comments')} testId="tab-comments">
            评论
            <Count n={comments.length} />
          </TabButton>
        </div>
      </div>

      {/* Tab 内容：flex-1 min-h-0 overflow-y-auto，主页面不滚动，此处内部滚动 */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'lyrics' ? (
          <LyricsPanel lyrics={lyrics} versionNo={versionNo} isMain={isMain} />
        ) : (
          <CommentsPanel
            projectId={projectId}
            versionId={versionId}
            authorName={authorName}
            comments={comments}
            currentTime={currentTime}
            hasAudio={hasAudio}
            onSeekAndPlay={onSeekAndPlay}
            anchorMs={anchorMs}
            onAnchorChange={onAnchorChange}
          />
        )}
      </div>
    </div>
  )
}

function TabButton({ active, onClick, children, testId }: { active: boolean; onClick: () => void; children: React.ReactNode; testId?: string }) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 border-b-2 pb-3 pt-1 text-sm font-medium transition-colors',
        active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function Count({ n }: { n: number }) {
  return <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground">{n}</span>
}

// ----------------------------- 歌词 Tab -----------------------------

function LyricsPanel({ lyrics, versionNo, isMain }: { lyrics: string; versionNo: number; isMain: boolean }) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-6 sm:px-8">
      <p className="mb-4 text-xs text-muted-foreground">
        歌词 · 当前版本 V{versionNo}
        {isMain ? ' · 主版本' : ''}
      </p>
      {!lyrics.trim() ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">暂无歌词</p>
          <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">在制作台填写歌词后，会显示在此处。</p>
        </div>
      ) : (
        <article className="mx-auto max-w-[680px]">
          <LyricsBlocks lyrics={lyrics} />
        </article>
      )}
    </div>
  )
}

/** 将 [Verse]/[Chorus]/[Bridge] 等结构标签弱化（小字、低对比），正文行距宽松，不用大卡片包裹。 */
function LyricsBlocks({ lyrics }: { lyrics: string }) {
  const lines = lyrics.split('\n')
  const currentTag: string | null = null
  const buffer: string[] = []
  const blocks: { tag: string | null; lines: string[] }[] = []

  function flush(tag: string | null, buf: string[]) {
    if (buf.length > 0 || tag !== null) blocks.push({ tag, lines: buf })
  }

  let tag: string | null = currentTag
  let buf = [...buffer]
  for (const raw of lines) {
    const line = raw.trimEnd()
    const match = line.match(/^\s*\[(Verse|Chorus|Pre-Chorus|Bridge|Intro|Outro|Hook|Refrain|Instrumental|Solo|Interlude)\]\s*$/i)
    if (match) {
      flush(tag, buf)
      tag = match[1]
      buf = []
    } else {
      buf.push(line)
    }
  }
  flush(tag, buf)

  const hasTags = blocks.some((b) => b.tag !== null)
  if (!hasTags) {
    return (
      <div className="space-y-1.5">
        {lines.map((line, i) => (
          <p key={i} className={cn('text-[15px] leading-8 text-foreground', line.trim() === '' && 'h-3')}>
            {line || ' '}
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {blocks.map((block, i) => (
        <section key={i}>
          {block.tag ? <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground/80">{block.tag}</p> : null}
          <div className="space-y-1.5">
            {block.lines.map((line, j) => (
              <p key={j} className={cn('text-[15px] leading-8 text-foreground', line.trim() === '' && 'h-3')}>
                {line || ' '}
              </p>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// ----------------------------- 时间线评论区 -----------------------------

/** 一个时间点对应的评论分组：同一整秒的评论共享一个时间轴节点。 */
interface CommentGroup {
  key: string
  /** 音频时间（整秒）；null = 历史遗留的无时间点评论（排到最后）。 */
  atSec: number | null
  comments: OwnerCommentView[]
}

/** 先按音频时间升序分组（整秒），同一时间点内按发布时间升序（规范 §9）。 */
function groupByTime(comments: OwnerCommentView[]): CommentGroup[] {
  const timed = new Map<number, OwnerCommentView[]>()
  const untimed: OwnerCommentView[] = []
  for (const c of comments) {
    if (c.atMs === null) {
      untimed.push(c)
      continue
    }
    const sec = Math.floor(c.atMs / 1000)
    const list = timed.get(sec)
    if (list) list.push(c)
    else timed.set(sec, [c])
  }
  const byCreatedAsc = (a: OwnerCommentView, b: OwnerCommentView) => a.createdAt.localeCompare(b.createdAt)
  const groups: CommentGroup[] = [...timed.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([sec, list]) => ({ key: `t${sec}`, atSec: sec, comments: [...list].sort(byCreatedAsc) }))
  if (untimed.length > 0) {
    groups.push({ key: 'untimed', atSec: null, comments: [...untimed].sort(byCreatedAsc) })
  }
  return groups
}

/** 播放联动（规范 §6）：当前时间落在 [本组时间, 下组时间) 区间的分组高亮。 */
function findActiveGroupKey(groups: CommentGroup[], currentTimeSec: number): string | null {
  let active: string | null = null
  for (const g of groups) {
    if (g.atSec === null) continue
    if (g.atSec <= currentTimeSec) active = g.key
  }
  return active
}

interface CommentsPanelProps {
  projectId: string
  versionId: string
  authorName: string
  comments: OwnerCommentView[]
  currentTime: number
  hasAudio: boolean
  onSeekAndPlay: (sec: number) => void
  anchorMs: number | null
  onAnchorChange: (ms: number | null) => void
}

function CommentsPanel({ projectId, versionId, authorName, comments, currentTime, hasAudio, onSeekAndPlay, anchorMs, onAnchorChange }: CommentsPanelProps) {
  const router = useRouter()

  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  /** 被点击跳转的分组短暂显示浅色背景（规范 §6.3）。 */
  const [flashKey, setFlashKey] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const listRef = useRef<HTMLOListElement | null>(null)

  const groups = useMemo(() => groupByTime(comments), [comments])
  const activeKey = hasAudio ? findActiveGroupKey(groups, Math.floor(currentTime)) : null

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current)
  }, [])

  const flash = useCallback((key: string) => {
    setFlashKey(key)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlashKey(null), 1200)
  }, [])

  /** 点击时间节点/评论：跳转 + 播放 + 分组浅色闪烁 + 在该时间点追加评论（规范 §2.3、§6）。 */
  const jumpToGroup = useCallback((g: CommentGroup) => {
    if (g.atSec === null) return
    onSeekAndPlay(g.atSec)
    onAnchorChange(g.atSec * 1000)
    flash(g.key)
  }, [onSeekAndPlay, onAnchorChange, flash])

  /** 「定位当前评论」：唯一允许的主动滚动（规范 §6：播放推进不自动滚动页面）。 */
  const locateActive = useCallback(() => {
    if (!activeKey || !listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(`[data-group-key="${activeKey}"]`)
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeKey])

  /** 回复：绑定该分组时间点 + @作者 预填，聚焦输入框。 */
  const replyTo = useCallback((g: CommentGroup, author: string) => {
    if (g.atSec !== null) onAnchorChange(g.atSec * 1000)
    const mention = `@${author} `
    setText((t) => (t.startsWith(mention) ? t : mention + t))
    textareaRef.current?.focus()
  }, [onAnchorChange])

  async function sendComment(e: React.FormEvent) {
    e.preventDefault()
    const content = text.trim()
    // 评论必须绑定时间点（规范 §2：不提供不带时间的普通评论）。
    if (!content || anchorMs === null || sending) return
    setSendError('')
    setSending(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ versionId, content, atMs: anchorMs }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: { message?: string } }
      if (!res.ok || !json.ok) throw new Error(json.error?.message || '发送评论失败')
      // 发送完成后清空文字，但保留评论时间，方便在同一位置继续补充（规范 §7）。
      setText('')
      router.refresh()
    } catch (err) {
      setSendError(err instanceof Error ? err.message : '发送评论失败')
    } finally {
      setSending(false)
    }
  }

  const anchored = anchorMs !== null
  const sendDisabled = !anchored || sending || text.trim().length === 0
  const nowSec = Math.floor(currentTime)

  return (
    <div className="mx-auto max-w-3xl px-6 py-6 sm:px-8">
      {/* ---------- 评论输入区（固定在时间线列表上方，规范 §2） ---------- */}
      <form onSubmit={(e) => void sendComment(e)} className="rounded-xl border border-border bg-card p-3.5 shadow-xs" data-testid="comment-input">
        {hasAudio ? (
          <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {anchored ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-muted px-2 py-1 text-xs font-medium text-brand" data-testid="comment-anchor">
                  <Clock3 className="size-3.5" aria-hidden />
                  评论于 <span className="font-mono tabular-nums">{fmtSec(Math.floor(anchorMs / 1000))}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onAnchorChange(Math.round(currentTime * 1000))}
                  className="text-xs text-muted-foreground transition-colors hover:text-primary hover:underline"
                >
                  更新为当前时间（<span className="font-mono tabular-nums">{fmtSec(nowSec)}</span>）
                </button>
              </>
            ) : (
              <>
                <span className="text-xs text-muted-foreground" data-testid="comment-anchor-empty">请先在播放器中选择评论时间</span>
                <button
                  type="button"
                  onClick={() => onAnchorChange(Math.round(currentTime * 1000))}
                  className="inline-flex items-center gap-1.5 rounded-md border border-brand/40 bg-brand-muted/60 px-2 py-1 text-xs font-medium text-brand transition-colors hover:bg-brand-muted"
                >
                  <Clock3 className="size-3.5" aria-hidden />
                  评论当前时间（<span className="font-mono tabular-nums">{fmtSec(nowSec)}</span>）
                </button>
              </>
            )}
          </div>
        ) : (
          <p className="mb-2.5 text-xs text-muted-foreground">该版本暂无音频，无法发表时间点评论</p>
        )}
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!hasAudio}
            placeholder={anchored ? '输入对当前时刻的修改意见…' : '请先在播放器中选择评论时间'}
            rows={2}
            className="min-h-[44px] flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={sendDisabled}
            className="flex h-9 shrink-0 items-center gap-1.5 self-end rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Send className="size-3.5" aria-hidden />}
            发送
          </button>
        </div>
        {sendError ? <p role="alert" className="mt-1.5 text-xs text-destructive">{sendError}</p> : null}
      </form>

      {/* ---------- 时间线评论列表 ---------- */}
      {comments.length === 0 ? (
        /* 空状态：不显示空白时间轴（规范 §7） */
        <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="comment-timeline-empty">
          <div className="flex size-11 items-center justify-center rounded-full bg-muted">
            <MessageSquare className="size-5 text-muted-foreground" aria-hidden />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">还没有时间点评论</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">播放到想讨论的位置，留下第一条意见。</p>
        </div>
      ) : (
        <>
          <div className="mb-5 mt-6 flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              时间线评论 · {comments.length}
            </p>
            <button
              type="button"
              onClick={locateActive}
              disabled={!activeKey}
              data-testid="locate-active-comment"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              title={activeKey ? '滚动到当前播放位置对应的评论' : '播放后可定位当前评论'}
            >
              <LocateFixed className="size-3.5" aria-hidden />
              定位当前评论
            </button>
          </div>

          <ol ref={listRef} data-testid="comment-timeline">
            {groups.map((g, i) => (
              <TimelineCommentGroup
                key={g.key}
                group={g}
                first={i === 0}
                last={i === groups.length - 1}
                active={g.key === activeKey}
                flashing={g.key === flashKey}
                authorName={authorName}
                onJump={jumpToGroup}
                onReply={replyTo}
              />
            ))}
          </ol>
        </>
      )}
    </div>
  )
}

// ----------------------------- 时间轴分组（TimelineCommentGroup） -----------------------------

interface TimelineCommentGroupProps {
  group: CommentGroup
  first: boolean
  last: boolean
  active: boolean
  flashing: boolean
  authorName: string
  onJump: (g: CommentGroup) => void
  onReply: (g: CommentGroup, author: string) => void
}

/**
 * 一个时间节点 + 对应评论组，位于同一行级 grid 容器（左列 96px / 右列自适应），
 * 纵向连接线在左列内部绝对定位：从节点延伸到分组底部，与下一组自然衔接；
 * 首组节点上方、末组节点下方不显示延伸线（规范 §3、§5）。
 */
function TimelineCommentGroup({ group: g, first, last, active, flashing, authorName, onJump, onReply }: TimelineCommentGroupProps) {
  const timed = g.atSec !== null
  return (
    <li
      data-group-key={g.key}
      data-testid={`timeline-group-${g.key}`}
      className={cn(
        'relative rounded-lg transition-colors duration-700 md:grid md:grid-cols-[96px_minmax(0,1fr)] md:gap-x-[18px]',
        flashing && 'bg-brand-muted/40',
      )}
    >
      {/* TimelineMarker：桌面左列 / 移动端组顶部 */}
      <div className="relative">
        {/* 桌面纵向连接线（节点中心 x = 右缘内 5.5px）：上段非首组、下段非末组 */}
        {timed && !first ? (
          <span aria-hidden className="absolute right-[5px] top-0 hidden h-[7px] w-px bg-border md:block" />
        ) : null}
        {timed && !last ? (
          <span aria-hidden className="absolute bottom-0 right-[5px] top-[18px] hidden w-px bg-border md:block" />
        ) : null}

        {/* 桌面：时间文本在节点左侧，节点与首条评论顶部对齐 */}
        <button
          type="button"
          onClick={() => onJump(g)}
          disabled={!timed}
          data-testid={`timeline-node-${g.key}`}
          title={timed ? `跳转到 ${fmtSec(g.atSec as number)} 并播放` : undefined}
          className="group/marker absolute inset-x-0 top-0 hidden items-start justify-end gap-2.5 md:flex"
        >
          <span
            className={cn(
              'font-mono text-xs leading-[22px] tabular-nums transition-colors',
              active ? 'font-semibold text-primary' : 'text-muted-foreground group-hover/marker:text-foreground',
            )}
          >
            {timed ? fmtSec(g.atSec as number) : '未标时间'}
          </span>
          <span
            aria-hidden
            className={cn(
              'mt-[6px] size-[11px] shrink-0 rounded-full border-2 transition-colors',
              !timed && 'border-border bg-muted',
              timed && (active
                ? 'border-primary bg-primary'
                : 'border-muted-foreground/40 bg-background group-hover/marker:border-primary/60'),
            )}
          />
        </button>

        {/* 移动端：节点在前、时间在后（● 00:21），置于评论组顶部 */}
        <button
          type="button"
          onClick={() => onJump(g)}
          disabled={!timed}
          className="group/marker flex items-center gap-2 md:hidden"
        >
          <span
            aria-hidden
            className={cn(
              'size-[11px] shrink-0 rounded-full border-2 transition-colors',
              !timed && 'border-border bg-muted',
              timed && (active ? 'border-primary bg-primary' : 'border-muted-foreground/40 bg-background'),
            )}
          />
          <span className={cn('font-mono text-xs tabular-nums', active ? 'font-semibold text-primary' : 'text-muted-foreground')}>
            {timed ? fmtSec(g.atSec as number) : '未标时间'}
          </span>
        </button>

        {/* 移动端纵向线：节点下方沿评论组左侧延伸（非末组） */}
        {timed && !last ? (
          <span aria-hidden className="absolute left-[5px] top-[24px] h-[calc(100%-24px)] w-px bg-border md:hidden" />
        ) : null}
      </div>

      {/* CommentGroupContent：同一时间点的评论纵向排列，开放式列表 + 浅色分隔线（规范 §4） */}
      <div className={cn('min-w-0 pl-[26px] pt-2 md:pl-0 md:pt-0', last ? 'pb-2' : 'pb-8')}>
        {/* 移动端非末组的纵线延伸到组底：由左列线覆盖，无需重复 */}
        <ul className="divide-y divide-border/50">
          {g.comments.map((c) => (
            <CommentItem key={c.id} comment={c} authorName={authorName} onReply={(author) => onReply(g, author)} />
          ))}
        </ul>
      </div>
    </li>
  )
}

// ----------------------------- 评论项 -----------------------------

function CommentItem({ comment: c, authorName, onReply }: { comment: OwnerCommentView; authorName: string; onReply: (author: string) => void }) {
  const name = (c.author || authorName || '?').trim()
  const initial = name.charAt(0).toUpperCase() || '?'
  // 点赞为本地视觉反馈（后端暂无点赞模型）。
  const [liked, setLiked] = useState(false)

  return (
    <li data-comment-id={c.id} className="flex gap-3 py-3.5 first:pt-0 last:pb-0">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-muted text-xs font-semibold text-brand" aria-hidden>
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium text-foreground">{name}</span>
          <span className="text-xs text-muted-foreground">· {fmtRelative(c.createdAt)}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-foreground/90">{c.content}</p>
        <div className="mt-1.5 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setLiked((v) => !v)}
            aria-pressed={liked}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs transition-colors',
              liked ? 'text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <ThumbsUp className={cn('size-3.5', liked && 'fill-current')} aria-hidden />
            {liked ? '已赞' : '赞'}
          </button>
          <button
            type="button"
            onClick={() => onReply(name)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Reply className="size-3.5" aria-hidden />
            回复
          </button>
          <CommentMoreMenu id={c.id} />
        </div>
      </div>
    </li>
  )
}

/** 更多操作（删除评论收纳于此，规范 §4）。 */
function CommentMoreMenu({ id }: { id: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  async function del() {
    if (deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' })
      const json = (await res.json()) as { ok?: boolean; error?: { message?: string } }
      if (!res.ok || !json.ok) throw new Error(json.error?.message || '删除失败')
      setOpen(false)
      router.refresh()
    } catch {
      setDeleting(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="更多操作"
        aria-expanded={open}
        className="inline-flex items-center rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <MoreHorizontal className="size-3.5" aria-hidden />
      </button>
      {open ? (
        <div className="absolute left-0 z-20 mt-1 w-32 rounded-lg border border-border bg-popover p-1 shadow-md">
          <button
            type="button"
            onClick={() => void del()}
            disabled={deleting}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
          >
            {deleting ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Trash2 className="size-3.5" aria-hidden />}
            删除评论
          </button>
        </div>
      ) : null}
    </div>
  )
}

// ----------------------------- 工具 -----------------------------

/** 音频时间格式：< 1 小时 mm:ss，≥ 1 小时 hh:mm:ss（规范 §3）。 */
function fmtSec(sec: number) {
  const safe = Math.max(0, Math.floor(sec))
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  const s = safe % 60
  const mm = m.toString().padStart(2, '0')
  const ss = s.toString().padStart(2, '0')
  return h > 0 ? `${h.toString().padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`
}

function fmtRelative(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} 天前`
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
