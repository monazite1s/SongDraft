/**
 * 成果区（docs/SPEC.md §6.3–§6.5）。
 *
 * 右侧由两个可折叠模块组成：创意简报 + 生成结果（生成计划已按 SPEC 删除）。
 * - 创意简报承载输出类型（必选互斥 Tag）、额外生成要求、生成数量；标题栏仅折叠箭头，
 *   编辑/确认等操作下沉到模块末尾。
 * - 生成成功后自动收起简报、展开结果。
 * - 真实结果用 audioUrl 原生播放，Mock 用波形。
 */
'use client'

import { useState } from 'react'
import {
  Pencil,
  Check,
  Lightbulb,
  TriangleAlert,
  Layers,
  Save,
  Crown,
  GitCompare,
  ChevronDown,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  OUTPUT_TYPES,
  PROVIDERS,
  coverFromTitle,
  type CreativeBrief,
  type DemoCandidate,
  type OutputType,
} from '@/lib/inspire-data'
import { QUANTITIES, type Busy, type Phase } from './action-column'
import { AudioPlayer } from './audio-player'
import { Button } from '@/components/ui/button'
import { Chip, RadioTags } from './ui'

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />
}

const OUTPUT_OPTIONS = OUTPUT_TYPES.map((o) => ({ value: o.id, label: o.label }))

/**
 * 可折叠模块卡片（SPEC §6.3 OutcomeCollapsibleCard）。
 * 整个标题栏可点击切换展开；标题栏右侧只放折叠箭头，编辑/操作下沉到内容末尾。
 */
function CollapsibleCard({
  collapsed,
  onToggle,
  icon,
  title,
  badge,
  summary,
  children,
}: {
  collapsed: boolean
  onToggle: () => void
  icon: React.ReactNode
  title: string
  badge?: React.ReactNode
  summary?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
          <span className="text-brand">{icon}</span>
          <span className="truncate">{title}</span>
          {badge}
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            collapsed && '-rotate-90',
          )}
        />
      </button>
      {collapsed ? (
        summary && (
          <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            {summary}
          </div>
        )
      ) : (
        children
      )}
    </section>
  )
}

function Meta({ label, value, block }: { label: string; value: string; block?: boolean }) {
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

function BriefSection({
  brief,
  collapsed,
  onToggle,
  onBriefChange,
  outputType,
  onOutputChange,
  extraPrompt,
  onExtraPromptChange,
  quantity,
  onQuantityChange,
  onGenerate,
  busy,
  canGenerate,
}: {
  brief: CreativeBrief
  collapsed: boolean
  onToggle: () => void
  /** 把 theme/priority 编辑写回 workspace 的 brief state，保证生成时 PATCH 带上最新值。 */
  onBriefChange: (field: 'theme' | 'priority', value: string) => void
  outputType: OutputType
  onOutputChange: (value: OutputType) => void
  extraPrompt: string
  onExtraPromptChange: (value: string) => void
  quantity: number
  onQuantityChange: (value: number) => void
  onGenerate: () => void
  busy: Busy
  /** 是否满足生成 Demo 的前置条件（真实简报 briefId + 歌词）。P0-2。 */
  canGenerate: boolean
}) {
  const [editing, setEditing] = useState(false)
  // theme/priority 直接以 brief 为唯一数据源（受控），编辑 onChange 即写回 workspace，
  // 不再持有会被丢弃的本地 state。
  const outputName = OUTPUT_TYPES.find((o) => o.id === outputType)!

  return (
    <CollapsibleCard
      collapsed={collapsed}
      onToggle={onToggle}
      icon={<Lightbulb className="size-4" />}
      title="创意简报"
      summary={
        <span className="truncate">
          {outputName.label} · 生成 {quantity} 条 · {brief.theme}
        </span>
      }
    >
      <div className="space-y-3.5 p-4">
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            主题
          </p>
          {editing ? (
            <input
              value={brief.theme}
              onChange={(e) => onBriefChange('theme', e.target.value)}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          ) : (
            <p className="text-sm font-medium text-foreground">{brief.theme}</p>
          )}
        </div>

        {/* 输出类型：必选且互斥的 Tag 单选（SPEC §0 / §6.4）。 */}
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            输出类型
          </p>
          <RadioTags value={outputType} options={OUTPUT_OPTIONS} onChange={onOutputChange} />
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
              value={brief.priority}
              onChange={(e) => onBriefChange('priority', e.target.value)}
              rows={2}
              className="mt-1 w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          ) : (
            <p className="mt-0.5 text-xs text-foreground">{brief.priority}</p>
          )}
        </div>

        {/* 额外生成要求：倒数第二项，默认空，仅作为本次生成补充（SPEC §0 / §6.4）。 */}
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            额外生成要求
          </p>
          <textarea
            value={extraPrompt}
            onChange={(e) => onExtraPromptChange(e.target.value.slice(0, 1000))}
            rows={3}
            maxLength={1000}
            placeholder="补充本次生成的额外要求，例如「副歌再激进一些」「只保留人声与钢琴」（可选）"
            className="w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </div>

        {/* 生成数量：最后一项，1 / 3 / 5 / 10（SPEC §0 / §6.4）。 */}
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            生成数量
          </p>
          <RadioTags
            value={String(quantity)}
            options={QUANTITIES.map((q) => ({ value: String(q), label: String(q) }))}
            onChange={(value) => onQuantityChange(Number(value))}
          />
        </div>
      </div>

      {/* 操作区下沉到模块末尾（SPEC §0）：编辑 + 生成。 */}
      <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? <Check className="size-3.5" /> : <Pencil className="size-3.5" />}
          {editing ? '完成' : '编辑'}
        </Button>
        <Button type="button" size="sm" onClick={onGenerate} disabled={!!busy || !canGenerate} title={canGenerate ? undefined : '请先生成简报并确认歌词'}>
          <Sparkles className="size-3.5" />
          {busy === 'generate' ? '生成中…' : '生成'}
        </Button>
      </div>
    </CollapsibleCard>
  )
}

/**
 * 封面占位（诚实展示）。MiniMax 不返回封面，用标题首字母 + id hash 色块代替假图。
 */
function CoverPlaceholder({
  title,
  id,
  className,
  letterClassName,
}: {
  title: string
  id: string
  className?: string
  letterClassName?: string
}) {
  const { letter, colorClass } = coverFromTitle(title, id)
  return (
    <div className={cn('flex items-center justify-center bg-muted', className)}>
      <div className={cn('flex size-full items-center justify-center text-white', colorClass)}>
        <span className={cn('font-semibold leading-none', letterClassName)}>{letter}</span>
      </div>
    </div>
  )
}

/**
 * 极简候选卡片（任务5）：仅封面占位 / 标题 / 主版本标记 / 时长 / 真实模拟标识。
 * 移除播放进度条、波形、内联播放控件、BPM/调性、创作说明、设为主版本/重生成按钮。
 * 整张卡片为「入口」：点击打开右侧详情栏（SongDetailSheet）承载播放/歌词/全屏。
 * 选择复选框保留，服务于底部批量「保存为版本」（与播放控件无关）。
 */
function CandidateCard({
  c,
  isMain,
  saved,
  selected,
  onToggleSelected,
  onOpenDetail,
}: {
  c: DemoCandidate
  isMain: boolean
  saved: boolean
  selected: boolean
  onToggleSelected: () => void
  onOpenDetail: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenDetail}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpenDetail()
        }
      }}
      title="查看详情"
      className={cn(
        'group flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors',
        selected
          ? 'border-brand/60 ring-1 ring-brand/20'
          : isMain
            ? 'border-brand/40 ring-1 ring-brand/20 hover:border-brand/60'
            : 'border-border hover:border-brand/40',
      )}
    >
      {/* 封面占位：标题首字母 + hash 色块（诚实展示，无假封面图） */}
      <CoverPlaceholder
        title={c.title}
        id={c.id}
        className="size-12 shrink-0 overflow-hidden rounded-lg border border-border"
        letterClassName="text-lg"
      />

      <div className="min-w-0 flex-1">
        {/* 标题 + 主版本标记 */}
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{c.title}</span>
          {isMain && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-muted px-1.5 py-0.5 text-[10px] font-medium text-brand">
              <Crown className="size-2.5" />
              主版本
            </span>
          )}
        </div>
        {/* 时长 + 保存状态 */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">{c.duration}</span>
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[11px] font-medium',
              saved ? 'bg-success/10 text-success-foreground' : 'bg-warning/10 text-warning-foreground',
            )}
          >
            {saved ? '已保存' : '未保存'}
          </span>
        </div>
      </div>

      {/* 批量选择复选框：stopPropagation 避免触发展开详情 */}
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={selected ? '取消选择该候选' : '选择该候选'}
        onClick={(e) => {
          e.stopPropagation()
          onToggleSelected()
        }}
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
          selected
            ? 'border-brand bg-brand text-brand-foreground'
            : 'border-border bg-background hover:bg-muted',
        )}
      >
        {selected && <Check className="size-3" />}
      </button>
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
      <CoverPlaceholder
        title={c.title}
        id={c.id}
        className="aspect-square w-full overflow-hidden rounded-lg border border-border"
        letterClassName="text-3xl"
      />
      <h4 className="mt-2 truncate text-xs font-medium text-foreground">
        {c.title}
      </h4>
      <dl className="mt-2 space-y-1 text-[11px]">
        {[
          ['类型', output.label],
          ['时长', c.duration],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-2">
        {c.audioUrl ? <audio controls preload="metadata" src={c.audioUrl} className="h-9 w-full" aria-label={`${c.title} 播放器`} /> : <AudioPlayer durationLabel={c.duration} seed={c.id.charCodeAt(1)} bars={20} />}
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

function ResultsSection({
  busy,
  quantity,
  candidates,
  savedCandidateIds,
  mainId,
  onSetMain,
  onOpenDetail,
  onSaveVersion,
  selectedIds,
  onSelectedIdsChange,
}: {
  busy: Busy
  quantity: number
  candidates: DemoCandidate[]
  savedCandidateIds: string[]
  mainId: string
  onSetMain: (id: string) => void
  onOpenDetail: (id: string) => void
  onSaveVersion: (candidateIds: string[]) => void
  /** 选中的候选 id（由 workspace 提升，切换 tab/折叠不丢失）。 */
  selectedIds: string[]
  onSelectedIdsChange: (ids: string[]) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [compare, setCompare] = useState(false)

  function toggleSelected(id: string) {
    onSelectedIdsChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id])
  }
  const selectable = candidates.filter((c) => !savedCandidateIds.includes(c.id))
  const selectedCount = selectable.filter((c) => selectedIds.includes(c.id)).length

  return (
    <CollapsibleCard
      collapsed={collapsed}
      onToggle={() => setCollapsed((v) => !v)}
      icon={<Layers className="size-4" />}
      title="生成结果"
      badge={
        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground">
          {candidates.length} 条
        </span>
      }
    >
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            基于创意简报生成，可对比后设为主版本
          </p>
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
                saved={savedCandidateIds.includes(c.id)}
                selected={selectedIds.includes(c.id)}
                onToggleSelected={() => toggleSelected(c.id)}
                onOpenDetail={() => onOpenDetail(c.id)}
              />
            ))}
          </div>
        )}

        {/* 批量保存底栏：选中候选作为同一父节点下的兄弟版本（SPEC §6.5）。 */}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              已选择 <span className="font-medium text-foreground">{selectedCount}</span> 条
            </span>
            {selectedCount > 0 && (
              <button
                type="button"
                onClick={() => onSelectedIdsChange([])}
                className="rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                清空
              </button>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            disabled={selectedCount === 0}
            onClick={() => {
              const ids = selectable.filter((c) => selectedIds.includes(c.id)).map((c) => c.id)
              onSaveVersion(ids)
              onSelectedIdsChange([])
            }}
          >
            <Save className="size-3.5" />
            保存为版本
          </Button>
        </div>
      </div>
    </CollapsibleCard>
  )
}

export function BriefPanel({
  phase,
  busy,
  brief,
  onBriefChange,
  outputType,
  onOutputChange,
  extraPrompt,
  onExtraPromptChange,
  quantity,
  onQuantityChange,
  onGenerate,
  candidates,
  savedCandidateIds,
  mainId,
  onSetMain,
  onOpenDetail,
  onSaveVersion,
  canGenerate,
  selectedIds,
  onSelectedIdsChange,
}: {
  phase: Phase
  busy: Busy
  brief: CreativeBrief
  /** 把 theme/priority 编辑写回 workspace 的 brief state。 */
  onBriefChange: (field: 'theme' | 'priority', value: string) => void
  outputType: OutputType
  onOutputChange: (value: OutputType) => void
  extraPrompt: string
  onExtraPromptChange: (value: string) => void
  quantity: number
  onQuantityChange: (value: number) => void
  onGenerate: () => void
  candidates: DemoCandidate[]
  savedCandidateIds: string[]
  mainId: string
  onSetMain: (id: string) => void
  onOpenDetail: (id: string) => void
  onSaveVersion: (candidateIds: string[]) => void
  /** 是否满足生成 Demo 的前置条件（真实简报 briefId + 歌词）。P0-2。 */
  canGenerate: boolean
  /** 选中的候选 id（由 workspace 提升，切换 tab/折叠不丢失）。 */
  selectedIds: string[]
  onSelectedIdsChange: (ids: string[]) => void
}) {
  const [briefCollapsed, setBriefCollapsed] = useState(false)
  const resultsReady = phase === 'results'
  const [prevResultsReady, setPrevResultsReady] = useState(resultsReady)

  // 生成成功后自动收起创意简报（SPEC §0），用户仍可手动展开。
  // 采用「渲染期间调整 state」替代 effect，避免级联渲染（react-hooks/set-state-in-effect）。
  if (resultsReady !== prevResultsReady) {
    setPrevResultsReady(resultsReady)
    if (resultsReady) setBriefCollapsed(true)
  }

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
          在左侧构建歌词、哼唱或图像素材，点击底部「生成简报」后，这里会生成结构化创意简报。
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
      <BriefSection
        brief={brief}
        collapsed={briefCollapsed}
        onToggle={() => setBriefCollapsed((v) => !v)}
        onBriefChange={onBriefChange}
        outputType={outputType}
        onOutputChange={onOutputChange}
        extraPrompt={extraPrompt}
        onExtraPromptChange={onExtraPromptChange}
        quantity={quantity}
        onQuantityChange={onQuantityChange}
        onGenerate={onGenerate}
        busy={busy}
        canGenerate={canGenerate}
      />
      {resultsReady && (
        <ResultsSection
          busy={busy}
          quantity={quantity}
          candidates={candidates}
          savedCandidateIds={savedCandidateIds}
          mainId={mainId}
          onSetMain={onSetMain}
          onOpenDetail={onOpenDetail}
          onSaveVersion={onSaveVersion}
          selectedIds={selectedIds}
          onSelectedIdsChange={onSelectedIdsChange}
        />
      )}
    </div>
  )
}
