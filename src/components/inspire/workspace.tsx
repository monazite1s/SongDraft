'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { ProjectDetail } from '@/modules/projects/project-types'
import { Sidebar } from './sidebar'
import { TopToolbar } from './top-toolbar'
import { MaterialPanel, type MaterialDraft } from './material-panel'
import { ActionColumn, type Busy, type Phase } from './action-column'
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
  }, [projectTitle, quantity])

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

  async function createVersion(id: string) {
    const response = await fetch('/api/generation-jobs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: id,
        brief: {
          theme: DEFAULT_BRIEF.theme,
          mood: DEFAULT_BRIEF.mood.join('、'),
          genre: DEFAULT_BRIEF.genre,
          tempo: DEFAULT_BRIEF.tempo,
        },
        outputType,
        idempotencyKey: crypto.randomUUID(),
      }),
    })
    const body = await response.json() as ApiEnvelope<{ candidates: Array<{ versionId: string }> }>
    if (!response.ok || !body.data) throw new Error(body.error?.message || '版本保存失败')
    setVersionNo((current) => current + Math.max(body.data?.candidates.length ?? 1, 1))
    setPhase('results')
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
      await createVersion(projectId)
      setSaveState('saved')
    } catch (error) {
      setSaveState('error')
      setSaveError(error instanceof Error ? error.message : '保存失败，请重试')
    }
  }

  function handlePrimary() {
    if (busy) return
    if (phase === 'idle') {
      setBusy('analyze')
      window.setTimeout(() => {
        setBusy(false)
        setPhase('brief')
      }, 900)
    } else {
      setPhase('results')
      setBusy('generate')
      window.setTimeout(() => setBusy(false), 1100)
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
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto xl:grid-cols-[360px_248px_minmax(0,1fr)] xl:overflow-hidden">
          <div className="border-b border-border bg-card/40 xl:border-b-0 xl:border-r xl:overflow-y-auto">
            <MaterialPanel
              selectedInputs={selectedInputs}
              onToggleInput={toggleInput}
              coverSet={coverSet}
              onSetCover={() => { setCoverSet((value) => !value); markDirty() }}
              draft={draft}
              onDraftChange={updateDraft}
            />
          </div>
          <div className="border-b border-border bg-muted/20 xl:border-b-0 xl:border-r xl:overflow-y-auto">
            <ActionColumn
              phase={phase}
              busy={busy}
              onPrimary={handlePrimary}
              quantity={quantity}
              onQuantityChange={(next) => { setQuantity(next); markDirty() }}
              selectedInputs={selectedInputs}
              outputType={outputType}
              provider={provider}
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
