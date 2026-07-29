'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  AudioLines,
  LayoutGrid,
  Lightbulb,
  Library,
  FolderClosed,
  Cpu,
  Plus,
  LifeBuoy,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type RecentSong = {
  versionId: string
  projectId: string
  title: string
  projectName: string
  updatedAt: string
}

type RecentSongsEnvelope = { ok?: boolean; data?: RecentSong[] }

const dotColors = ['bg-brand', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5']

function colorForId(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return dotColors[hash % dotColors.length]
}

const nav = [
  { icon: Lightbulb, label: '灵感记录', href: '/', match: (pathname: string) => pathname === '/' },
  { icon: LayoutGrid, label: '制作台', href: '/create', match: (pathname: string) => pathname === '/create' || pathname.startsWith('/create/') },
  { icon: Library, label: '灵感库', href: '/inspirations', match: (pathname: string) => pathname === '/inspirations' || pathname.startsWith('/inspirations/') },
  { icon: FolderClosed, label: '创作库', href: '/works', match: (pathname: string) => pathname === '/works' || pathname.startsWith('/works/') },
  { icon: Cpu, label: '设置', href: '/settings', match: (pathname: string) => pathname === '/settings' || pathname.startsWith('/settings/') },
]

export function Sidebar() {
  const pathname = usePathname()
  const [songs, setSongs] = useState<RecentSong[]>([])
  const [loaded, setLoaded] = useState(false)

  // 最近歌曲数据为独立请求（非派生 state），loading 态在 effect 内 setState 合规。
  useEffect(() => {
    fetch('/api/works/recent-songs?limit=5')
      .then(async (r) => {
        const body = (await r.json()) as RecentSongsEnvelope
        if (r.ok && body.ok && Array.isArray(body.data)) {
          setSongs(body.data)
        }
      })
      .catch(() => {
        /* fetch 失败走空状态，不抛错 */
      })
      .finally(() => setLoaded(true))
  }, [])

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <AudioLines className="size-4" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
          SongDraft
        </span>
      </div>

      <div className="px-3 pb-2">
        <Link href="/" className="flex w-full items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
          <Plus className="size-4" />
          新建灵感
        </Link>
      </div>

      <nav className="flex flex-col gap-0.5 px-3 py-2">
        {nav.map((item) => {
          const active = item.match(pathname)
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-2 px-3">
        <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          最近歌曲
        </p>
        {loaded ? (
          songs.length === 0 ? (
            <p className="px-3 py-1.5 text-xs text-muted-foreground">暂无歌曲</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {songs.map((song) => (
                <Link
                  key={song.versionId}
                  href={`/create/${song.projectId}`}
                  title={`${song.title} · ${song.projectName}`}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                >
                  <span className={cn('size-2 shrink-0 rounded-sm', colorForId(song.projectId))} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-foreground/90">{song.title || '未命名歌曲'}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{song.projectName}</span>
                  </span>
                </Link>
              ))}
              {songs.length >= 5 && (
                <Link
                  href="/works"
                  className="px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-sidebar-foreground"
                >
                  查看全部
                </Link>
              )}
            </div>
          )
        ) : null}
      </div>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-sidebar-border p-3">
        <Link
          href="#"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          <LifeBuoy className="size-4" />
          帮助与文档
        </Link>

        <div className="mt-1 flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <div className="flex size-8 items-center justify-center rounded-full bg-brand-muted text-xs font-semibold text-brand">
            林
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              Demo 创作者
            </p>
            <p className="truncate text-xs text-muted-foreground">Pro 工作区</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
