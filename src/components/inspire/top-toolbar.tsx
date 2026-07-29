'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Check,
  ChevronDown,
  Cloud,
  GitBranch,
  MoreHorizontal,
  Share2,
  TriangleAlert,
  Copy,
  Trash2,
  History,
  LoaderCircle,
  Loader2,
  ChevronsUpDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  PROVIDERS,
  type InputKind,
  type Provider,
} from '@/lib/inspire-data'
import { StatusDot } from './ui'

const INPUT_LABELS: Record<InputKind, string> = {
  text: '歌词/文本',
  audio: '哼唱/音频',
  image: '图像',
  video: '视频',
}

function Popover({
  open,
  onClose,
  children,
  align = 'start',
  className,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  align?: 'start' | 'end'
  className?: string
}) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div
        className={cn(
          'absolute top-[calc(100%+6px)] z-50 rounded-xl border border-border bg-popover p-1.5 shadow-lg shadow-black/5',
          align === 'end' ? 'right-0' : 'left-0',
          className,
        )}
      >
        {children}
      </div>
    </>
  )
}

export function TopToolbar({
  provider,
  onProviderChange,
  selectedInputs,
  projectTitle,
  saveState,
  onSave,
  currentVersion,
  onOpenVersions,
  onOpenShare,
  onManageProviders,
  onOpenProjectSelect,
}: {
  provider: Provider
  onProviderChange: (p: Provider) => void
  selectedInputs: InputKind[]
  projectTitle: string
  saveState: 'dirty' | 'saving' | 'saved' | 'error'
  onSave: () => void
  currentVersion: string
  onOpenVersions: () => void
  onOpenShare: () => void
  onManageProviders: () => void
  /** 任务6：点击项目标题切换/新建项目，弹出 ProjectSelectDialog。 */
  onOpenProjectSelect: () => void
}) {
  const [providerOpen, setProviderOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  // 复制为新项目 / 删除项目：自包含，不向 workspace 加 prop。
  // 用 usePathname 取 projectId，自行 fetch 项目详情完成克隆。
  const router = useRouter()
  const pathname = usePathname()
  const projectIdFromPath = (() => {
    const m = pathname?.match(/\/create\/([^/]+)/)
    return m ? m[1] : null
  })()
  const [busy, setBusy] = useState<'clone' | 'delete' | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [menuError, setMenuError] = useState('')

  async function handleClone() {
    if (!projectIdFromPath) return
    setBusy('clone')
    setMenuError('')
    try {
      const res = await fetch(`/api/projects/${projectIdFromPath}`)
      const body = (await res.json()) as { ok?: boolean; data?: { title?: string; description?: string | null; lyrics?: string | null } }
      if (!res.ok || !body.ok || !body.data) throw new Error('读取项目失败')
      const src = body.data
      const createRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: `${src.title || '未命名项目'} 副本`,
          description: src.description ?? undefined,
          lyrics: src.lyrics ?? undefined,
        }),
      })
      const createBody = (await createRes.json()) as { ok?: boolean; data?: { id?: string }; error?: { message?: string } }
      if (!createRes.ok || !createBody.ok || !createBody.data?.id) throw new Error(createBody.error?.message || '克隆项目失败')
      setMoreOpen(false)
      router.push(`/create/${createBody.data.id}`)
    } catch (e) {
      setMenuError(e instanceof Error ? e.message : '克隆项目失败')
    } finally {
      setBusy(null)
    }
  }

  async function handleDeleteProject() {
    if (!projectIdFromPath) return
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    setBusy('delete')
    setMenuError('')
    try {
      const res = await fetch(`/api/projects/${projectIdFromPath}`, { method: 'DELETE' })
      const body = (await res.json()) as { ok?: boolean; error?: { message?: string } }
      if (!res.ok || !body.ok) throw new Error(body.error?.message || '删除项目失败')
      setMoreOpen(false)
      router.push('/works')
    } catch (e) {
      setMenuError(e instanceof Error ? e.message : '删除项目失败')
    } finally {
      setBusy(null)
      setConfirmingDelete(false)
    }
  }

  function closeMore() {
    setMoreOpen(false)
    setConfirmingDelete(false)
    setMenuError('')
  }

  const unsupported = selectedInputs.filter((i) => !provider.supports.includes(i))

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="size-2 rounded-sm bg-brand" aria-hidden />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {/* 任务6：标题可点击，弹出 ProjectSelectDialog 切换/新建项目。 */}
            <button
              type="button"
              onClick={onOpenProjectSelect}
              title="切换或新建项目"
              className="group flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <span className="truncate">{projectTitle}</span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saveState === 'saving'}
              className="hidden items-center gap-1 rounded px-1 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-wait sm:inline-flex"
            >
              {saveState === 'saving' ? <LoaderCircle className="size-3.5 animate-spin" /> : <Cloud className="size-3.5" />}
              {saveState === 'saved' ? '已保存' : saveState === 'saving' ? '保存中' : saveState === 'error' ? '重试保存' : '保存'}
            </button>
          </div>
          <p className="truncate text-[11px] text-muted-foreground">
            灵感项目 · {saveState === 'saved' ? '刚刚保存' : '正在编辑'}
          </p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* provider selector */}
        <div className="relative hidden sm:block">
          <button
            onClick={() => setProviderOpen((v) => !v)}
            aria-expanded={providerOpen}
            className="flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <StatusDot status={provider.status} />
            <span className="max-w-32 truncate">{provider.name}</span>
            {unsupported.length > 0 && (
              <TriangleAlert className="size-3.5 text-warning" />
            )}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>
          <Popover
            open={providerOpen}
            onClose={() => setProviderOpen(false)}
            className="w-80"
          >
            <p className="px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              生成供应商
            </p>
            {PROVIDERS.map((p) => {
              const miss = selectedInputs.filter((i) => !p.supports.includes(i))
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    onProviderChange(p)
                    setProviderOpen(false)
                  }}
                  className="flex w-full items-start gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-muted"
                >
                  <span className="mt-0.5">
                    <StatusDot status={p.status} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {p.name}
                      </span>
                      {p.id === provider.id && (
                        <Check className="ml-auto size-4 text-brand" />
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {p.note}
                    </span>
                    {miss.length > 0 && (
                      <span className="mt-1 flex items-center gap-1 text-[11px] text-warning-foreground">
                        <TriangleAlert className="size-3" />
                        不支持：{miss.map((m) => INPUT_LABELS[m]).join('、')}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
            <div className="mt-1 border-t border-border pt-1">
              <button
                onClick={() => {
                  setProviderOpen(false)
                  onManageProviders()
                }}
                className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-brand hover:bg-muted"
              >
                管理供应商与能力…
              </button>
            </div>
          </Popover>
        </div>

        {/* version indicator */}
        <button
          onClick={onOpenVersions}
          className="hidden h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground transition-colors hover:bg-muted md:flex"
        >
          <GitBranch className="size-3.5 text-muted-foreground" />
          {currentVersion}
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={saveState === 'saving'}
          aria-label={saveState === 'saved' ? '已保存' : '保存'}
          className="flex size-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-wait sm:hidden"
        >
          {saveState === 'saving' ? <LoaderCircle className="size-3.5 animate-spin" /> : <Cloud className="size-3.5" />}
        </button>

        <div className="mx-0.5 hidden h-5 w-px bg-border sm:block" />

        <button
          onClick={onOpenShare}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Share2 className="size-3.5" />
          分享
        </button>

        <div className="relative">
          <button
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            aria-label="更多操作"
            className="flex size-8 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted"
          >
            <MoreHorizontal className="size-4" />
          </button>
          <Popover
            open={moreOpen}
            onClose={closeMore}
            align="end"
            className="w-52"
          >
            <button
              onClick={() => {
                setMoreOpen(false)
                onOpenVersions()
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
            >
              <History className="size-4 text-muted-foreground" />
              版本历史
            </button>
            <button
              onClick={() => void handleClone()}
              disabled={!projectIdFromPath || busy !== null}
              title={!projectIdFromPath ? '请先选择项目' : undefined}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
            >
              {busy === 'clone' ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <Copy className="size-4 text-muted-foreground" />}
              {busy === 'clone' ? '复制中…' : '复制为新项目'}
            </button>
            <div className="mt-1 border-t border-border pt-1">
              <button
                onClick={() => void handleDeleteProject()}
                disabled={!projectIdFromPath || busy !== null}
                title={!projectIdFromPath ? '请先选择项目' : undefined}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  confirmingDelete
                    ? 'text-destructive hover:bg-destructive/10'
                    : 'text-destructive hover:bg-destructive/10',
                )}
              >
                {busy === 'delete' ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                {busy === 'delete' ? '删除中…' : confirmingDelete ? '确认删除项目' : '删除项目'}
              </button>
              {menuError ? <p role="alert" className="px-2 pt-1 text-[11px] leading-snug text-destructive">{menuError}</p> : null}
            </div>
          </Popover>
        </div>
      </div>
    </header>
  )
}
