'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileAudio, ImageIcon, Mic, Music2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { DemoVersionView } from '@/modules/generation/generation-types'
import type { InspirationListItem } from '@/modules/inspirations/inspiration-types'
import type { InspirationPrimaryKind } from '@/modules/inspirations/inspiration-schema'

type Tab = 'songs' | 'inspirations'

interface Props {
  projectId: string
  versions: DemoVersionView[]
  inspirations: InspirationListItem[]
}

const KIND_META: Record<InspirationPrimaryKind, { label: string; icon: typeof Mic }> = {
  audio: { label: '音频', icon: Mic },
  image: { label: '图片', icon: ImageIcon },
  text: { label: '文本', icon: Pencil },
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function ProjectDetailTabs({ projectId, versions, inspirations }: Props) {
  const [tab, setTab] = useState<Tab>('songs')

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-5xl px-8 py-6">
        {/* Tab bar */}
        <div className="flex gap-6 border-b border-border">
          <TabButton active={tab === 'songs'} onClick={() => setTab('songs')}>
            歌曲
            <Count n={versions.length} />
          </TabButton>
          <TabButton active={tab === 'inspirations'} onClick={() => setTab('inspirations')}>
            灵感
            <Count n={inspirations.length} />
          </TabButton>
        </div>

        <div className="py-5">
          {tab === 'songs' ? (
            <SongsTab projectId={projectId} versions={versions} />
          ) : (
            <InspirationsTab inspirations={inspirations} />
          )}
        </div>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors',
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

function SongsTab({ projectId, versions }: { projectId: string; versions: DemoVersionView[] }) {
  if (versions.length === 0) {
    return (
      <EmptyState
        title="尚未生成 Demo"
        hint="进入制作台，根据当前歌词与创意简报生成你的第一个版本。"
        action={
          <Link href={`/create/${projectId}`}>
            <Button size="sm" className="gap-2">
              <Music2 className="size-4" />
              打开制作台
            </Button>
          </Link>
        }
      />
    )
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {versions.map((v) => (
        <li key={v.id}>
          <Link
            href={`/works/${projectId}/v/${v.id}`}
            className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/60"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <FileAudio className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-foreground">{v.title || '未命名版本'}</p>
                <span className="shrink-0 text-xs text-muted-foreground">v{v.versionNo}</span>
                {v.isMain ? (
                  <span className="shrink-0 rounded-full border border-success/30 bg-success/10 px-1.5 py-0.5 text-[11px] font-medium leading-none text-success-foreground">
                    主版本
                  </span>
                ) : null}
                {!v.hasAudio ? (
                  <span className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground">
                    无音频
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{fmtDate(v.createdAt)}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function InspirationsTab({ inspirations }: { inspirations: InspirationListItem[] }) {
  if (inspirations.length === 0) {
    return <EmptyState title="暂无关联灵感" hint="从灵感记录页关联到本项目后，会在此汇总。" />
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {inspirations.map((ins) => {
        const meta = KIND_META[ins.primaryKind] ?? KIND_META.text
        const Icon = meta.icon
        return (
          <li key={ins.id}>
            <Link
              href="/inspirations"
              className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/60"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{ins.title || '未命名灵感'}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">{meta.label}</span>
                </div>
                {ins.summary ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{ins.summary}</p> : null}
                <p className="mt-0.5 truncate text-xs text-muted-foreground">更新于 {fmtDate(ins.updatedAt)}</p>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint ? <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
