'use client'

/**
 * 歌曲详情栏（docs/SPEC.md §三.3）。
 *
 * 工作台最右侧滑入的详情栏，打开后与原料区、成果区形成三栏 1:1:1 布局。
 * 展示选中候选：封面占位 / 标题 / 版本号 / 统一播放器 / 歌词摘要 / 进入全屏详情。
 * - 候选阶段（未保存为版本）无 versionId，「进入全屏详情」禁用并提示先保存为版本。
 * - 已保存为版本时，提供 Link → /works/${projectId}/v/${versionId}。
 */
import { X, Maximize2, FileAudio, Lock } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { OUTPUT_TYPES, PROVIDERS, type DemoCandidate } from '@/lib/inspire-data'
import { AudioPlayer } from './audio-player'
import { ModeTag } from './ui'
import { Button } from '@/components/ui/button'

function hashSeed(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return Math.abs(h) % 100000
}

export interface SongDetailSheetCandidate {
  /** 候选或版本视图（复用 DemoCandidate 形状，附加可选 versionNo/savedVersionId）。 */
  candidate: DemoCandidate
  /** 已保存为版本后的版本号（用于「版本」徽标）。未保存时为 null。 */
  versionNo: number | null
  /** 已保存为版本后的版本 id（用于「进入全屏详情」）。未保存时为 null。 */
  versionId: string | null
  /** 歌词摘要（当前生效歌词的前若干行）。 */
  lyricsExcerpt: string
}

export function SongDetailSheet({
  open,
  onClose,
  projectId,
  data,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  data: SongDetailSheetCandidate | null
}) {
  if (!open) return null

  const c = data?.candidate
  const saved = Boolean(data?.versionId)

  return (
    <aside
      aria-label="歌曲详情栏"
      className={cn(
        'scrollbar-none flex min-w-0 flex-col border-l border-border bg-card/40 xl:overflow-y-auto',
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">歌曲详情</h3>
        <button
          onClick={onClose}
          aria-label="关闭详情栏"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </header>

      {!c || !data ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <FileAudio className="size-5 text-muted-foreground" />
          </div>
          <h4 className="mt-3 text-sm font-medium text-foreground">未选择歌曲</h4>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
            点击成果区的生成结果，这里会展示该候选的详情与播放器。
          </p>
        </div>
      ) : (
        <div className="flex-1 space-y-4 p-4">
          {/* 封面占位 + 标题 + 版本 */}
          <div className="flex gap-3">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
              {c.cover ? (
                <Image src={c.cover} alt={c.title} fill className="object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center bg-brand/10 text-brand">
                  <FileAudio className="size-7" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="truncate text-sm font-semibold text-foreground">{c.title}</h4>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {data.versionNo != null && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground">
                    v{data.versionNo}
                  </span>
                )}
                <ModeTag mode={c.mode} />
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[11px] font-medium',
                    saved ? 'bg-success/10 text-success-foreground' : 'bg-warning/10 text-warning-foreground',
                  )}
                >
                  {saved ? '已保存' : '未保存'}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {c.bpm} BPM · {c.key} · {c.duration}
              </p>
            </div>
          </div>

          {/* 统一播放器 */}
          <div className="rounded-lg border border-border bg-background p-3">
            {c.audioUrl ? (
              <audio controls preload="metadata" src={c.audioUrl} className="h-9 w-full" aria-label={`${c.title} 播放器`} />
            ) : (
              <AudioPlayer durationLabel={c.duration} seed={hashSeed(c.id)} bars={40} />
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              {c.mode === 'real' ? '真实生成音频' : '模拟输出（未接入音乐模型）'}
            </p>
          </div>

          {/* 元信息 */}
          <dl className="grid grid-cols-2 gap-2 text-[11px]">
            {[
              ['类型', OUTPUT_TYPES.find((o) => o.id === c.outputType)?.label ?? '—'],
              ['提供方', PROVIDERS.find((p) => p.id === c.providerId)?.name ?? '—'],
              ['时长', c.duration],
              ['调性', c.key],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between rounded-md border border-border bg-background px-2 py-1.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="truncate font-medium text-foreground">{v}</dd>
              </div>
            ))}
          </dl>

          {/* 描述 */}
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              创作说明
            </p>
            <p className="text-xs leading-relaxed text-foreground">{c.descriptor}</p>
          </div>

          {/* 歌词摘要 */}
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              歌词摘要
            </p>
            <p className="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
              {data.lyricsExcerpt.trim() ? data.lyricsExcerpt : '暂无歌词'}
            </p>
          </div>

          {/* 进入全屏详情：未保存为版本时禁用 */}
          <div className="border-t border-border pt-3">
            {saved && data.versionId ? (
              <Link href={`/works/${projectId}/v/${data.versionId}`}>
                <Button variant="outline" size="sm" className="w-full">
                  <Maximize2 className="size-3.5" />
                  进入全屏详情
                </Button>
              </Link>
            ) : (
              <Button variant="outline" size="sm" disabled className="w-full">
                <Lock className="size-3.5" />
                进入全屏详情
              </Button>
            )}
            {!saved && (
              <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
                先保存为版本后，可进入全屏详情页查看完整歌词与评论。
              </p>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}
