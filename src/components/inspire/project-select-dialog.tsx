'use client'

/**
 * 制作台项目选择弹窗（docs/SPEC.md §2 触点 A）。
 *
 * 直接进入 /create（无 projectId）时首次自动弹出，提供二选一引导：
 * 新建项目 / 导入已有项目。用户可关闭弹窗，关闭后仍能看到制作台 UI（可自由创作）。
 * 弹窗逻辑叠加在 create/page 层，不修改 workspace 内部。
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, FolderPlus, Plus } from 'lucide-react'

import type { ProjectSummary } from '@/modules/projects/project-types'
import { Button } from '@/components/ui/button'

type ProjectListEnvelope = { ok: boolean; data?: { items?: ProjectSummary[] }; error?: { message?: string } }
type CreateEnvelope = { ok: boolean; data?: { id: string }; error?: { message?: string } }

const inputClass =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20'

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function ProjectSelectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [projectsError, setProjectsError] = useState('')
  const [selectedId, setSelectedId] = useState<string>('')
  const [entering, setEntering] = useState(false)

  // 列表加载为独立数据请求（非派生 state），loading 态在 effect 内 setState 合规。
  useEffect(() => {
    if (!open) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingProjects(true)
    fetch('/api/projects?page=1&pageSize=8')
      .then(async (response) => {
        const body = (await response.json()) as ProjectListEnvelope
        if (!response.ok || !body.ok) throw new Error(body.error?.message || '项目列表加载失败')
        return body.data?.items ?? []
      })
      .then((items) => {
        if (!cancelled) {
          setProjects(items)
          if (items.length > 0 && !selectedId) setSelectedId(items[0]!.id)
        }
      })
      .catch((error) => {
        if (!cancelled) setProjectsError(error instanceof Error ? error.message : '项目列表加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoadingProjects(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function handleCreate() {
    const trimmed = title.trim()
    if (!trimmed || creating) return
    setCreating(true)
    setCreateError('')
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: trimmed, description: '', lyrics: '' }),
      })
      const body = (await response.json()) as CreateEnvelope
      if (!response.ok || !body.ok || !body.data?.id) {
        throw new Error(body.error?.message || '创建项目失败')
      }
      router.replace(`/create/${body.data.id}`)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : '创建项目失败')
    } finally {
      setCreating(false)
    }
  }

  function handleEnter() {
    if (!selectedId || entering) return
    setEntering(true)
    router.push(`/create/${selectedId}`)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      {/* 弹窗主体 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-select-title"
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-[0_8px_24px_rgba(16,24,40,0.12)]"
      >
        <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-3.5">
          <div>
            <h2 id="project-select-title" className="text-sm font-semibold text-foreground">
              开始一个制作台项目
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">选择已有项目或新建，也可关闭后自由创作。</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="space-y-5 px-5 py-4">
          {/* 新建项目 */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">新建项目</h3>
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void handleCreate()
                }}
                placeholder="为这个项目起个名字"
                maxLength={80}
              />
              <Button
                size="lg"
                disabled={!title.trim() || creating}
                onClick={() => void handleCreate()}
              >
                <Plus className="size-4" />
                {creating ? '创建中…' : '创建'}
              </Button>
            </div>
            {createError && <p role="alert" className="text-xs text-destructive">{createError}</p>}
          </section>

          {/* 分隔 */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] text-muted-foreground">或</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* 导入已有项目 */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">导入已有项目</h3>
            {loadingProjects ? (
              <div className="flex min-h-[80px] items-center justify-center text-xs text-muted-foreground">加载中…</div>
            ) : projectsError ? (
              <p role="alert" className="text-xs text-destructive">{projectsError}</p>
            ) : projects.length === 0 ? (
              <div className="flex min-h-[80px] flex-col items-center justify-center gap-1 text-center">
                <FolderPlus className="size-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">暂无项目，请新建</p>
              </div>
            ) : (
              <>
                <ul className="max-h-56 space-y-1 overflow-y-auto">
                  {projects.map((project) => {
                    const active = project.id === selectedId
                    return (
                      <li key={project.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(project.id)}
                          aria-pressed={active}
                          className={
                            'flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors ' +
                            (active
                              ? 'border-brand bg-brand-muted text-foreground'
                              : 'border-border bg-background text-foreground hover:bg-muted')
                          }
                        >
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{project.title}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {formatDate(project.updatedAt)}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
                <Button
                  className="w-full"
                  size="lg"
                  variant="outline"
                  disabled={!selectedId || entering}
                  onClick={handleEnter}
                >
                  {entering ? '进入中…' : '进入项目'}
                </Button>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
