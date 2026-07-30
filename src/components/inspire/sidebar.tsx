'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  AudioLines,
  LayoutGrid,
  Lightbulb,
  Library,
  Music,
  Cpu,
  Plus,
  LifeBuoy,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { loadLastProject } from '@/lib/client-draft-store'
import { logoutAction } from '@/modules/auth/actions'

type RecentSong = {
  versionId: string
  projectId: string
  title: string
  projectName: string
  updatedAt: string
}

type RecentSongsEnvelope = { ok?: boolean; data?: RecentSong[] }

type ProfileView = {
  id: string
  email: string
  displayName: string
  avatarObjectKey: string | null
}

type ProfileEnvelope = { ok?: boolean; data?: ProfileView }

const dotColors = ['bg-brand', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5']

function colorForId(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return dotColors[hash % dotColors.length]
}

const nav = [
  { icon: Lightbulb, label: '灵感记录', href: '/', key: 'home', match: (pathname: string) => pathname === '/' },
  { icon: LayoutGrid, label: '制作台', href: '/create', key: 'create', match: (pathname: string) => pathname === '/create' || pathname.startsWith('/create/') },
  { icon: Library, label: '灵感库', href: '/inspirations', key: 'inspirations', match: (pathname: string) => pathname === '/inspirations' || pathname.startsWith('/inspirations/') },
  { icon: Music, label: '歌曲库', href: '/works', key: 'works', match: (pathname: string) => pathname === '/works' || pathname.startsWith('/works/') },
  { icon: Cpu, label: '设置', href: '/settings', key: 'settings', match: (pathname: string) => pathname === '/settings' || pathname.startsWith('/settings/') },
]

export function Sidebar() {
  const pathname = usePathname()
  const [songs, setSongs] = useState<RecentSong[]>([])
  const [loaded, setLoaded] = useState(false)
  const [profile, setProfile] = useState<ProfileView | null>(null)
  /**
   * 「制作台」入口指向上次活跃项目（/create/[id]），避免切 tab 回来后丢失项目选择。
   * 初始为裸 /create（SSR 一致），挂载后读 localStorage 更新；pathname 变化时重读，
   * 保证在其他页面停留期间 lastProject 更新也能反映到链接上。
   */
  const [createHref, setCreateHref] = useState('/create')

  useEffect(() => {
    const last = loadLastProject()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCreateHref(last ? `/create/${last.id}` : '/create')
  }, [pathname])

  // 当前用户：每次跳转刷新（廉价：getCurrentUser 已 cache 去重 + 1 次 upsert）。
  // 必须 refetch——Sidebar 在 (app) 段只挂载一次，挂载时若 session 尚未就绪需靠下次跳转恢复，
  // 否则会卡在「未登录」（登入竞态）。
  useEffect(() => {
    let cancelled = false
    fetch('/api/profile')
      .then(async (r) => {
        const body = (await r.json()) as ProfileEnvelope
        if (!cancelled && r.ok && body.ok && body.data) setProfile(body.data)
      })
      .catch(() => { /* 取数失败保持 null */ })
    return () => { cancelled = true }
  }, [pathname])

  // 最近歌曲：挂载时拉一次 + 保存版本事件刷新（不再每次跳转都拉，避免拖慢导航）。
  useEffect(() => {
    let cancelled = false
    const loadSongs = () => {
      fetch('/api/works/recent-songs?limit=5')
        .then(async (r) => {
          const body = (await r.json()) as RecentSongsEnvelope
          if (!cancelled && r.ok && body.ok && Array.isArray(body.data)) setSongs(body.data)
        })
        .catch(() => { /* fetch 失败走空状态，不抛错 */ })
        .finally(() => { if (!cancelled) setLoaded(true) })
    }
    loadSongs()
    window.addEventListener('sd:songs-changed', loadSongs)
    return () => {
      cancelled = true
      window.removeEventListener('sd:songs-changed', loadSongs)
    }
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
          const href = item.key === 'create' ? createHref : item.href
          return (
            <Link
              key={item.label}
              href={href}
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
          href="/help"
          aria-current={pathname.startsWith('/help') ? 'page' : undefined}
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
            pathname.startsWith('/help')
              ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
              : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
          )}
        >
          <LifeBuoy className="size-4" />
          帮助与文档
        </Link>

        <div className="mt-1 flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          {profile ? (
            <>
              <Link
                href="/settings"
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-0 py-0.5 transition-colors hover:opacity-80"
                title="点击进入设置"
              >
                <div className="flex size-8 items-center justify-center rounded-full bg-brand-muted text-xs font-semibold text-brand">
                  {(profile.displayName || '?').slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-sidebar-foreground">
                    {profile.displayName || '未命名用户'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground" title={profile.email}>
                    {profile.email || ''}
                  </p>
                </div>
              </Link>
              <form action={logoutAction} title="退出登录">
                <button
                  type="submit"
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  aria-label="退出登录"
                >
                  <LogOut className="size-4" />
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-0 py-0.5 transition-colors hover:opacity-80"
              title="点击登录"
            >
              <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                ？
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-sidebar-foreground">
                  未登录
                </p>
                <p className="truncate text-xs text-muted-foreground">点击登录</p>
              </div>
            </Link>
          )}
        </div>
      </div>
    </aside>
  )
}
