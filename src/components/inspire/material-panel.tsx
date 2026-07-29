/**
 * 原料区：文本/歌词/指令与录音上传 UI；「精修歌词」经 onRefine 回调触发工作台 SSE。
 * 原始歌词与精修结果分轨：textarea 只绑用户原稿，精修版只展示 refinedLyrics。
 */
'use client'

import { useState } from 'react'
import {
  FileText,
  AudioLines,
  ImageIcon,
  Mic,
  Upload,
  Sparkles,
  Circle,
  Square,
  Check,
  ImageDown,
} from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { InputKind } from '@/lib/inspire-data'
import { AudioPlayer } from './audio-player'
import { Field } from './ui'

type Tab = InputKind extends never ? never : 'text' | 'audio' | 'image'

const TABS: { id: Tab; label: string; shortLabel: string; icon: typeof FileText; kind: InputKind }[] = [
  { id: 'text', label: '歌词 / 文本', shortLabel: '歌词', icon: FileText, kind: 'text' },
  { id: 'audio', label: '哼唱 / 音频', shortLabel: '音频', icon: AudioLines, kind: 'audio' },
  { id: 'image', label: '图像 / 视频', shortLabel: '图像', icon: ImageIcon, kind: 'image' },
]

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className="flex items-center gap-2 text-xs text-muted-foreground"
    >
      <span
        className={cn(
          'relative h-4 w-7 rounded-full transition-colors',
          checked ? 'bg-brand' : 'bg-border',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-3 rounded-full bg-background transition-all',
            checked ? 'left-3.5' : 'left-0.5',
          )}
        />
      </span>
      {label}
    </button>
  )
}

const inputBase =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20'

export interface MaterialDraft {
  creativePrompt: string
  lyrics: string
  instruction: string
}

function LyricsTab({
  draft,
  onChange,
  originalLyrics,
  refinedLyrics,
  isRefining,
  refinementMessage,
  refinementError,
  onRefine,
}: {
  draft: MaterialDraft
  onChange: (next: MaterialDraft) => void
  originalLyrics: string
  refinedLyrics: string | null
  isRefining: boolean
  refinementMessage: string
  refinementError: string
  onRefine: () => void
}) {
  const [view, setView] = useState<'refined' | 'original'>('refined')
  const hasRefined = Boolean(refinedLyrics?.trim())
  return (
    <div className="space-y-4">
      <Field label="创作提示" hint="用于引导精修方向">
        <input
          className={inputBase}
          value={draft.creativePrompt}
          placeholder="输入创作提示"
          onChange={(event) => onChange({ ...draft, creativePrompt: event.target.value })}
        />
      </Field>
      <Field label="原始歌词 / 文本">
        <textarea
          rows={5}
          className={cn(inputBase, 'resize-none leading-relaxed')}
          value={draft.lyrics}
          placeholder="输入歌词或文本"
          onChange={(event) => onChange({ ...draft, lyrics: event.target.value })}
        />
      </Field>
      <Field label="处理指令" hint="可选">
        <input
          className={inputBase}
          value={draft.instruction}
          placeholder="输入处理指令"
          onChange={(event) => onChange({ ...draft, instruction: event.target.value })}
        />
      </Field>

      <button onClick={onRefine} disabled={isRefining || !draft.lyrics.trim()} className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-wait disabled:opacity-60">
        <Sparkles className={cn('size-4 text-brand', isRefining && 'animate-pulse')} />
        {isRefining ? 'DeepSeek 精修中…' : '精修歌词'}
      </button>
      {refinementMessage && <p className="text-xs leading-relaxed text-muted-foreground">{refinementMessage}</p>}
      {refinementError && <p role="alert" className="text-xs text-destructive">{refinementError}</p>}

      <div className="rounded-lg border border-border bg-muted/40">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-xs font-medium text-foreground">精修结果</span>
          <div className="flex rounded-md border border-border bg-background p-0.5 text-[11px]">
            {(['refined', 'original'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'rounded px-2 py-0.5 transition-colors',
                  view === v
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {v === 'refined' ? '精修版' : '原始版'}
              </button>
            ))}
          </div>
        </div>
        {hasRefined || (view === 'original' && (originalLyrics || draft.lyrics).trim()) ? (
          <pre className="whitespace-pre-wrap px-3 py-2.5 font-sans text-sm leading-relaxed text-foreground">
            {view === 'refined' ? refinedLyrics : (originalLyrics || draft.lyrics)}
          </pre>
        ) : (
          <p className="px-3 py-2.5 text-sm text-muted-foreground">
            {view === 'refined' ? '尚未精修，可直接生成简报，或先精修歌词' : '暂无原始歌词'}
          </p>
        )}
      </div>
    </div>
  )
}

function AudioTab() {
  const [mode, setMode] = useState<'record' | 'upload'>('upload')
  const [file, setFile] = useState<{ name: string; url: string; durationLabel: string } | null>(null)

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0]
    if (!next) return
    if (file?.url) URL.revokeObjectURL(file.url)
    setFile({ name: next.name, url: URL.createObjectURL(next), durationLabel: '—' })
  }

  return (
    <div className="space-y-4">
      <div className="flex rounded-lg border border-border bg-background p-0.5">
        {(['record', 'upload'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm transition-colors',
              mode === m
                ? 'bg-secondary font-medium text-secondary-foreground'
                : 'text-muted-foreground',
            )}
          >
            {m === 'record' ? (
              <Mic className="size-3.5" />
            ) : (
              <Upload className="size-3.5" />
            )}
            {m === 'record' ? '现在录制' : '上传音频'}
          </button>
        ))}
      </div>

      {mode === 'upload' ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center transition-colors hover:bg-muted/60">
          <Upload className="size-5 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            拖拽或点击上传哼唱
          </span>
          <span className="text-xs text-muted-foreground">
            支持 mp3 / wav / m4a，建议 30 秒内
          </span>
          <input type="file" accept="audio/*" className="sr-only" onChange={onFileChange} />
        </label>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-6">
          <button type="button" className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20">
            <Circle className="size-5 fill-current" />
          </button>
          <span className="text-xs text-muted-foreground">点击开始录制</span>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Square className="size-3" />
            00:00
          </div>
        </div>
      )}

      {file && (
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="mb-2 text-xs font-medium text-foreground">
            {file.name} · {file.durationLabel}
          </p>
          <AudioPlayer durationLabel={file.durationLabel} seed={3} bars={44} />
        </div>
      )}
    </div>
  )
}

function ImageTab({
  coverSet,
  onSetCover,
}: {
  coverSet: boolean
  onSetCover: () => void
}) {
  const [image, setImage] = useState<{ name: string; url: string } | null>(null)

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0]
    if (!next) return
    if (image?.url) URL.revokeObjectURL(image.url)
    setImage({ name: next.name, url: URL.createObjectURL(next) })
  }

  return (
    <div className="space-y-4">
      {image ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="relative aspect-video w-full">
            <Image
              src={image.url}
              alt="已上传的参考图像"
              fill
              unoptimized
              className="object-cover"
            />
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border bg-card px-3 py-2">
            <span className="truncate text-xs text-muted-foreground">{image.name}</span>
            <button
              type="button"
              onClick={onSetCover}
              className={cn(
                'flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                coverSet
                  ? 'border-brand/30 bg-brand-muted text-brand'
                  : 'border-border bg-background text-foreground hover:bg-muted',
              )}
            >
              {coverSet ? (
                <>
                  <Check className="size-3.5" />
                  已设为封面
                </>
              ) : (
                <>
                  <ImageDown className="size-3.5" />
                  设为封面
                </>
              )}
            </button>
          </div>
        </div>
      ) : null}

      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/60">
        <Upload className="size-4" />
        {image ? '添加更多图像或视频' : '拖拽或点击上传图像 / 视频'}
        <input type="file" accept="image/*,video/*" className="sr-only" onChange={onFileChange} />
      </label>
    </div>
  )
}

export function MaterialPanel({
  selectedInputs,
  onToggleInput,
  coverSet,
  onSetCover,
  draft,
  onDraftChange,
  originalLyrics,
  refinedLyrics,
  isRefining,
  refinementMessage,
  refinementError,
  onRefine,
  footer,
}: {
  selectedInputs: InputKind[]
  onToggleInput: (k: InputKind) => void
  coverSet: boolean
  onSetCover: () => void
  draft: MaterialDraft
  onDraftChange: (next: MaterialDraft) => void
  originalLyrics: string
  refinedLyrics: string | null
  isRefining: boolean
  refinementMessage: string
  refinementError: string
  onRefine: () => void
  footer?: React.ReactNode
}) {
  const [tab, setTab] = useState<Tab>('text')

  return (
    <div className="flex h-full flex-col">
      {/* 标题与 Tab 之间、Tab 与内容之间都靠 Tab 的 my-[30px] 撑开；相邻区域不用再叠 py，避免视觉间距被放大 */}
      <div className="flex items-center justify-between px-4 pt-4">
        <h2 className="text-sm font-semibold text-foreground">素材构建</h2>
        <span className="text-[11px] text-muted-foreground">
          已选 {selectedInputs.length} / 3 类素材
        </span>
      </div>

      <div className="my-[10px] flex gap-1 px-3">
        {TABS.map((t) => {
          const active = tab === t.id
          const included = selectedInputs.includes(t.kind)
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-label={t.label}
              className={cn(
                'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium whitespace-nowrap transition-colors',
                active
                  ? 'border-border bg-card text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)]'
                  : 'border-transparent text-muted-foreground hover:bg-muted',
              )}
            >
              <t.icon className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate sm:hidden" aria-hidden>
                {t.shortLabel}
              </span>
              <span className="hidden truncate sm:inline" aria-hidden>
                {t.label}
              </span>
              {included && (
                <span className="size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
              )}
            </button>
          )
        })}
      </div>

      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div className="mb-3 flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
          <span className="text-xs text-muted-foreground">纳入本次生成</span>
          <Switch
            checked={selectedInputs.includes(TABS.find((t) => t.id === tab)!.kind)}
            onChange={() =>
              onToggleInput(TABS.find((t) => t.id === tab)!.kind)
            }
            label={
              selectedInputs.includes(TABS.find((t) => t.id === tab)!.kind)
                ? '已启用'
                : '已忽略'
            }
          />
        </div>

        {tab === 'text' && (
          <LyricsTab
            draft={draft}
            onChange={onDraftChange}
            originalLyrics={originalLyrics}
            refinedLyrics={refinedLyrics}
            isRefining={isRefining}
            refinementMessage={refinementMessage}
            refinementError={refinementError}
            onRefine={onRefine}
          />
        )}
        {tab === 'audio' && <AudioTab />}
        {tab === 'image' && (
          <ImageTab coverSet={coverSet} onSetCover={onSetCover} />
        )}
      </div>
      {footer && <div className="shrink-0 border-t border-border bg-card p-4">{footer}</div>}
    </div>
  )
}
