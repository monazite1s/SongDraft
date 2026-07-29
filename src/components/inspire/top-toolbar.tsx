'use client'

import { useState } from 'react'
import {
  Check,
  ChevronDown,
  Cloud,
  GitBranch,
  MoreHorizontal,
  Share2,
  TriangleAlert,
  Copy,
  Download,
  Trash2,
  History,
  LoaderCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  OUTPUT_TYPES,
  PROVIDERS,
  type InputKind,
  type OutputType,
  type Provider,
} from '@/lib/inspire-data'
import { ModeTag, StatusDot } from './ui'

const INPUT_LABELS: Record<InputKind, string> = {
  text: '歌词/文本',
  audio: '哼唱/音频',
  image: '图像',
  video: '视频',
}

function Popover({
  open,
  onClose,
  children,
  align = 'start',
  className,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  align?: 'start' | 'end'
  className?: string
}) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div
        className={cn(
          'absolute top-[calc(100%+6px)] z-50 rounded-xl border border-border bg-popover p-1.5 shadow-lg shadow-black/5',
          align === 'end' ? 'right-0' : 'left-0',
          className,
        )}
      >
        {children}
      </div>
    </>
  )
}

export function TopToolbar({
  provider,
  onProviderChange,
  outputType,
  onOutputChange,
  selectedInputs,
  projectTitle,
  saveState,
  onSave,
  currentVersion,
  onOpenVersions,
  onOpenShare,
  onManageProviders,
}: {
  provider: Provider
  onProviderChange: (p: Provider) => void
  outputType: OutputType
  onOutputChange: (o: OutputType) => void
  selectedInputs: InputKind[]
  projectTitle: string
  saveState: 'dirty' | 'saving' | 'saved' | 'error'
  onSave: () => void
  currentVersion: string
  onOpenVersions: () => void
  onOpenShare: () => void
  onManageProviders: () => void
}) {
  const [providerOpen, setProviderOpen] = useState(false)
  const [outputOpen, setOutputOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const unsupported = selectedInputs.filter((i) => !provider.supports.includes(i))
  const outputName = OUTPUT_TYPES.find((o) => o.id === outputType)!

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="size-2 rounded-sm bg-brand" aria-hidden />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold text-foreground">
              {projectTitle}
            </h1>
            <button
              type="button"
              onClick={onSave}
              disabled={saveState === 'saving'}
              className="hidden items-center gap-1 rounded px-1 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-wait sm:inline-flex"
            >
              {saveState === 'saving' ? <LoaderCircle className="size-3.5 animate-spin" /> : <Cloud className="size-3.5" />}
              {saveState === 'saved' ? '已保存' : saveState === 'saving' ? '保存中' : saveState === 'error' ? '重试保存' : '保存'}
            </button>
          </div>
          <p className="truncate text-[11px] text-muted-foreground">
            灵感项目 · {saveState === 'saved' ? '刚刚保存' : '正在编辑'}
          </p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* provider selector */}
        <div className="relative hidden sm:block">
          <button
            onClick={() => setProviderOpen((v) => !v)}
            aria-expanded={providerOpen}
            className="flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <StatusDot status={provider.status} />
            <span className="max-w-32 truncate">{provider.name}</span>
            {unsupported.length > 0 && (
              <TriangleAlert className="size-3.5 text-warning" />
            )}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>
          <Popover
            open={providerOpen}
            onClose={() => setProviderOpen(false)}
            className="w-80"
          >
            <p className="px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              生成供应商
            </p>
            {PROVIDERS.map((p) => {
              const miss = selectedInputs.filter((i) => !p.supports.includes(i))
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    onProviderChange(p)
                    setProviderOpen(false)
                  }}
                  className="flex w-full items-start gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-muted"
                >
                  <span className="mt-0.5">
                    <StatusDot status={p.status} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {p.name}
                      </span>
                      <ModeTag mode={p.mode} />
                      {p.id === provider.id && (
                        <Check className="ml-auto size-4 text-brand" />
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {p.note}
                    </span>
                    {miss.length > 0 && (
                      <span className="mt-1 flex items-center gap-1 text-[11px] text-warning-foreground">
                        <TriangleAlert className="size-3" />
                        不支持：{miss.map((m) => INPUT_LABELS[m]).join('、')}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
            <div className="mt-1 border-t border-border pt-1">
              <button
                onClick={() => {
                  setProviderOpen(false)
                  onManageProviders()
                }}
                className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-brand hover:bg-muted"
              >
                管理供应商与能力…
              </button>
            </div>
          </Popover>
        </div>

        {/* output type selector */}
        <div className="relative">
          <button
            onClick={() => setOutputOpen((v) => !v)}
            aria-expanded={outputOpen}
            className="flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <span className="max-w-28 truncate">{outputName.label}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>
          <Popover
            open={outputOpen}
            onClose={() => setOutputOpen(false)}
            align="end"
            className="w-64"
          >
            {OUTPUT_TYPES.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  onOutputChange(o.id)
                  setOutputOpen(false)
                }}
                className="flex w-full items-start gap-2 rounded-lg p-2 text-left transition-colors hover:bg-muted"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-foreground">
                    {o.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {o.hint}
                  </span>
                </span>
                {o.id === outputType && <Check className="size-4 text-brand" />}
              </button>
            ))}
          </Popover>
        </div>

        {/* version indicator */}
        <button
          onClick={onOpenVersions}
          className="hidden h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground transition-colors hover:bg-muted md:flex"
        >
          <GitBranch className="size-3.5 text-muted-foreground" />
          {currentVersion}
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={saveState === 'saving'}
          aria-label={saveState === 'saved' ? '已保存' : '保存'}
          className="flex size-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-wait sm:hidden"
        >
          {saveState === 'saving' ? <LoaderCircle className="size-3.5 animate-spin" /> : <Cloud className="size-3.5" />}
        </button>

        <div className="mx-0.5 hidden h-5 w-px bg-border sm:block" />

        <button
          onClick={onOpenShare}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Share2 className="size-3.5" />
          分享
        </button>

        <div className="relative">
          <button
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            aria-label="更多操作"
            className="flex size-8 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted"
          >
            <MoreHorizontal className="size-4" />
          </button>
          <Popover
            open={moreOpen}
            onClose={() => setMoreOpen(false)}
            align="end"
            className="w-52"
          >
            {[
              { icon: History, label: '版本历史', onClick: onOpenVersions },
              { icon: Copy, label: '复制为新项目' },
              { icon: Download, label: '导出简报 (PDF)' },
            ].map((m) => (
              <button
                key={m.label}
                onClick={() => {
                  setMoreOpen(false)
                  m.onClick?.()
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
              >
                <m.icon className="size-4 text-muted-foreground" />
                {m.label}
              </button>
            ))}
            <div className="mt-1 border-t border-border pt-1">
              <button className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm text-destructive transition-colors hover:bg-destructive/10">
                <Trash2 className="size-4" />
                删除项目
              </button>
            </div>
          </Popover>
        </div>
      </div>
    </header>
  )
}
