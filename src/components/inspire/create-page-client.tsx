'use client'

/**
 * 制作台 /create 入口（客户端壳）。
 *
 * SongDraftWorkspace 自身已含 Sidebar；此处只叠加 ProjectSelectDialog，
 * 避免再包一层侧栏造成「nav + 制作台」重复。
 *
 * 弹窗策略：
 * - 无 lastProject → 自动弹出引导；
 * - 有 lastProject → workspace 会校验后 restore（不弹窗）；
 * - `?missing=1`（从失效 /create/[id] 重定向而来）→ 清掉坏缓存并弹窗，避免死循环。
 */
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { SongDraftWorkspace } from '@/components/inspire/workspace'
import { ProjectSelectDialog } from '@/components/inspire/project-select-dialog'
import { clearLastProject, loadLastProject } from '@/lib/client-draft-store'

function CreateProjectPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    const missing = searchParams.get('missing') === '1'
    if (missing) {
      clearLastProject()
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDialogOpen(true)
      // 去掉 query，避免刷新反复清缓存；replace 不入历史栈。
      router.replace('/create')
      return
    }
    if (!loadLastProject()) {
      setDialogOpen(true)
    }
  }, [searchParams, router])

  return (
    <>
      <SongDraftWorkspace />
      <ProjectSelectDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  )
}

export function CreateProjectPage() {
  return (
    <Suspense fallback={<SongDraftWorkspace />}>
      <CreateProjectPageInner />
    </Suspense>
  )
}
