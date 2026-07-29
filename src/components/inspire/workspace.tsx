'use client'

/**
 * SongDraft 唯一主创作容器（docs/development-state.md、docs/technical-design.md §2）
 *
 * 布局：Sidebar + TopToolbar + 等分栏（素材构建 / 成果，权重 1:1；未来详情半屏为 1:1:1）。
 * 编排项目创建 → 草稿保存 → DeepSeek 精修歌词 SSE → MiniMax 生成 Demo。
 * `/create`、`/create/[projectId]` 挂载此组件；前端永不接触 Provider Key。
 */
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { ProjectDetail } from '@/modules/projects/project-types'
import type { CreativeStreamEvent } from '@/modules/ai/lyric-assistant'
import type { GenerationResult } from '@/modules/generation/generation-types'
import { Sidebar } from './sidebar'
import { TopToolbar } from './top-toolbar'
import { MaterialPanel, type MaterialDraft } from './material-panel'
import { WorkspacePrimaryAction, type Busy, type Phase } from './action-column'
import { BriefPanel } from './brief-panel'
import { VersionModal } from './version-modal'
import { ProviderModal } from './provider-modal'
import { ShareModal } from './share-modal'
import {
  DEFAULT_BRIEF,
  DEMO_CANDIDATES,
  PROVIDERS,
  type CreativeBrief,
  type InputKind,
  type OutputType,
  type Provider,
} from '@/lib/inspire-data'

type SaveState = 'dirty' | 'saving' | 'saved' | 'error'
type ApiEnvelope<T> = { ok: boolean; data?: T; error?: { message?: string } }
/** 创意简报接口响应（仅取前端需要的字段，避免引入 server-only 类型）。 */
type BriefResponse = { id: string; payload: CreativeBrief; confirmedAt: string | null }

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
  const [extraPrompt, setExtraPrompt] = useState('')
  /** 创意简报：由 /api/projects/[id]/brief 生成，替换静态 DEFAULT_BRIEF。 */
  const [brief, setBrief] = useState<CreativeBrief>(DEFAULT_BRIEF)
  const [briefId, setBriefId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [busy, setBusy] = useState<Busy>(false)
  const [mainId, setMainId] = useState('c1')
  /** 已保存为正式版本的候选 ID（候选/版本拆分：未保存候选不会进入版本历史）。 */
  const [savedCandidateIds, setSavedCandidateIds] = useState<string[]>([])
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
        briefId,
        lyrics: draft.lyrics,
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
        id: candidate.id,
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

  /** 生成创意简报：确保项目存在 → POST /api/projects/[id]/brief → 写入真实简报。 */
  async function generateBrief() {
    if (busy) return
    setSaveError('')
    setBusy('analyze')
    try {
      const id = await ensureProject()
      const response = await fetch(`/api/projects/${id}/brief`, { method: 'POST' })
      const body = await response.json() as ApiEnvelope<BriefResponse>
      if (!response.ok || !body.data) throw new Error(body.error?.message || '简报生成失败')
      setBrief(body.data.payload)
      setBriefId(body.data.id)
      setPhase('brief')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '简报生成失败')
    } finally {
      setBusy(false)
    }
  }

  /** 生成 Demo：「生成」即确认当前简报，直接调用生成 API 创建候选。 */
  async function generateDemo() {
    if (busy) return
    setBusy('generate')
    setSaveError('')
    setSavedCandidateIds([])
    try {
      const id = await ensureProject()
      // 生成即确认：先把当前 outputType/额外要求/数量 PATCH 进简报，再据此生成（P0-3）。
      if (briefId) {
        await fetch(`/api/projects/${id}/brief/${briefId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...brief, outputType, extraPrompt, quantity }),
        })
      }
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

  /** 将选中的未保存候选保存为正式版本（互为兄弟节点），成功后标记已保存。 */
  async function handleSaveVersion(candidateIds: string[]) {
    if (!projectId || busy || candidateIds.length === 0) return
    setSaveError('')
    try {
      const response = await fetch('/api/generation-candidates/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId, candidateIds }),
      })
      const body = await response.json() as ApiEnvelope<{ saved: Array<{ id: string; versionNo: number }> }>
      if (!response.ok || !body.data) throw new Error(body.error?.message || '保存版本失败')
      setSavedCandidateIds((prev) => {
        const next = new Set(prev)
        candidateIds.forEach((id) => next.add(id))
        return [...next]
      })
      setVersionNo((current) => current + body.data!.saved.length)
      setSaveState('saved')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '保存版本失败')
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopToolbar
          provider={provider}
          onProviderChange={(next) => { setProvider(next); markDirty() }}
          selectedInputs={selectedInputs}
          projectTitle={projectTitle}
          saveState={saveState}
          onSave={() => void save()}
          currentVersion={versionNo ? `v${versionNo}` : '新项目'}
          onOpenVersions={() => setVersionsOpen(true)}
          onOpenShare={() => setShareOpen(true)}
          onManageProviders={() => setProvidersOpen(true)}
        />
        {/*
          等分栏：minmax(0,1fr) + 子项 min-w-0，避免内容 min-content 把某一栏撑宽。
          当前两栏 1:1；未来详情半屏打开时改为三列 1:1:1（同一套 1fr 权重）。
        */}
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:overflow-hidden">
          <div className="scrollbar-none min-w-0 border-b border-border bg-card/40 xl:border-b-0 xl:border-r xl:overflow-y-auto">
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
              footer={
                <WorkspacePrimaryAction
                  busy={busy}
                  selectedInputs={selectedInputs}
                  onPrimary={generateBrief}
                />
              }
            />
          </div>
          <div className="scrollbar-none min-w-0 xl:overflow-y-auto">
            <BriefPanel
              phase={phase}
              busy={busy}
              brief={brief}
              outputType={outputType}
              onOutputChange={(next) => { setOutputType(next); markDirty() }}
              extraPrompt={extraPrompt}
              onExtraPromptChange={setExtraPrompt}
              quantity={quantity}
              onQuantityChange={(next) => { setQuantity(next); markDirty() }}
              onGenerate={() => void generateDemo()}
              candidates={candidates}
              savedCandidateIds={savedCandidateIds}
              mainId={mainId}
              onSetMain={(id) => { setMainId(id); markDirty() }}
              onSaveVersion={(ids) => void handleSaveVersion(ids)}
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
