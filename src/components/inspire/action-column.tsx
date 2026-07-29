'use client'

import {
  ArrowRight,
  FileText,
  AudioLines,
  ImageIcon,
  Loader2,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  OUTPUT_TYPES,
  type InputKind,
  type OutputType,
  type Provider,
} from '@/lib/inspire-data'

export type Phase = 'idle' | 'brief' | 'results'
export type Busy = false | 'analyze' | 'generate'

const INPUT_META: Record<InputKind, { label: string; icon: typeof FileText }> = {
  text: { label: '歌词/文本', icon: FileText },
  audio: { label: '哼唱/音频', icon: AudioLines },
  image: { label: '图像', icon: ImageIcon },
  video: { label: '视频', icon: ImageIcon },
}

const QUANTITIES = [1, 3, 5, 10]

function buttonLabel(phase: Phase, busy: Busy) {
  if (busy === 'analyze') return '正在解析素材…'
  if (busy === 'generate') return '正在生成候选…'
  if (phase === 'idle') return '解析素材'
  if (phase === 'brief') return '生成 Demo'
  return '从当前版本重生成'
}

export function ActionColumn({
  phase,
  busy,
  onPrimary,
  quantity,
  onQuantityChange,
  selectedInputs,
  outputType,
  provider,
}: {
  phase: Phase
  busy: Busy
  onPrimary: () => void
  quantity: number
  onQuantityChange: (n: number) => void
  selectedInputs: InputKind[]
  outputType: OutputType
  provider: Provider
}) {
  const unsupported = selectedInputs.filter((i) => !provider.supports.includes(i))
  const outputName = OUTPUT_TYPES.find((o) => o.id === outputType)!

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-4 py-6">
      {/* flow cue */}
      <div className="flex w-full items-center justify-center gap-2 text-[11px] text-muted-foreground">
        <span className="rounded-md bg-muted px-2 py-1">素材</span>
        <ArrowRight className="size-3" />
        <span className="rounded-md bg-brand-muted px-2 py-1 font-medium text-brand">
          生成
        </span>
        <ArrowRight className="size-3" />
        <span className="rounded-md bg-muted px-2 py-1">结果</span>
      </div>

      {/* summary */}
      <div className="w-full rounded-xl border border-border bg-card p-3">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          本次生成
        </p>
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {selectedInputs.length === 0 && (
            <span className="text-xs text-muted-foreground">未选择素材</span>
          )}
          {selectedInputs.map((i) => {
            const M = INPUT_META[i]
            return (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-1 text-[11px] text-foreground"
              >
                <M.icon className="size-3" />
                {M.label}
              </span>
            )
          })}
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2 text-xs">
          <span className="text-muted-foreground">输出类型</span>
          <span className="font-medium text-foreground">{outputName.label}</span>
        </div>
      </div>

      {/* primary button */}
      <button
        onClick={onPrimary}
        disabled={!!busy || selectedInputs.length === 0}
        className={cn(
          'group relative flex w-full flex-col items-center justify-center gap-1 rounded-2xl bg-primary px-4 py-6 text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60',
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-primary-foreground/10 transition-transform group-hover:scale-105">
          {busy ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Sparkles className="size-5" />
          )}
        </span>
        <span className="mt-1 text-sm font-semibold">
          {buttonLabel(phase, busy)}
        </span>
        <span className="text-[11px] text-primary-foreground/70">
          {phase === 'idle'
            ? '解析已选素材并生成结构化简报'
            : phase === 'brief'
              ? `将生成 ${quantity} 条 ${outputName.label} 候选`
              : '基于当前版本参数重新生成候选'}
        </span>
      </button>

      {/* quantity selector */}
      <div className="w-full">
        <p className="mb-1.5 text-xs text-muted-foreground">生成数量</p>
        <div className="flex rounded-lg border border-border bg-background p-0.5">
          {QUANTITIES.map((q) => (
            <button
              key={q}
              onClick={() => onQuantityChange(q)}
              className={cn(
                'flex-1 rounded-md py-1.5 text-sm transition-colors',
                quantity === q
                  ? 'bg-secondary font-semibold text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* provider + warning */}
      <div className="w-full rounded-lg bg-muted/50 px-3 py-2 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">供应商</span>
          <span className="font-medium text-foreground">{provider.name}</span>
        </div>
        {unsupported.length > 0 && (
          <p className="mt-1.5 flex items-start gap-1 text-warning-foreground">
            <TriangleAlert className="mt-px size-3 shrink-0" />
            当前供应商不支持部分素材，生成时将自动忽略。
          </p>
        )}
      </div>
    </div>
  )
}
