import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

const replace = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }), usePathname: () => '/' }))

import { SongDraftWorkspace } from './workspace'

afterEach(() => {
  vi.restoreAllMocks()
  replace.mockReset()
})

test('creates a project from the full workspace when saving a new draft', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    ok: true,
    data: { id: 'project-123', title: '雨夜街角' },
  }), { status: 201, headers: { 'content-type': 'application/json' } }))

  render(<SongDraftWorkspace />)
  fireEvent.click(screen.getAllByRole('button', { name: '保存' })[0]!)

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  expect(fetchMock).toHaveBeenCalledWith('/api/projects', expect.objectContaining({ method: 'POST' }))
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/create/project-123'))
  expect(screen.queryByText('先从首页写下一段灵感')).not.toBeInTheDocument()
})
