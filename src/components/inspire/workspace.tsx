'use client'

/**
 * SongDraft 唯一主创作容器（docs/development-state.md、docs/technical-design.md §2）
 *
 * 布局：Sidebar + TopToolbar + 等分栏（素材构建 / 成果，权重 1:1；未来详情半屏为 1:1:1）。
 * 编排项目创建 → 草稿保存 → DeepSeek 精修歌词 SSE → MiniMax 生成 Demo。
 * `/create`、`/create/[projectId]` 挂载此组件；前端永不接触 Provider Key。
 *
 * 跨路由保活：编辑态写入 sessionStorage，切回制作台时回填（避免纯 useState 随卸载丢失）。
 * 原始歌词与精修结果分轨：AI 只写 refinedLyrics，不覆盖 draft.lyrics。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

import type { ProjectDetail } from '@/modules/projects/project-types'
import type { CreativeStreamEvent } from '@/modules/ai/lyric-assistant'
import type { GenerationResult } from '@/modules/generation/generation-types'
import { DRAFT_KEYS, loadClientDraft, saveClientDraft, clearClientDraft } from '@/lib/client-draft-store'
import { Sidebar } from './sidebar'
import { TopToolbar } from './top-toolbar'
import { MaterialPanel, type MaterialDraft } from './material-panel'
import { WorkspacePrimaryAction, type Busy, type Phase } from './action-column'
import { BriefPanel } from './brief-panel'
import { VersionModal } from './version-modal'
import { ProviderModal } from './provider-modal'
import { ShareModal } from './share-modal'
import { SongDetailSheet, type SongDetailSheetCandidate } from './song-detail-sheet'
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

type WorkspaceSessionDraft = {
  draft: MaterialDraft
  originalLyrics: string
  refinedLyrics: string | null
  selectedInputs: InputKind[]
  coverSet: boolean
  quantity: number
  extraPrompt: string
  outputType: OutputType
  phase: Phase
  brief: CreativeBrief
  briefId: string | null
  projectTitle: string
}

function bootWorkspace(projectId: string, initialProject?: ProjectDetail): WorkspaceSessionDraft {
  const cached = loadClientDraft<WorkspaceSessionDraft>(DRAFT_KEYS.workspace(projectId))
  if (cached?.draft) return cached
  return {
    draft: {
      creativePrompt: initialProject?.description ?? '',
      lyrics: initialProject?.lyrics ?? '',
      instruction: '',
    },
    originalLyrics: initialProject?.lyrics ?? '',
    refinedLyrics: null,
    selectedInputs: ['text', 'audio', 'image'],
    coverSet: false,
    quantity: 3,
    extraPrompt: '',
    outputType: 'song',
    phase: 'idle',
    brief: DEFAULT_BRIEF,
    briefId: null,
    projectTitle: initialProject?.title ?? '未命名项目',
  }
}

export function SongDraftWorkspace({ initialProject }: { initialProject?: ProjectDetail }) {
  const router = useRouter()
  // 惰性读取会话草稿：软导航 remount 时从 memory/sessionStorage 恢复，无 effect setState。
  const [boot] = useState(() => bootWorkspace(initialProject?.id ?? '', initialProject))
  const [projectId, setProjectId] = useState(initialProject?.id ?? '')
  const [projectTitle] = useState(boot.projectTitle)
  const [draft, setDraft] = useState<MaterialDraft>(boot.draft)
  const [originalLyrics, setOriginalLyrics] = useState(boot.originalLyrics)
  const [refinedLyrics, setRefinedLyrics] = useState<string | null>(boot.refinedLyrics)
  const [isRefining, setIsRefining] = useState(false)
  const [refinementMessage, setRefinementMessage] = useState('')
  const [refinementError, setRefinementError] = useState('')
  const [generatedCandidates, setGeneratedCandidates] = useState<typeof DEMO_CANDIDATES>([])
  const [provider, setProvider] = useState<Provider>(PROVIDERS[0])
  const [outputType, setOutputType] = useState<OutputType>(boot.outputType)
  const [selectedInputs, setSelectedInputs] = useState<InputKind[]>(boot.selectedInputs)
  const [coverSet, setCoverSet] = useState(boot.coverSet)
  const [quantity, setQuantity] = useState(boot.quantity)
  const [extraPrompt, setExtraPrompt] = useState(boot.extraPrompt)
  /** 创意简报：由 /api/projects/[id]/brief 生成，替换静态 DEFAULT_BRIEF。 */
  const [brief, setBrief] = useState<CreativeBrief>(boot.brief)
  const [briefId, setBriefId] = useState<string | null>(boot.briefId)
  const [phase, setPhase] = useState<Phase>(boot.phase)
  const [busy, setBusy] = useState<Busy>(false)
  const [mainId, setMainId] = useState('c1')
  /** 已保存为正式版本的候选 ID（候选/版本拆分：未保存候选不会进入版本历史）。 */
  const [savedCandidateIds, setSavedCandidateIds] = useState<string[]>([])
  /** 已保存候选 → 正式版本 UUID 的映射（用于详情栏「进入全屏详情」链接）。 */
  const [savedVersionIdMap, setSavedVersionIdMap] = useState<Record<string, string>>({})
  const [saveState, setSaveState] = useState<SaveState>(initialProject ? 'saved' : 'dirty')
  const [saveError, setSaveError] = useState('')
  const [versionNo, setVersionNo] = useState(initialProject ? 1 : 0)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [providersOpen, setProvidersOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  /** 歌曲详情栏：选中的候选 id（SPEC §三.3，点击结果 Item 打开最右侧详情栏）。 */
  const [detailId, setDetailId] = useState<string | null>(null)
  const savingRef = useRef(false)

  /** 有效歌词：有精修结果时优先用于生成 / 落库，原始输入框仍保留 draft.lyrics。 */
  const effectiveLyrics = refinedLyrics?.trim() ? refinedLyrics : draft.lyrics

  // 仅写入外部存储，不在 effect 内 setState；跳过首次避免 SSR 空初值覆盖会话草稿。
  const skipPersist = useRef(true)
  useEffect(() => {
    if (skipPersist.current) {
      skipPersist.current = false
      return
    }
    saveClientDraft(DRAFT_KEYS.workspace(projectId), {
      draft,
      originalLyrics,
      refinedLyrics,
      selectedInputs,
      coverSet,
      quantity,
      extraPrompt,
      outputType,
      phase,
      brief,
      briefId,
      projectTitle,
    } satisfies WorkspaceSessionDraft)
  }, [projectId, draft, originalLyrics, refinedLyrics, selectedInputs, coverSet, quantity, extraPrompt, outputType, phase, brief, briefId, projectTitle])

  const candidates = useMemo(() => {
    if (!generatedCandidates.length) return []
    if (quantity <= generatedCandidates.length) return generatedCandidates.slice(0, quantity)
    return generatedCandidates
  }, [generatedCandidates, quantity])

  /** 详情栏数据：选中候选 + 版本信息 + 歌词摘要（SPEC §三.3）。 */
  const detailData = useMemo<SongDetailSheetCandidate | null>(() => {
    if (!detailId) return null
    const candidate = candidates.find((c) => c.id === detailId) ?? null
    if (!candidate) return null
    const isSaved = savedCandidateIds.includes(detailId)
    const versionId = savedVersionIdMap[detailId] ?? null
    return {
      candidate,
      versionNo: isSaved ? versionNo : null,
      versionId,
      lyricsExcerpt: effectiveLyrics.split('\n').slice(0, 8).join('\n'),
    }
  }, [detailId, candidates, savedCandidateIds, savedVersionIdMap, versionNo, effectiveLyrics])

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
        lyrics: effectiveLyrics,
      }),
    })
    const body = await response.json() as ApiEnvelope<ProjectDetail>
    if (!response.ok || !body.data?.id) throw new Error(body.error?.message || '项目保存失败')
    const createdId = body.data.id
    // 迁移会话草稿到新项目 key，避免 /create → /create/[id] remount 丢态。
    saveClientDraft(DRAFT_KEYS.workspace(createdId), {
      draft,
      originalLyrics,
      refinedLyrics,
      selectedInputs,
      coverSet,
      quantity,
      extraPrompt,
      outputType,
      phase,
      brief,
      briefId,
      projectTitle,
    } satisfies WorkspaceSessionDraft)
    clearClientDraft(DRAFT_KEYS.workspace(''))
    setProjectId(createdId)
    setVersionNo(1)
    return createdId
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
        lyrics: effectiveLyrics,
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
      body: JSON.stringify({ description: draft.creativePrompt, currentLyrics: effectiveLyrics }),
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

  /** 精修歌词：POST /api/creative-chat/stream；结果只写入 refinedLyrics，不覆盖原始输入。 */
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
          if (event.type === 'lyrics_replace') setRefinedLyrics(event.lyrics)
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
    if (savingRef.current || saveState === 'saving') return
    savingRef.current = true
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
    } finally {
      savingRef.current = false
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
    setSavedVersionIdMap({})
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
      // 保存结果按 candidateIds 顺序返回；建立 候选 id → 版本 uuid 映射。
      const mapping: Record<string, string> = {}
      body.data.saved.forEach((entry, index) => {
        const candidateId = candidateIds[index]
        if (candidateId) mapping[candidateId] = entry.id
      })
      setSavedVersionIdMap((prev) => ({ ...prev, ...mapping }))
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
          详情栏关闭时两栏 1:1；打开时切换三栏 1:1:1（SPEC §三.3 详情栏打开形成三栏）。
        */}
        <div
          className={cn(
            'grid min-h-0 flex-1 grid-cols-1 overflow-y-auto xl:overflow-hidden',
            detailId
              ? 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]'
              : 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
          )}
        >
          <div className="scrollbar-none min-w-0 border-b border-border bg-card/40 xl:border-b-0 xl:border-r xl:overflow-y-auto">
            <MaterialPanel
              selectedInputs={selectedInputs}
              onToggleInput={toggleInput}
              coverSet={coverSet}
              onSetCover={() => { setCoverSet((value) => !value); markDirty() }}
              draft={draft}
              onDraftChange={updateDraft}
              originalLyrics={originalLyrics}
              refinedLyrics={refinedLyrics}
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
          <div className="scrollbar-none min-w-0 xl:border-r xl:overflow-y-auto">
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
              onOpenDetail={(id) => setDetailId(id)}
              onSaveVersion={(ids) => void handleSaveVersion(ids)}
            />
          </div>
          {detailId && (
            <SongDetailSheet
              open
              onClose={() => setDetailId(null)}
              projectId={projectId}
              data={detailData}
            />
          )}
        </div>
      </div>
      {saveError && <div role="alert" className="fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 rounded-lg bg-destructive px-4 py-2 text-sm text-white shadow-lg">{saveError}</div>}
      <VersionModal open={versionsOpen} onClose={() => setVersionsOpen(false)} projectId={projectId} />
      <ProviderModal open={providersOpen} onClose={() => setProvidersOpen(false)} current={provider} onSelect={setProvider} />
      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  )
}
