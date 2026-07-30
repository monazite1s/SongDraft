/**
 * 原料区：文本/歌词/指令与录音上传 UI；「精修歌词」经 onRefine 回调触发工作台 SSE。
 * 原始歌词与精修结果分轨：textarea 绑用户原稿；精修版可继续人工编辑，写入 refinedLyrics。
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
  Loader2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { InputKind } from '@/lib/inspire-data'
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

/**
 * 持久化素材资产：上传到 COS 后的可读签名 URL（刷新/切路由不失效）。
 * 与灵感页的 CapturedMedia 不同——这里存的是真实 COS 对象，不走本地 blob。
 */
export interface MaterialAsset {
  url: string
  objectKey: string
  name: string
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
  onRefinedChange,
}: {
  draft: MaterialDraft
  onChange: (next: MaterialDraft) => void
  originalLyrics: string
  refinedLyrics: string | null
  isRefining: boolean
  refinementMessage: string
  refinementError: string
  onRefine: () => void
  /** 精修结果可编辑：人工改写后仍作为生成/落库的优先歌词。 */
  onRefinedChange: (next: string) => void
}) {
  const [view, setView] = useState<'refined' | 'original'>('refined')
  const originalText = originalLyrics || draft.lyrics
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
                type="button"
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
        {view === 'refined' ? (
          <textarea
            rows={8}
            value={refinedLyrics ?? ''}
            placeholder="尚未精修：可先点「精修歌词」，或在此直接编写将用于生成的歌词"
            disabled={isRefining}
            onChange={(event) => onRefinedChange(event.target.value)}
            className="w-full resize-y border-0 bg-transparent px-3 py-2.5 font-sans text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-wait disabled:opacity-70"
          />
        ) : originalText.trim() ? (
          <pre className="whitespace-pre-wrap px-3 py-2.5 font-sans text-sm leading-relaxed text-foreground">
            {originalText}
          </pre>
        ) : (
          <p className="px-3 py-2.5 text-sm text-muted-foreground">暂无原始歌词</p>
        )}
      </div>
    </div>
  )
}

function AudioTab({
  asset,
  onUploadAsset,
  onChange,
}: {
  asset: MaterialAsset | null
  onUploadAsset: (file: File, kind: 'audio' | 'image') => Promise<MaterialAsset>
  onChange: (next: MaterialAsset | null) => void
}) {
  const [mode, setMode] = useState<'record' | 'upload'>('upload')
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0]
    // 允许用户重复选同一文件（change 后清空 value）。
    event.target.value = ''
    if (!next) return
    setIsUploading(true)
    setError('')
    try {
      const uploaded = await onUploadAsset(next, 'audio')
      onChange(uploaded)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '上传失败，请重试')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex rounded-lg border border-border bg-background p-0.5">
        {(['record', 'upload'] as const).map((m) => (
          <button
            key={m}
            type="button"
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
        <label className="flex aspect-[2/1] w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-muted/30 px-4 text-center transition-colors hover:bg-muted/60">
          {isUploading ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="size-5 text-muted-foreground" />
          )}
          <span className="text-sm font-medium text-foreground">
            {isUploading ? '正在上传到对象存储…' : '拖拽或点击上传哼唱'}
          </span>
          <span className="text-xs text-muted-foreground">
            支持 mp3 / wav / m4a，建议 30 秒内
          </span>
          <input
            type="file"
            accept="audio/*"
            className="sr-only"
            disabled={isUploading}
            onChange={onFileChange}
          />
        </label>
      ) : (
        <div className="flex aspect-[2/1] w-full flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted/30 px-4">
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

      {error && (
        <p role="alert" className="text-xs text-destructive">{error}</p>
      )}

      {asset && (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="truncate text-xs font-medium text-foreground">{asset.name}</p>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted"
            >
              <X className="size-3" />
              移除
            </button>
          </div>
          {/* 原生 <audio controls> 直接播放 COS 签名 URL（持久，刷新/切路由不失效）。 */}
          <audio controls src={asset.url} className="w-full" />
        </div>
      )}
    </div>
  )
}

function ImageTab({
  asset,
  coverSet,
  onSetCover,
  onUploadAsset,
  onChange,
}: {
  asset: MaterialAsset | null
  coverSet: boolean
  onSetCover: () => void
  onUploadAsset: (file: File, kind: 'audio' | 'image') => Promise<MaterialAsset>
  onChange: (next: MaterialAsset | null) => void
}) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0]
    event.target.value = ''
    if (!next) return
    setIsUploading(true)
    setError('')
    try {
      const uploaded = await onUploadAsset(next, 'image')
      onChange(uploaded)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '上传失败，请重试')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {asset ? (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="aspect-[2/1] w-full overflow-hidden">
            {/* COS 签名 URL 可直接用原生 <img> 预览（持久，刷新不失效）。 */}
            <img src={asset.url} alt="已上传的参考图像" className="h-full w-full object-cover" />
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border bg-card px-3 py-2">
            <span className="truncate text-xs text-muted-foreground">{asset.name}</span>
            <div className="flex shrink-0 items-center gap-1.5">
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
              <button
                type="button"
                onClick={() => onChange(null)}
                className="flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted"
              >
                <X className="size-3" />
                移除
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <label className="flex aspect-[2/1] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/60">
        {isUploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        {isUploading ? '正在上传到对象存储…' : asset ? '替换图像或视频' : '拖拽或点击上传图像 / 视频'}
        <input type="file" accept="image/*,video/*" className="sr-only" disabled={isUploading} onChange={onFileChange} />
      </label>

      {error && (
        <p role="alert" className="text-xs text-destructive">{error}</p>
      )}
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
  onRefinedChange,
  hummingAsset,
  referenceImage,
  onUploadAsset,
  onHummingChange,
  onImageChange,
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
  onRefinedChange: (next: string) => void
  /** 哼唱素材（COS 签名 URL，持久化）；null 表示未上传或已移除。 */
  hummingAsset: MaterialAsset | null
  /** 参考图像（COS 签名 URL，持久化）；null 表示未上传或已移除。 */
  referenceImage: MaterialAsset | null
  /** 上传编排：workspace 负责 intent → PUT → complete，返回 COS 可读 URL。 */
  onUploadAsset: (file: File, kind: 'audio' | 'image') => Promise<MaterialAsset>
  onHummingChange: (next: MaterialAsset | null) => void
  onImageChange: (next: MaterialAsset | null) => void
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
            onRefinedChange={onRefinedChange}
          />
        )}
        {tab === 'audio' && (
          <AudioTab
            asset={hummingAsset}
            onUploadAsset={onUploadAsset}
            onChange={onHummingChange}
          />
        )}
        {tab === 'image' && (
          <ImageTab
            asset={referenceImage}
            coverSet={coverSet}
            onSetCover={onSetCover}
            onUploadAsset={onUploadAsset}
            onChange={onImageChange}
          />
        )}
      </div>
      {footer && <div className="shrink-0 border-t border-border bg-card p-4">{footer}</div>}
    </div>
  )
}
