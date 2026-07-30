'use client'

/**
 * 移动端底部导航（< lg）。
 *
 * 与 Sidebar 共用导航项（灵感记录 / 制作台 / 灵感库 / 歌曲库 / 设置 / 帮助），
 * 仅在移动端渲染（`lg:hidden`）。桌面端 Sidebar 由 (app)/layout.tsx 统一挂载一次，
 * 本组件作为 layout `<main>` 的兄弟节点贴底，不使用 fixed/overlay 以免遮挡内容。
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Library, Lightbulb, LifeBuoy, Music, Cpu } from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { icon: Lightbulb, label: '灵感', href: '/', match: (p: string) => p === '/' },
  { icon: LayoutGrid, label: '制作台', href: '/create', match: (p: string) => p === '/create' || p.startsWith('/create/') },
  { icon: Library, label: '灵感库', href: '/inspirations', match: (p: string) => p === '/inspirations' || p.startsWith('/inspirations/') },
  { icon: Music, label: '歌曲库', href: '/works', match: (p: string) => p === '/works' || p.startsWith('/works/') },
  { icon: Cpu, label: '设置', href: '/settings', match: (p: string) => p === '/settings' || p.startsWith('/settings/') },
  { icon: LifeBuoy, label: '帮助', href: '/help', match: (p: string) => p.startsWith('/help') },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="flex shrink-0 items-stretch justify-around border-t border-border bg-sidebar lg:hidden">
      {nav.map((item) => {
        const active = item.match(pathname)
        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] transition-colors',
              active ? 'text-brand' : 'text-muted-foreground',
            )}
          >
            <item.icon className="size-5" />
            <span className="truncate">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
