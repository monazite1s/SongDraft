import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

const replace = vi.fn()
const push = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push }) }))

import { CreateEmptyState } from './create-empty-state'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/** 从 fetch(string, init) 或 fetch(Request) 调用中提取 url 与 method。 */
function parseFetchArgs(input: RequestInfo | URL, init?: RequestInit): { url: string; method: string } {
  if (typeof input === 'string') {
    return { url: input, method: init?.method ?? 'GET' }
  }
  if (input instanceof Request) {
    return { url: input.url, method: input.method }
  }
  return { url: String(input), method: init?.method ?? 'GET' }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  replace.mockReset()
  push.mockReset()
})

test('creates a project and router.replace to /create/[id] on "创建并进入"', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const { url, method } = parseFetchArgs(input, init)
    if (url.includes('/api/projects') && method === 'POST') {
      return jsonResponse({ ok: true, data: { id: 'new-1', title: '我的项目' } }, 201)
    }
    // 列表 GET 返回空，避免干扰。
    return jsonResponse({ ok: true, data: { items: [] } })
  })

  render(<CreateEmptyState />)

  const input = screen.getByPlaceholderText('为这个项目起个名字') as HTMLInputElement
  fireEvent.change(input, { target: { value: '我的项目' } })
  fireEvent.click(screen.getByRole('button', { name: /创建并进入/ }))

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith('/api/projects', expect.objectContaining({ method: 'POST' }))
  })
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/create/new-1'))
})

test('lists existing projects, allows selection, then router.push on "进入项目"', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const { url, method } = parseFetchArgs(input, init)
    if (url.includes('/api/projects') && method === 'GET') {
      return jsonResponse({
        ok: true,
        data: {
          items: [
            {
              id: 'p-1',
              ownerId: 'u',
              title: '雨夜街角',
              description: null,
              status: 'draft',
              combination: 'text',
              updatedAt: '2026-07-20T10:30:00.000Z',
              createdAt: '2026-07-20T10:30:00.000Z',
              artist: null,
              eventId: null,
            },
          ],
        },
      })
    }
    return jsonResponse({ ok: false })
  })

  render(<CreateEmptyState />)

  // 列表加载完成后展示项目行。
  const row = await screen.findByRole('button', { name: /雨夜街角/ })
  fireEvent.click(row)
  fireEvent.click(screen.getByRole('button', { name: /进入项目/ }))

  await waitFor(() => expect(push).toHaveBeenCalledWith('/create/p-1'))
})

test('shows empty hint when there are no projects', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: true, data: { items: [] } }))

  render(<CreateEmptyState />)

  await waitFor(() => {
    expect(screen.getByText('暂无项目，请新建')).toBeInTheDocument()
  })
})
