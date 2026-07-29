'use client'

/**
 * SongDraft 唯一主创作容器（docs/development-state.md、docs/technical-design.md §2）
 *
 * 布局：Sidebar + TopToolbar + 三栏（MaterialPanel / ActionColumn / BriefPanel）。
 * 编排项目创建 → 草稿保存 → DeepSeek 精修歌词 SSE → MiniMax 生成 Demo。
 * `/`、`/create`、`/create/[projectId]` 均挂载此组件；前端永不接触 Provider Key。
 */
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { ProjectDetail } from '@/modules/projects/project-types'
import type { CreativeStreamEvent } from '@/modules/ai/lyric-assistant'
import type { GenerationResult } from '@/modules/generation/generation-types'
import { Sidebar } from './sidebar'
import { TopToolbar } from './top-toolbar'
import { MaterialPanel, type MaterialDraft } from './material-panel'
import { type Busy, type Phase } from './action-column'
import { BriefPanel } from './brief-panel'
import { VersionModal } from './version-modal'
import { ProviderModal } from './provider-modal'
import { ShareModal } from './share-modal'
import {
  DEFAULT_BRIEF,
  DEMO_CANDIDATES,
  PROVIDERS,
  type InputKind,
  type OutputType,
  type Provider,
} from '@/lib/inspire-data'

type SaveState = 'dirty' | 'saving' | 'saved' | 'error'
type ApiEnvelope<T> = { ok: boolean; data?: T; error?: { message?: string } }

const defaultLyrics = `路灯把影子拉得很长
我数着水洼里的光
没人问我要去哪儿
就这样走到天亮`

export function SongDraftWorkspace({ initialProject }: { initialProject?: ProjectDetail }) {
  const router = useRouter()
  const [projectId, setProjectId] = useState(initialProject?.id ?? '')
  const [projectTitle] = useState(initialProject?.title ?? '雨夜街角')
  const [draft, setDraft] = useState<MaterialDraft>({
    creativePrompt: initialProject?.description ?? '保留叙事感，让副歌更口语、更抓耳',
    lyrics: initialProject?.lyrics ?? defaultLyrics,
    instruction: '精修押韵，补一段副歌，控制在 4 行内',
  })
  const [originalLyrics, setOriginalLyrics] = useState(initialProject?.lyrics ?? defaultLyrics)
  const [isRefining, setIsRefining] = useState(false)
  const [refinementMessage, setRefinementMessage] = useState('')
  const [refinementError, setRefinementError] = useState('')
  const [generatedCandidates, setGeneratedCandidates] = useState<typeof DEMO_CANDIDATES>([])
  const [provider, setProvider] = useState<Provider>(PROVIDERS[0])
  const [outputType, setOutputType] = useState<OutputType>('song')
  const [selectedInputs, setSelectedInputs] = useState<InputKind[]>(['text', 'audio', 'image'])
  const [coverSet, setCoverSet] = useState(true)
  const [quantity, setQuantity] = useState(3)
  const [phase, setPhase] = useState<Phase>('brief')
  const [busy, setBusy] = useState<Busy>(false)
  const [mainId, setMainId] = useState('c1')
  const [saveState, setSaveState] = useState<SaveState>(initialProject ? 'saved' : 'dirty')
  const [saveError, setSaveError] = useState('')
  const [versionNo, setVersionNo] = useState(initialProject ? 1 : 0)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [providersOpen, setProvidersOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const candidates = useMemo(() => {
    if (generatedCandidates.length) return generatedCandidates
    const base = DEMO_CANDIDATES
    if (quantity <= base.length) return base.slice(0, quantity)
    const extra = Array.from({ length: quantity - base.length }, (_, i) => {
      const idx = base.length + i
      const candidate = base[idx % base.length]
      return {
        ...candidate,
        id: `c${idx + 1}`,
        title: `${projectTitle} · 候选 ${String.fromCharCode(65 + idx)}`,
        isMain: false,
      }
    })
    return [...base, ...extra]
  }, [generatedCandidates, projectTitle, quantity])

  function markDirty() {
    if (saveState !== 'saving') setSaveState('dirty')
  }

  function updateDraft(next: MaterialDraft) {
    setDraft(next)
    markDirty()
  }

  function toggleInput(kind: InputKind) {
    setSelectedInputs((previous) => previous.includes(kind)
      ? previous.filter((item) => item !== kind)
      : [...previous, kind])
    markDirty()
  }

  /** 无项目时先 POST /api/projects，再进入 /create/[id]。 */
  async function createProject() {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: projectTitle,
        description: draft.creativePrompt,
        lyrics: draft.lyrics,
      }),
    })
    const body = await response.json() as ApiEnvelope<ProjectDetail>
    if (!response.ok || !body.data?.id) throw new Error(body.error?.message || '项目保存失败')
    setProjectId(body.data.id)
    setVersionNo(1)
    return body.data.id
  }

  /** 保存草稿后 POST /api/generation-jobs，将候选映射到 BriefPanel。 */
  async function createVersion(id: string) {
    await saveDraft(id)
    const response = await fetch('/api/generation-jobs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: id,
        lyrics: draft.lyrics,
        creativeContext: { emotion: DEFAULT_BRIEF.mood.join('、'), source: 'v0-workspace' },
        brief: {
          theme: DEFAULT_BRIEF.theme,
          mood: DEFAULT_BRIEF.mood.join('、'),
          genre: DEFAULT_BRIEF.genre,
          tempo: DEFAULT_BRIEF.tempo,
        },
        idempotencyKey: crypto.randomUUID(),
      }),
    })
    const body = await response.json() as ApiEnvelope<GenerationResult>
    if (!response.ok || !body.data) throw new Error(body.error?.message || '版本保存失败')
    const mapped = body.data.candidates.map((candidate, index) => {
      const visual = DEMO_CANDIDATES[index % DEMO_CANDIDATES.length]!
      const seconds = Math.max(1, Math.round(candidate.durationMs / 1000))
      return {
        ...visual,
        id: candidate.versionId,
        title: candidate.title,
        providerId: 'minimax',
        mode: candidate.executionKind === 'real_external' ? 'real' as const : 'simulated' as const,
        duration: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
        isMain: index === 0,
        descriptor: candidate.executionKind === 'real_external' ? '由 MiniMax 根据当前歌词与创意简报真实生成。' : '当前未配置音乐模型，展示透明模拟 Demo。',
        audioUrl: candidate.audioUrl ?? undefined,
      }
    })
    setGeneratedCandidates(mapped)
    setMainId(mapped[0]?.id ?? mainId)
    setVersionNo((current) => current + Math.max(mapped.length, 1))
    setPhase('results')
  }

  /** PATCH /api/projects/[id]/draft：回写创作提示与当前歌词。 */
  async function saveDraft(id: string) {
    const response = await fetch(`/api/projects/${id}/draft`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ description: draft.creativePrompt, currentLyrics: draft.lyrics }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null) as ApiEnvelope<unknown> | null
      throw new Error(body?.error?.message || '草稿保存失败')
    }
  }

  /** 确保已有项目 id；新建后 router.replace 到工作台。 */
  async function ensureProject() {
    if (projectId) return projectId
    const createdId = await createProject()
    router.replace(`/create/${createdId}`)
    return createdId
  }

  /** 精修歌词：POST /api/creative-chat/stream，消费 SSE 写回 lyrics。 */
  async function refineLyrics() {
    if (isRefining || !draft.lyrics.trim()) return
    setIsRefining(true)
    setRefinementError('')
    setRefinementMessage('')
    setOriginalLyrics(draft.lyrics)
    try {
      const id = await ensureProject()
      const response = await fetch('/api/creative-chat/stream', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId: id, message: [draft.creativePrompt, draft.instruction].filter(Boolean).join('\n'), currentLyrics: draft.lyrics }),
      })
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null) as ApiEnvelope<unknown> | null
        throw new Error(body?.error?.message || '歌词精修失败')
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const packets = buffer.split('\n\n')
        buffer = packets.pop() ?? ''
        for (const packet of packets) {
          const line = packet.split('\n').find((item) => item.startsWith('data: '))
          if (!line) continue
          const event = JSON.parse(line.slice(6)) as CreativeStreamEvent
          if (event.type === 'message_delta') setRefinementMessage((current) => current + event.delta)
          if (event.type === 'lyrics_replace') setDraft((current) => ({ ...current, lyrics: event.lyrics }))
          if (event.type === 'error') throw new Error(event.message)
        }
      }
      setSaveState('saved')
    } catch (error) {
      setRefinementError(error instanceof Error ? error.message : '歌词精修失败')
    } finally {
      setIsRefining(false)
    }
  }

  async function save() {
    if (saveState === 'saving') return
    setSaveState('saving')
    setSaveError('')
    try {
      if (!projectId) {
        const createdId = await createProject()
        setSaveState('saved')
        router.replace(`/create/${createdId}`)
        return
      }
      await saveDraft(projectId)
      setSaveState('saved')
    } catch (error) {
      setSaveState('error')
      setSaveError(error instanceof Error ? error.message : '保存失败，请重试')
    }
  }

  async function handlePrimary() {
    if (busy) return
    if (phase === 'idle') {
      setBusy('analyze')
      window.setTimeout(() => {
        setBusy(false)
        setPhase('brief')
      }, 900)
    } else {
      setBusy('generate')
      setSaveError('')
      try {
        const id = await ensureProject()
        setPhase('results')
        await createVersion(id)
        setSaveState('saved')
      } catch (error) {
        setPhase('brief')
        setSaveError(error instanceof Error ? error.message : '生成失败，请重试')
      } finally {
        setBusy(false)
      }
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopToolbar
          provider={provider}
          onProviderChange={(next) => { setProvider(next); markDirty() }}
          outputType={outputType}
          onOutputChange={(next) => { setOutputType(next); markDirty() }}
          selectedInputs={selectedInputs}
          projectTitle={projectTitle}
          saveState={saveState}
          onSave={() => void save()}
          currentVersion={versionNo ? `v${versionNo}` : '新项目'}
          onOpenVersions={() => setVersionsOpen(true)}
          onOpenShare={() => setShareOpen(true)}
          onManageProviders={() => setProvidersOpen(true)}
        />
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto xl:grid-cols-[360px_minmax(0,1fr)] xl:overflow-hidden">
          <div className="border-b border-border bg-card/40 xl:border-b-0 xl:border-r xl:overflow-y-auto">
            <MaterialPanel
              selectedInputs={selectedInputs}
              onToggleInput={toggleInput}
              coverSet={coverSet}
              onSetCover={() => { setCoverSet((value) => !value); markDirty() }}
              draft={draft}
              onDraftChange={updateDraft}
              originalLyrics={originalLyrics}
              isRefining={isRefining}
              refinementMessage={refinementMessage}
              refinementError={refinementError}
              onRefine={() => void refineLyrics()}
            />
          </div>
          <div className="xl:overflow-y-auto">
            <BriefPanel
              phase={phase}
              busy={busy}
              brief={DEFAULT_BRIEF}
              provider={provider}
              quantity={quantity}
              candidates={candidates}
              mainId={mainId}
              onSetMain={(id) => { setMainId(id); markDirty() }}
              onSaveVersion={() => void save()}
            />
          </div>
        </div>
      </div>
      {saveError && <div role="alert" className="fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 rounded-lg bg-destructive px-4 py-2 text-sm text-white shadow-lg">{saveError}</div>}
      <VersionModal open={versionsOpen} onClose={() => setVersionsOpen(false)} />
      <ProviderModal open={providersOpen} onClose={() => setProvidersOpen(false)} current={provider} onSelect={setProvider} />
      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  )
}
