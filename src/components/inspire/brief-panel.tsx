'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  Pencil,
  Check,
  Lightbulb,
  ListChecks,
  TriangleAlert,
  Layers,
  Save,
  RefreshCw,
  Crown,
  GitCompare,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  OUTPUT_TYPES,
  PROVIDERS,
  type CreativeBrief,
  type DemoCandidate,
  type Provider,
} from '@/lib/inspire-data'
import type { Busy, Phase } from './action-column'
import { AudioPlayer } from './audio-player'
import { Chip, ModeTag, SectionCard } from './ui'

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />
}

function BriefCard({ brief }: { brief: CreativeBrief }) {
  const [editing, setEditing] = useState(false)
  const [theme, setTheme] = useState(brief.theme)
  const [priority, setPriority] = useState(brief.priority)

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-1.5">
          <Lightbulb className="size-4 text-brand" />
          创意简报
        </span>
      }
      action={
        <button
          onClick={() => setEditing((v) => !v)}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {editing ? (
            <>
              <Check className="size-3.5" />
              完成
            </>
          ) : (
            <>
              <Pencil className="size-3.5" />
              编辑
            </>
          )}
        </button>
      }
    >
      <div className="space-y-3.5 p-4">
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            主题
          </p>
          {editing ? (
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          ) : (
            <p className="text-sm font-medium text-foreground">{theme}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Meta label="风格" value={brief.genre} />
          <Meta label="速度" value={brief.tempo} />
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            情绪
          </p>
          <div className="flex flex-wrap gap-1.5">
            {brief.mood.map((m) => (
              <Chip key={m}>{m}</Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            乐器
          </p>
          <div className="flex flex-wrap gap-1.5">
            {brief.instruments.map((m) => (
              <Chip key={m}>{m}</Chip>
            ))}
          </div>
        </div>

        <Meta label="歌词概要" value={brief.lyricSummary} block />
        <Meta label="旋律特征" value={brief.melodyFeatures} block />
        <Meta label="视觉参考" value={brief.visualReferences} block />

        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            证据来源
          </p>
          <ul className="space-y-1.5">
            {brief.evidence.map((e, i) => (
              <li key={i} className="flex gap-2 text-xs">
                <span className="mt-px inline-flex shrink-0 rounded bg-secondary px-1.5 py-0.5 font-medium text-secondary-foreground">
                  {e.source}
                </span>
                <span className="text-muted-foreground">{e.detail}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-warning/25 bg-warning/5 p-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-warning-foreground">
            <TriangleAlert className="size-3.5" />
            冲突与取舍
          </p>
          {brief.conflicts.map((c, i) => (
            <p key={i} className="mt-1 text-xs text-foreground">
              {c}
            </p>
          ))}
          <p className="mt-2 text-[11px] text-muted-foreground">优先策略</p>
          {editing ? (
            <textarea
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              rows={2}
              className="mt-1 w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          ) : (
            <p className="mt-0.5 text-xs text-foreground">{priority}</p>
          )}
        </div>
      </div>
    </SectionCard>
  )
}

function Meta({
  label,
  value,
  block,
}: {
  label: string
  value: string
  block?: boolean
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn('text-foreground', block ? 'text-sm leading-relaxed' : 'text-sm font-medium')}>
        {value}
      </p>
    </div>
  )
}

function PlanCard({
  provider,
  quantity,
}: {
  provider: Provider
  quantity: number
}) {
  const steps = [
    { label: '素材解析', detail: '解析歌词语义、旋律轮廓与画面情绪', mode: 'real' as const },
    { label: '简报合成', detail: '融合多模态证据生成结构化简报', mode: 'real' as const },
    {
      label: `Demo 生成 ×${quantity}`,
      detail: '保留哼唱副歌动机作为主旋律种子',
      mode: provider.mode,
    },
  ]
  return (
    <SectionCard
      title={
        <span className="flex items-center gap-1.5">
          <ListChecks className="size-4 text-brand" />
          生成计划
        </span>
      }
      action={<span className="text-xs text-muted-foreground">{provider.name}</span>}
    >
      <div className="p-4">
        <ol className="relative space-y-3 border-l border-border pl-4">
          {steps.map((s, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[21px] top-1 size-2 rounded-full bg-brand ring-4 ring-background" />
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {s.label}
                </span>
                <ModeTag mode={s.mode} />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.detail}</p>
            </li>
          ))}
        </ol>

        <div className="mt-4 grid gap-2 text-xs">
          <div className="flex justify-between rounded-md bg-muted/50 px-2.5 py-1.5">
            <span className="text-muted-foreground">预计耗时</span>
            <span className="text-foreground">{provider.latency}</span>
          </div>
          <div className="rounded-md border border-border p-2.5">
            <p className="font-medium text-foreground">限制与回退</p>
            <p className="mt-1 text-muted-foreground">
              视频输入需先抽帧；若供应商超时，将自动回退至 Cadence Sketch 生成旋律草图。
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-brand-muted/40 p-2.5">
          <Layers className="mt-px size-4 shrink-0 text-brand" />
          <p className="text-[11px] leading-relaxed text-foreground">
            标注为「真实生成」的步骤会调用供应商 API；「模拟输出」步骤为本地占位，仅用于流程演示，结果不代表真实音质。
          </p>
        </div>
      </div>
    </SectionCard>
  )
}

function CandidateCard({
  c,
  isMain,
  onSetMain,
}: {
  c: DemoCandidate
  isMain: boolean
  onSetMain: () => void
}) {
  const provider = PROVIDERS.find((p) => p.id === c.providerId)!
  const output = OUTPUT_TYPES.find((o) => o.id === c.outputType)!
  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-3 transition-colors',
        isMain ? 'border-brand/40 ring-1 ring-brand/20' : 'border-border',
      )}
    >
      <div className="flex gap-3">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-border">
          <Image src={c.cover} alt={c.title} fill className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="truncate text-sm font-medium text-foreground">
              {c.title}
            </h4>
            {isMain && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-muted px-1.5 py-0.5 text-[11px] font-medium text-brand">
                <Crown className="size-3" />
                主版本
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground">
              {output.label}
            </span>
            <ModeTag mode={c.mode} />
            <span className="text-[11px] text-muted-foreground">
              {provider.name}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {c.bpm} BPM · {c.key} · {c.duration}
          </p>
        </div>
      </div>

      <p className="mt-2.5 text-xs text-muted-foreground">{c.descriptor}</p>

      <div className="mt-3">
        <AudioPlayer durationLabel={c.duration} seed={c.id.charCodeAt(1)} bars={40} />
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={onSetMain}
          disabled={isMain}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors',
            isMain
              ? 'cursor-default bg-muted text-muted-foreground'
              : 'bg-primary text-primary-foreground hover:bg-primary/90',
          )}
        >
          <Crown className="size-3.5" />
          {isMain ? '当前主版本' : '设为主版本'}
        </button>
        <button className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted">
          <RefreshCw className="size-3.5" />
          从此版本重生成
        </button>
      </div>
    </div>
  )
}

export function BriefPanel({
  phase,
  busy,
  brief,
  provider,
  quantity,
  candidates,
  mainId,
  onSetMain,
  onSaveVersion,
}: {
  phase: Phase
  busy: Busy
  brief: CreativeBrief
  provider: Provider
  quantity: number
  candidates: DemoCandidate[]
  mainId: string
  onSetMain: (id: string) => void
  onSaveVersion: () => void
}) {
  const [compare, setCompare] = useState(false)

  if (phase === 'idle' && busy !== 'analyze') {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Lightbulb className="size-5 text-muted-foreground" />
        </div>
        <h3 className="mt-3 text-sm font-medium text-foreground">
          尚未生成创意简报
        </h3>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
          在左侧构建歌词、哼唱或图像素材，点击「解析素材」后，这里会生成结构化的创意简报与生成计划。
        </p>
      </div>
    )
  }

  if (busy === 'analyze') {
    return (
      <div className="space-y-4 p-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-4/5" />
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="mt-4 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-2/3" />
        </div>
        <p className="text-center text-xs text-muted-foreground">
          正在融合多模态证据，生成创意简报…
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      {phase !== 'results' && (
        <>
          <BriefCard brief={brief} />
          <PlanCard provider={provider} quantity={quantity} />
        </>
      )}

      {phase === 'results' && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Demo 候选 · {candidates.length} 条
              </h3>
              <p className="text-[11px] text-muted-foreground">
                基于创意简报生成，可对比后设为主版本
              </p>
            </div>
            <button
              onClick={() => setCompare((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                compare
                  ? 'border-brand/30 bg-brand-muted text-brand'
                  : 'border-border bg-background text-foreground hover:bg-muted',
              )}
            >
              <GitCompare className="size-3.5" />
              A/B 对比
            </button>
          </div>

          {busy === 'generate' ? (
            <div className="grid gap-3">
              {Array.from({ length: Math.min(quantity, 3) }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex gap-3">
                    <Skeleton className="size-16 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                  <Skeleton className="mt-3 h-9 w-full" />
                </div>
              ))}
            </div>
          ) : compare ? (
            <div className="grid grid-cols-2 gap-3">
              {candidates.slice(0, 2).map((c) => (
                <CompareColumn
                  key={c.id}
                  c={c}
                  isMain={c.id === mainId}
                  onSetMain={() => onSetMain(c.id)}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-3">
              {candidates.map((c) => (
                <CandidateCard
                  key={c.id}
                  c={c}
                  isMain={c.id === mainId}
                  onSetMain={() => onSetMain(c.id)}
                />
              ))}
            </div>
          )}

          <button
            onClick={onSaveVersion}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Save className="size-4" />
            保存为新版本
          </button>
        </>
      )}
    </div>
  )
}

function CompareColumn({
  c,
  isMain,
  onSetMain,
}: {
  c: DemoCandidate
  isMain: boolean
  onSetMain: () => void
}) {
  const output = OUTPUT_TYPES.find((o) => o.id === c.outputType)!
  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border bg-card p-2.5',
        isMain ? 'border-brand/40 ring-1 ring-brand/20' : 'border-border',
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border">
        <Image src={c.cover} alt={c.title} fill className="object-cover" />
      </div>
      <h4 className="mt-2 truncate text-xs font-medium text-foreground">
        {c.title}
      </h4>
      <div className="mt-1 flex items-center gap-1">
        <ModeTag mode={c.mode} />
      </div>
      <dl className="mt-2 space-y-1 text-[11px]">
        {[
          ['类型', output.label],
          ['BPM', String(c.bpm)],
          ['调性', c.key],
          ['时长', c.duration],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-2">
        <AudioPlayer durationLabel={c.duration} seed={c.id.charCodeAt(1)} bars={20} />
      </div>
      <button
        onClick={onSetMain}
        disabled={isMain}
        className={cn(
          'mt-2 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors',
          isMain
            ? 'cursor-default bg-muted text-muted-foreground'
            : 'bg-primary text-primary-foreground hover:bg-primary/90',
        )}
      >
        <Crown className="size-3" />
        {isMain ? '主版本' : '设为主版本'}
      </button>
    </div>
  )
}
