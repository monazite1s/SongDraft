'use client'

/**
 * 制作台空状态（docs/SPEC.md §2 触点 A）。
 *
 * 直接进入 /create 时，未选择项目的工作台以「空状态」展示，
 * 提供二选一入口：新建项目 / 导入已有项目。
 * 无论哪条路径，都需用户显式确认后才进入工作台，避免产生幽灵项目。
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FolderPlus, Plus } from 'lucide-react'

import type { ProjectSummary } from '@/modules/projects/project-types'
import { Button } from '@/components/ui/button'
import { SectionCard } from './ui'

type ProjectListEnvelope = { ok: boolean; data?: { items?: ProjectSummary[] }; error?: { message?: string } }
type CreateEnvelope = { ok: boolean; data?: { id: string }; error?: { message?: string } }

const inputClass =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20'

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day} ${hours}:${minutes}`
}

export function CreateEmptyState() {
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
    let cancelled = false
    fetch('/api/projects?page=1&pageSize=8')
      .then(async (response) => {
        const body = (await response.json()) as ProjectListEnvelope
        if (!response.ok || !body.ok) throw new Error(body.error?.message || '项目列表加载失败')
        return body.data?.items ?? []
      })
      .then((items) => {
        if (!cancelled) {
          setProjects(items)
          if (items.length > 0) setSelectedId(items[0]!.id)
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
  }, [])

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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-10 lg:px-8">
      <header className="space-y-1.5">
        <h1 className="text-lg font-semibold text-foreground">制作台</h1>
        <p className="text-sm text-muted-foreground">选择或新建一个项目，开始制作 Demo。</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 新建项目 */}
        <SectionCard title="新建项目">
          <div className="space-y-3 p-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">项目名称</span>
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
            </label>
            {createError && (
              <p role="alert" className="text-xs text-destructive">{createError}</p>
            )}
            <Button
              className="w-full"
              size="lg"
              disabled={!title.trim() || creating}
              onClick={() => void handleCreate()}
            >
              <Plus className="size-4" />
              {creating ? '创建中…' : '创建并进入'}
            </Button>
          </div>
        </SectionCard>

        {/* 导入已有项目 */}
        <SectionCard title="导入已有项目">
          <div className="flex min-h-[140px] flex-col p-4">
            {loadingProjects ? (
              <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">加载中…</div>
            ) : projectsError ? (
              <p role="alert" className="text-xs text-destructive">{projectsError}</p>
            ) : projects.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
                <FolderPlus className="size-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">暂无项目，请新建</p>
              </div>
            ) : (
              <>
                <ul className="-mx-1 max-h-64 space-y-1 overflow-y-auto">
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
                  className="mt-3 w-full"
                  size="lg"
                  variant="outline"
                  disabled={!selectedId || entering}
                  onClick={handleEnter}
                >
                  {entering ? '进入中…' : '进入项目'}
                </Button>
              </>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
