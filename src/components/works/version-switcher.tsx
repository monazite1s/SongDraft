'use client'

import { cloneElement, isValidElement, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DemoVersionView } from '@/modules/generation/generation-types'

interface Props {
  projectId: string
  versions: DemoVersionView[]
  currentId: string
  /**
   * 触发器：需是接受 onClick 的元素（通常是 <Button>）。
   * 用 cloneElement 注入点击事件，避免嵌套 <button> 造成非法 DOM。
   */
  children: React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>
}

/**
 * 历史版本切换：列出同项目其他版本，点击改 URL 到对应歌曲详情，不进制作台。
 * 用 children 作为触发器，点击展开下拉。
 */
export function VersionSwitcher({ projectId, versions, currentId, children }: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const others = versions.filter((v) => v.id !== currentId)

  function go(id: string) {
    setOpen(false)
    router.push(`/works/${projectId}/v/${id}`)
  }

  return (
    <div ref={ref} className="relative">
      {isValidElement(children)
        ? cloneElement(children, { onClick: () => setOpen((o) => !o) })
        : children}
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-60 rounded-lg border border-border bg-popover p-1 shadow-md">
          <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            切换到历史版本
          </p>
          <ul className="max-h-72 overflow-auto">
            {others.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => go(v.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-foreground">{v.title || '未命名版本'}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      v{v.versionNo}
                      {v.isMain ? ' · 主版本' : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
