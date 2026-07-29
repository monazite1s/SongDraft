'use client'

import Link from 'next/link'
import {
  AudioLines,
  LayoutGrid,
  Lightbulb,
  FolderClosed,
  Share2,
  Cpu,
  Settings,
  Plus,
  LifeBuoy,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { icon: Lightbulb, label: '灵感记录', href: '/', active: true },
  { icon: LayoutGrid, label: '制作台', href: '/create' },
  { icon: FolderClosed, label: '创作库', href: '/works' },
  { icon: Cpu, label: '设置', href: '/settings' },
]

const projects = [
  { name: '雨夜街角', color: 'bg-brand' },
  { name: '晨跑节奏', color: 'bg-chart-3' },
  { name: '短片 · 归乡', color: 'bg-chart-4' },
]

export function Sidebar() {
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
        {nav.map((item) => (
          <Link
            key={item.label}
            href={item.href || '#'}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
              item.active
                ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-2 px-3">
        <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          最近项目
        </p>
        <div className="flex flex-col gap-0.5">
          {projects.map((p) => (
            <button
              key={p.name}
              className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            >
              <span className={cn('size-2 rounded-sm', p.color)} aria-hidden />
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
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
