'use client'

/**
 * 制作台 /create 入口（客户端壳）。
 *
 * SongDraftWorkspace 自身已含 Sidebar；此处只叠加 ProjectSelectDialog，
 * 避免再包一层侧栏造成「nav + 制作台」重复。
 */
import { useState } from 'react'

import { SongDraftWorkspace } from '@/components/inspire/workspace'
import { ProjectSelectDialog } from '@/components/inspire/project-select-dialog'

export function CreateProjectPage() {
  // 首次进入 /create 自动弹出引导弹窗。
  const [dialogOpen, setDialogOpen] = useState(true)

  return (
    <>
      <SongDraftWorkspace />
      <ProjectSelectDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  )
}
