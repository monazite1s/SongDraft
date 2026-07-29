'use client'

/**
 * 歌曲详情页 client 外壳（/works/[projectId]/v/[versionId]）。
 *
 * 布局（docs/UI-design.md，用户反馈逐项修正）：
 * - 整页 h-screen flex 纵向：
 *   ① 顶部栏（固定 h-14）：仅 返回 + 歌曲路径（歌名 / 歌曲详情）。
 *   ② 歌曲信息区（自然高度）：封面 + 信息 + 操作按钮组（分享/编辑/历史版本/更多，
 *     紧贴信息区右上角）+ 全页唯一播放器。
 *   ③ Tab 区（flex-1 min-h-0 overflow-hidden）：歌词/评论，内部 overflow-y-auto，
 *     主页面不滚动，Tab 内容在 Tab 区内滚动。
 * - 主内容容器 mx-auto max-w-5xl 两侧对称 padding，视觉居中。
 * - 播放器状态（currentTime/isPlaying/duration + seek 句柄）提升到此，Tab 共享；
 *   切 Tab 时播放器不卸载、不刷新、不停止。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown, Download, Loader2, MoreHorizontal, Pencil, Share2, History, Trash2, FileAudio, Music2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/inspire/ui'
import { ShareModal } from '@/components/inspire/share-modal'
import { VersionSwitcher } from '@/components/works/version-switcher'
import { SongPlayer, type SongPlayerHandle } from '@/components/works/song-player'
import { SongDetailTabs } from '@/components/works/song-detail-tabs'
import { cn } from '@/lib/utils'
import type { DemoVersionView } from '@/modules/generation/generation-types'
import type { OwnerCommentView } from '@/modules/sharing/share-service'

interface Props {
  projectId: string
  /** 所属歌曲（项目）名，用于顶部栏 + 信息区标题。 */
  projectTitle: string
  description: string | null
  lyrics: string
  authorName: string
  authorInitial: string
  createdAt: string
  updatedAt: string
  status: 'draft' | 'analyzing' | 'review' | 'ready' | 'collaborating' | 'archived'
  versions: DemoVersionView[]
  version: DemoVersionView
  comments: OwnerCommentView[]
}

const STATUS_LABEL: Record<Props['status'], string> = {
  draft: '草稿',
  analyzing: '分析中',
  review: '审阅',
  ready: '已完成',
  collaborating: '协作中',
  archived: '已归档',
}

export function SongDetailClient(props: Props) {
  const { projectId, projectTitle, description, lyrics, authorName, authorInitial, createdAt, updatedAt, status, versions, version, comments } = props

  const [shareOpen, setShareOpen] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)

  // 播放器状态（全页唯一，提升到此）。
  const [currentTime, setCurrentTime] = useState(0)
  const [, setIsPlaying] = useState(false)
  const [, setDuration] = useState(0)
  const playerHandle = useRef<SongPlayerHandle | null>(null)

  /**
   * 评论时间锚点（规范 §2）：提升到此处使其跨 Tab 切换存活。
   * null = 未选择评论时间（输入区禁用发送）；一旦选中不随播放推进改变，
   * 仅在用户点「评论当前时间 / 更新为当前时间」、拖动进度条或点时间轴节点时更新。
   */
  const [commentAnchorMs, setCommentAnchorMs] = useState<number | null>(null)

  /** 点击时间轴节点/评论时间 → 跳转并开始播放（规范 §3、§6）。 */
  const seekAndPlay = useCallback((sec: number) => {
    playerHandle.current?.seek(sec)
    playerHandle.current?.play()
  }, [])

  /** 用户拖动/点击进度条 → 自动把评论时间绑定到新位置（规范 §2.2）。 */
  const handleUserSeek = useCallback((sec: number) => {
    setCommentAnchorMs(Math.round(sec * 1000))
  }, [])

  const hasAudio = version.hasAudio && Boolean(version.audioUrl)

  return (
    <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden bg-background">
      {/* 顶部操作栏：仅 返回 + 歌曲路径（操作按钮移到信息区右上角） */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-6">
        <Link href={`/works/${projectId}`}>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="size-4" />
            返回
          </Button>
        </Link>
        <div className="h-4 w-px bg-border" aria-hidden />
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Music2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate text-muted-foreground" title={projectTitle}>{projectTitle}</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="shrink-0 font-medium text-foreground">歌曲详情</span>
        </div>
      </header>

      {/*
        主体：信息区（自然高度）+ Tab 区（flex-1，占满剩余高度，内部滚动）。
        min-h-0 保证 flex-1 的 Tab 区能正确触发内部 overflow-y-auto，主页面不滚动。
      */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* 歌曲信息区 */}
        <section className="shrink-0 border-b border-border bg-background px-6 pt-6 pb-5 sm:px-8">
          <div className="mx-auto max-w-5xl">
            {/* 信息块：封面 + 信息  + 操作按钮组（紧贴右上角） */}
            <div className="flex items-start gap-6">
              {/* 封面 */}
              <div className="flex size-[180px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-muted to-brand-muted/40 lg:size-[220px]">
                <FileAudio className="size-14 text-brand" aria-hidden />
              </div>

              {/* 信息 */}
              <div className="min-w-0 flex-1">
                {/* 操作按钮组：紧贴信息区右上角（封面+信息块的最上方） */}
                <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShareOpen(true)}>
                    <Share2 className="size-3.5" />
                    分享
                  </Button>
                  <Link href={`/create/${projectId}`}>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Pencil className="size-3.5" />
                      编辑
                    </Button>
                  </Link>
                  {versions.length > 1 ? (
                    <VersionSwitcher projectId={projectId} versions={versions} currentId={version.id}>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <History className="size-3.5" />
                        历史版本
                      </Button>
                    </VersionSwitcher>
                  ) : (
                    <Button variant="outline" size="sm" className="gap-1.5 opacity-50" disabled title="仅一个版本，无可切换的历史">
                      <History className="size-3.5" />
                      历史版本
                    </Button>
                  )}
                  <MoreMenu
                    hasAudio={hasAudio}
                    audioUrl={version.audioUrl ?? null}
                    projectTitle={projectTitle}
                    versionNo={version.versionNo}
                    projectId={projectId}
                    versionId={version.id}
                    canDelete={versions.length > 1}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">歌曲 Demo</Badge>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                    {STATUS_LABEL[status]}
                  </span>
                  {version.isMain ? (
                    <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success-foreground">
                      主版本
                    </span>
                  ) : null}
                </div>

                <h1 className="mt-2 line-clamp-2 text-2xl font-semibold tracking-tight text-foreground">
                  {version.title || projectTitle || '未命名版本'}
                </h1>

                <div className="mt-2 flex items-center gap-2">
                  <div className="flex size-6 items-center justify-center rounded-full bg-brand-muted text-[11px] font-semibold text-brand">
                    {authorInitial}
                  </div>
                  <span className="text-sm text-muted-foreground">{authorName}</span>
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  创建于 {fmtDate(createdAt)}
                  <span className="mx-1.5 text-muted-foreground/50">·</span>
                  最近更新 {fmtDate(updatedAt)}
                  <span className="mx-1.5 text-muted-foreground/50">·</span>
                  当前版本 V{version.versionNo}
                </p>

                {description ? (
                  <DescriptionBlock text={description} expanded={descExpanded} onToggle={() => setDescExpanded((v) => !v)} />
                ) : null}
              </div>
            </div>

            {/* 播放器（全页唯一，位于 Tab 之外 → 切 Tab 不刷新/不停止） */}
            <div className="mt-5">
              {hasAudio && version.audioUrl ? (
                <SongPlayer
                  key={version.id}
                  audioUrl={version.audioUrl}
                  seed={hashSeed(version.id)}
                  handleRef={playerHandle}
                  onTimeChange={setCurrentTime}
                  onPlayingChange={setIsPlaying}
                  onDurationChange={setDuration}
                  onUserSeek={handleUserSeek}
                />
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  <FileAudio className="size-4" />
                  该版本暂无音频
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Tab 区（共享播放器状态）：flex-1 占满剩余高度，内部 overflow-y-auto，主页面不滚动 */}
        <SongDetailTabs
          projectId={projectId}
          versionId={version.id}
          versionNo={version.versionNo}
          isMain={version.isMain}
          authorName={authorName}
          lyrics={lyrics}
          comments={comments}
          currentTime={currentTime}
          hasAudio={hasAudio}
          onSeekAndPlay={seekAndPlay}
          anchorMs={commentAnchorMs}
          onAnchorChange={setCommentAnchorMs}
        />
      </div>

      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} projectId={projectId} />
    </div>
  )
}

function DescriptionBlock({ text, expanded, onToggle }: { text: string; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="mt-3 max-w-2xl">
      <p className={cn('text-sm leading-6 text-muted-foreground', !expanded && 'line-clamp-3')}>
        {text}
      </p>
      {text.length > 120 ? (
        <button
          type="button"
          onClick={onToggle}
          className="mt-1 inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
        >
          {expanded ? '收起' : '展开'}
          <ChevronDown className={cn('size-3 transition-transform', expanded && 'rotate-180')} aria-hidden />
        </button>
      ) : null}
    </div>
  )
}

function MoreMenu({
  hasAudio,
  audioUrl,
  projectTitle,
  versionNo,
  projectId,
  versionId,
  canDelete,
}: {
  hasAudio: boolean
  audioUrl: string | null
  projectTitle: string
  versionNo: number
  projectId: string
  versionId: string
  /** 仅一个版本时禁止删除（删除后项目无版本）。 */
  canDelete: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // 二次确认：首次点击变红「确认删除」，再次点击执行 DELETE。
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // 点击外部关闭（useEffect 内仅 add/remove 监听，无 setState 渲染期调整）。
  useClickOutside(ref, () => { setOpen(false); setConfirmingDelete(false) }, open)

  const downloadName = `${projectTitle || 'song'}-v${versionNo}`

  async function handleDelete() {
    if (!canDelete) return
    // 二次确认：首次点击进入确认态，再次点击才真正删除。
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    setDeleting(true)
    setError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/versions/${versionId}`, { method: 'DELETE' })
      const body = (await res.json()) as { ok?: boolean; error?: { message?: string } }
      if (!res.ok || !body.ok) throw new Error(body.error?.message || '删除版本失败')
      setOpen(false)
      setConfirmingDelete(false)
      // 删除后刷新：router.refresh() 让服务端组件重新拉取版本列表。
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除版本失败')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" size="icon-sm" aria-label="更多操作" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <MoreHorizontal className="size-4" />
      </Button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-border bg-popover p-1 shadow-md">
          {hasAudio && audioUrl ? (
            <a
              href={audioUrl}
              download={downloadName}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Download className="size-3.5" />
              下载音频
            </a>
          ) : (
            <span className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground/60">
              <Download className="size-3.5" />
              下载音频
            </span>
          )}
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={!canDelete || deleting}
            title={!canDelete ? '仅一个版本，无法删除' : undefined}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors disabled:cursor-not-allowed',
              canDelete
                ? confirmingDelete
                  ? 'text-destructive hover:bg-destructive/10'
                  : 'text-foreground hover:bg-muted'
                : 'text-muted-foreground/60',
            )}
          >
            {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            {deleting ? '删除中…' : confirmingDelete ? '确认删除' : '删除版本'}
          </button>
          {error ? <p role="alert" className="px-2 pt-1 text-[11px] leading-snug text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) handler()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [ref, handler, active])
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** 稳定的波形 seed（避免每次渲染抖动）。 */
function hashSeed(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0
  }
  return Math.abs(h) % 100000
}
