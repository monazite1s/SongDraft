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
  RefreshCw,
  Check,
  ImageDown,
} from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { InputKind } from '@/lib/inspire-data'
import { AudioPlayer } from './audio-player'
import { Field } from './ui'

type Tab = InputKind extends never ? never : 'text' | 'audio' | 'image'

const TABS: { id: Tab; label: string; icon: typeof FileText; kind: InputKind }[] = [
  { id: 'text', label: '歌词 / 文本', icon: FileText, kind: 'text' },
  { id: 'audio', label: '哼唱 / 音频', icon: AudioLines, kind: 'audio' },
  { id: 'image', label: '图像 / 视频', icon: ImageIcon, kind: 'image' },
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
}: {
  draft: MaterialDraft
  onChange: (next: MaterialDraft) => void
}) {
  const [refined] = useState(true)
  const [view, setView] = useState<'refined' | 'original'>('refined')
  return (
    <div className="space-y-4">
      <Field label="创作提示" hint="用于引导精修方向">
        <input
          className={inputBase}
          value={draft.creativePrompt}
          onChange={(event) => onChange({ ...draft, creativePrompt: event.target.value })}
        />
      </Field>
      <Field label="原始歌词 / 文本">
        <textarea
          rows={5}
          className={cn(inputBase, 'resize-none leading-relaxed')}
          value={draft.lyrics}
          onChange={(event) => onChange({ ...draft, lyrics: event.target.value })}
        />
      </Field>
      <Field label="处理指令" hint="可选">
        <input
          className={inputBase}
          value={draft.instruction}
          onChange={(event) => onChange({ ...draft, instruction: event.target.value })}
        />
      </Field>

      <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
        <Sparkles className="size-4 text-brand" />
        精修歌词
      </button>

      {refined && (
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
          <pre className="whitespace-pre-wrap px-3 py-2.5 font-sans text-sm leading-relaxed text-foreground">
            {view === 'refined'
              ? `路灯把影子拉得好长\n我数着水洼里碎的光\n没人追问我去向何方\n就走到天亮\n\n（副歌）\n把夜色都留在身后吧\n剩下的路 我陪我自己走`
              : draft.lyrics}
          </pre>
        </div>
      )}
    </div>
  )
}

function AudioTab() {
  const [mode, setMode] = useState<'record' | 'upload'>('upload')
  const [analyzed, setAnalyzed] = useState(true)
  return (
    <div className="space-y-4">
      <Field label="旋律分析提示">
        <input className={inputBase} defaultValue="识别副歌动机与情绪抬升点" />
      </Field>

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
        </label>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-6">
          <button className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20">
            <Circle className="size-5 fill-current" />
          </button>
          <span className="text-xs text-muted-foreground">点击开始录制</span>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Square className="size-3" />
            00:00
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-3">
        <p className="mb-2 text-xs font-medium text-foreground">
          humming_v2.m4a · 0:28
        </p>
        <AudioPlayer durationLabel="0:28" seed={3} bars={44} />
      </div>

      <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
        <Sparkles className="size-4 text-brand" />
        分析旋律
      </button>

      {analyzed && (
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="mb-2.5 text-xs font-medium text-foreground">旋律分析结果</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
            {[
              ['时长', '0:28'],
              ['估算 BPM', '84'],
              ['音域', 'G3 – D5'],
              ['旋律轮廓', '级进为主，副歌上行'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="mt-0.5 font-medium text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 border-t border-border pt-2.5">
            <p className="text-muted-foreground">重复片段</p>
            <p className="mt-1 text-foreground">
              第 12–16 秒动机重复 3 次，可作为副歌 hook。
            </p>
          </div>
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
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="relative aspect-video w-full">
          <Image
            src="/covers/ref-street.png"
            alt="上传的参考图像：雨夜城市街道"
            fill
            className="object-cover"
          />
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border bg-card px-3 py-2">
          <span className="truncate text-xs text-muted-foreground">
            reference_rainy_street.jpg
          </span>
          <button
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

      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/60">
        <Upload className="size-4" />
        添加更多图像或视频
      </label>

      <Field label="视觉分析提示">
        <input className={inputBase} defaultValue="提取情绪、色调与可用作歌词的意象" />
      </Field>

      <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
        <Sparkles className="size-4 text-brand" />
        分析画面
      </button>

      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="mb-2.5 text-xs font-medium text-foreground">画面分析结果</p>
        <dl className="space-y-2.5 text-xs">
          {[
            ['主体', '独行的人 / 空街'],
            ['场景', '深夜城市、雨后湿滑路面'],
            ['情绪', '安静、孤独、带一点温度'],
            ['建议风格', 'Dream Pop / Indie'],
            ['建议乐器', '电钢 · 合成 Pad · 拨弦'],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-3">
              <dt className="w-16 shrink-0 text-muted-foreground">{k}</dt>
              <dd className="font-medium text-foreground">{v}</dd>
            </div>
          ))}
          <div className="flex gap-3">
            <dt className="w-16 shrink-0 text-muted-foreground">配色</dt>
            <dd className="flex items-center gap-1.5">
              {['#1c2530', '#2f4256', '#c9743a', '#e8dfd2'].map((c) => (
                <span
                  key={c}
                  className="size-4 rounded-sm border border-border"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-16 shrink-0 text-muted-foreground">意象</dt>
            <dd className="font-medium text-foreground">
              路灯、水洼倒影、暖色店招
            </dd>
          </div>
        </dl>
      </div>
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
}: {
  selectedInputs: InputKind[]
  onToggleInput: (k: InputKind) => void
  coverSet: boolean
  onSetCover: () => void
  draft: MaterialDraft
  onDraftChange: (next: MaterialDraft) => void
}) {
  const [tab, setTab] = useState<Tab>('text')

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="text-sm font-semibold text-foreground">素材构建</h2>
        <span className="text-[11px] text-muted-foreground">
          已选 {selectedInputs.length} / 3 类素材
        </span>
      </div>

      <div className="flex gap-1 px-3">
        {TABS.map((t) => {
          const active = tab === t.id
          const included = selectedInputs.includes(t.kind)
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
                active
                  ? 'border-border bg-card text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)]'
                  : 'border-transparent text-muted-foreground hover:bg-muted',
              )}
            >
              <t.icon className="size-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
              {included && (
                <span className="size-1.5 rounded-full bg-brand" aria-hidden />
              )}
            </button>
          )
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
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

        {tab === 'text' && <LyricsTab draft={draft} onChange={onDraftChange} />}
        {tab === 'audio' && <AudioTab />}
        {tab === 'image' && (
          <ImageTab coverSet={coverSet} onSetCover={onSetCover} />
        )}
      </div>
    </div>
  )
}
