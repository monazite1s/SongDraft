import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import { resetClientDraftStore, saveClientDraft, DRAFT_KEYS } from '@/lib/client-draft-store'
import { DEFAULT_BRIEF } from '@/lib/inspire-data'
import type { ProjectDetail } from '@/modules/projects/project-types'

const replace = vi.fn()
const push = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push }), usePathname: () => '/' }))

import { SongDraftWorkspace } from './workspace'

const baseProject: ProjectDetail = {
  id: 'existing-1',
  ownerId: 'u1',
  title: '已存在项目',
  description: '一段描述',
  lyrics: '原始歌词第一行',
  status: 'draft',
  combination: 'text',
  updatedAt: '2026-07-01T00:00:00.000Z',
  createdAt: '2026-07-01T00:00:00.000Z',
  artist: null,
  eventId: null,
  creativeContext: {},
  assets: [],
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  replace.mockReset()
  push.mockReset()
  resetClientDraftStore()
})

test('creates a project via POST /api/projects then router.replace when saving a brand-new draft', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    jsonResponse({ ok: true, data: { id: 'project-123', title: '未命名项目' } }, 201),
  )

  render(<SongDraftWorkspace />)
  fireEvent.click(screen.getAllByRole('button', { name: '保存' })[0]!)

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith('/api/projects', expect.objectContaining({ method: 'POST' }))
  })
  // 新建走 replace 进入 /create/[id]，不产生占位 /create 残留。
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/create/project-123'))
})

test('saves an existing project via PATCH /draft and never calls POST /api/projects', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const req = typeof input === 'string' ? undefined : (input as Request)
    const url = req?.url ?? (input as string)
    const method = req?.method
    if (url.endsWith('/draft') && method === 'PATCH') {
      return jsonResponse({ ok: true, data: { ok: true } })
    }
    return jsonResponse({ ok: false, error: { message: `unexpected ${method ?? 'GET'} ${url}` } }, 404)
  })

  render(<SongDraftWorkspace initialProject={baseProject} />)
  // 已有项目初始 saveState=saved；编辑歌词触发 markDirty，保存按钮重新出现。
  const lyrics = screen.getByPlaceholderText('输入歌词或文本') as HTMLTextAreaElement
  fireEvent.change(lyrics, { target: { value: '编辑后的歌词' } })
  fireEvent.click(screen.getAllByRole('button', { name: '保存' })[0]!)

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/projects/existing-1/draft',
      expect.objectContaining({ method: 'PATCH' }),
    )
  })
  // 已有项目保存不应触发创建，也不应 router.replace。
  expect(fetchMock).not.toHaveBeenCalledWith('/api/projects', expect.anything())
  expect(replace).not.toHaveBeenCalled()
})

test('bootWorkspace restores persisted session draft instead of server initial values', async () => {
  // 模拟会话草稿：用户编辑过歌词但尚未保存，切走又切回不应丢失。
  saveClientDraft(DRAFT_KEYS.workspace('existing-1'), {
    draft: {
      creativePrompt: '用户输入的提示',
      lyrics: '用户输入的未保存歌词',
      instruction: '一段指令',
    },
    originalLyrics: '用户输入的未保存歌词',
    refinedLyrics: null,
    selectedInputs: ['text', 'audio', 'image'],
    coverSet: false,
    quantity: 3,
    extraPrompt: '',
    outputType: 'song',
    phase: 'idle',
    brief: DEFAULT_BRIEF,
    briefId: null,
    projectTitle: '未保存草稿项目',
  })

  render(<SongDraftWorkspace initialProject={baseProject} />)
  // 会话草稿的歌词优先于服务端 initialProject.lyrics（bug 1 修复：草稿持久化）。
  const lyrics = screen.getByPlaceholderText('输入歌词或文本') as HTMLTextAreaElement
  expect(lyrics.value).toBe('用户输入的未保存歌词')
})
