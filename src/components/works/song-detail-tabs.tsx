'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { OwnerCommentView } from '@/modules/sharing/share-service'

type Tab = 'lyrics' | 'comments'

interface Props {
  lyrics: string
  comments: OwnerCommentView[]
}

export function SongDetailTabs({ lyrics, comments }: Props) {
  const [tab, setTab] = useState<Tab>('lyrics')

  const sortedComments = [...comments].sort((a, b) => {
    // atMs 优先（时间轴锚点），无则按 createdAt 倒序
    const aMs = a.atMs ?? -1
    const bMs = b.atMs ?? -1
    if (aMs !== bMs) return aMs - bMs
    return b.createdAt.localeCompare(a.createdAt)
  })

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-5xl px-8 py-6">
        <div className="flex gap-6 border-b border-border">
          <TabButton active={tab === 'lyrics'} onClick={() => setTab('lyrics')}>
            歌词
          </TabButton>
          <TabButton active={tab === 'comments'} onClick={() => setTab('comments')}>
            评论
            <Count n={comments.length} />
          </TabButton>
        </div>

        <div className="py-5">
          {tab === 'lyrics' ? <LyricsPanel lyrics={lyrics} /> : <CommentsPanel comments={sortedComments} />}
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

function LyricsPanel({ lyrics }: { lyrics: string }) {
  if (!lyrics.trim()) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
        <p className="text-sm font-medium text-foreground">暂无歌词</p>
        <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
          在制作台填写歌词后，会显示在此处。
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-foreground">{lyrics}</pre>
    </div>
  )
}

function fmtFull(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function CommentsPanel({ comments }: { comments: OwnerCommentView[] }) {
  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
        <p className="text-sm font-medium text-foreground">还没有评论</p>
        <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
          通过分享链接邀请协作者，他们的反馈会按时间轴汇总在此处。
        </p>
      </div>
    )
  }

  return (
    <ol className="space-y-3">
      {comments.map((c) => (
        <li key={c.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">{c.author}</span>
            {c.atMs !== null ? (
              <span className="text-xs text-primary">{Math.floor(c.atMs / 1000)}s</span>
            ) : null}
          </div>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{c.content}</p>
          <p className="mt-2 text-[11px] text-muted-foreground/70">{fmtFull(c.createdAt)}</p>
        </li>
      ))}
    </ol>
  )
}
