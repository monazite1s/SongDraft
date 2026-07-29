'use client'

/**
 * 版本历史弹窗（docs/SPEC.md 版本树）。
 *
 * 用 React Flow 渲染版本谱系：
 * - 数据源：GET /api/projects/[id]/versions（真实版本树，替换静态 mock）。
 * - 父子关系：DemoVersionView.parentId（demo_versions.parentId / mock snapshot.parentId）。
 * - 背景：半透明灰色圆点（BackgroundVariant.Dots），外层 p-4 提供上下固定留白；
 * - 节点：树形卡片展示每个版本，hover 弹出详细信息；
 * - 点击节点选中，激活底部「删除（红色危险 + 二次确认）/ 应用」操作。
 *   - 删除 → DELETE /api/projects/[id]/versions/[versionId]
 *   - 应用 → POST /api/projects/[id]/versions/[versionId]/restore
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  ReactFlowProvider,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Crown, Trash2, Check, MousePointerClick, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Modal } from './modal'
import { ExecutionKind } from '@/shared/contracts/domain'

/** 版本视图（与 DemoVersionView 对齐，仅取前端需要的字段）。 */
export interface VersionView {
  id: string
  versionNo: number
  title: string
  variation: string
  isMain: boolean
  createdAt: string
  executionKind: ExecutionKind
  hasAudio: boolean
  audioUrl?: string | null
  restoredFromVersionId?: string | null
  parentId?: string | null
}

type ApiEnvelope<T> = { ok: boolean; data?: T; error?: { message?: string } }

type VersionNodeData = {
  version: VersionView
  selected: boolean
}

const NODE_WIDTH = 232
const NODE_GAP_Y = 118
const TOP_MARGIN = 8

/** 单个版本节点：卡片 + 顶部/底部连接桩 + hover 详情弹出。 */
function VersionNode({ data }: NodeProps) {
  const { version, selected } = data as VersionNodeData
  const [hovered, setHovered] = useState(false)

  function fmt(iso: string) {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'relative cursor-pointer rounded-xl border bg-card px-3 py-2.5 shadow-sm transition-colors',
        selected ? 'border-brand ring-2 ring-brand/30' : 'border-border hover:border-brand/50',
      )}
      style={{ width: NODE_WIDTH }}
    >
      <Handle type="target" position={Position.Top} className="!size-2 !border-border !bg-border" />
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">v{version.versionNo}</span>
        {version.isMain && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-medium text-brand-foreground">
            <Crown className="size-2.5" />
            当前
          </span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">{fmt(version.createdAt)}</span>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="truncate text-[11px] text-muted-foreground">{version.title}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!size-2 !border-border !bg-border" />

      {hovered && (
        <div
          role="tooltip"
          className="pointer-events-none absolute left-full top-1/2 z-20 ml-3 w-60 -translate-y-1/2 rounded-lg border border-border bg-popover p-3 text-left shadow-lg"
        >
          <p className="text-xs font-semibold text-foreground">v{version.versionNo} · {version.title}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{version.variation}</p>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{version.executionKind === 'real_external' ? '真实生成' : '模拟输出'}</span>
            <span>{fmt(version.createdAt)}</span>
          </div>
          {version.restoredFromVersionId && (
            <p className="mt-1 text-[10px] text-muted-foreground/80">恢复自历史版本</p>
          )}
        </div>
      )}
    </div>
  )
}

const nodeTypes = { version: VersionNode }

function VersionTree({ projectId }: { projectId: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [versions, setVersions] = useState<VersionView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await fetch(`/api/projects/${projectId}/versions`, { method: 'GET' })
      const body = await r.json() as ApiEnvelope<VersionView[]>
      if (!r.ok || !body.data) throw new Error(body.error?.message || '加载版本失败')
      setVersions(body.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载版本失败')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  // 数据获取的 loading 态在 effect 内同步设置是合规用法（非派生 state）。
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void reload() }, [reload])

  const { nodes, edges } = useMemo(() => {
    // versions 默认 versionNo 降序（最新在前）；树形自上而下展示为最早在顶（升序）。
    const ordered = [...versions].sort((a, b) => a.versionNo - b.versionNo)
    const flowNodes: Node[] = ordered.map((version, index) => ({
      id: version.id,
      type: 'version',
      position: { x: 0, y: TOP_MARGIN + index * NODE_GAP_Y },
      data: { version, selected: selectedId === version.id } satisfies VersionNodeData,
      selectable: false,
      draggable: false,
    }))
    // 父子边：parentId 指向存在的版本时建边，保持版本树连通。
    const flowEdges: Edge[] = versions
      .filter((v) => v.parentId && versions.some((p) => p.id === v.parentId))
      .map((v) => ({
        id: `${v.parentId}-${v.id}`,
        source: v.parentId!,
        target: v.id,
        type: 'smoothstep',
        style: { stroke: '#cbd5e1', strokeWidth: 1.5 },
      }))
    return { nodes: flowNodes, edges: flowEdges }
  }, [versions, selectedId])

  const selected = versions.find((v) => v.id === selectedId) ?? null

  async function handleDelete() {
    if (!selectedId) return
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    setBusy(true)
    setError('')
    try {
      const r = await fetch(`/api/projects/${projectId}/versions/${selectedId}`, { method: 'DELETE' })
      const body = await r.json() as ApiEnvelope<{ ok: boolean }>
      if (!r.ok || !body.data) throw new Error(body.error?.message || '删除版本失败')
      setSelectedId(null)
      setConfirmingDelete(false)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除版本失败')
    } finally {
      setBusy(false)
    }
  }

  async function handleRestore() {
    if (!selectedId) return
    setBusy(true)
    setError('')
    try {
      const r = await fetch(`/api/projects/${projectId}/versions/${selectedId}/restore`, { method: 'POST' })
      const body = await r.json() as ApiEnvelope<VersionView>
      if (!r.ok || !body.data) throw new Error(body.error?.message || '应用版本失败')
      setSelectedId(null)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : '应用版本失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="h-[52vh] w-full border-b border-border p-4">
        <div className="relative h-full w-full overflow-hidden rounded-lg border border-border bg-background">
          {loading ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              加载版本树…
            </div>
          ) : versions.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              暂无已保存版本，保存候选后将出现在这里
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={(_, node) => { setSelectedId(node.id); setConfirmingDelete(false) }}
              onPaneClick={() => { setSelectedId(null); setConfirmingDelete(false) }}
              fitView
              fitViewOptions={{ padding: 0.25 }}
              panOnScroll
              nodesConnectable={false}
              nodesDraggable={false}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={22} size={1.6} color="#94a3b8" />
              <Controls showInteractive={false} />
            </ReactFlow>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="mx-5 mt-2 rounded-md bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <MousePointerClick className="size-3.5 shrink-0" />
          {selected ? (
            <span className="truncate">
              已选择 <span className="font-medium text-foreground">v{selected.versionNo}</span> · {selected.title}
            </span>
          ) : (
            '点击版本节点选择，hover 查看详情'
          )}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="destructive"
            size="sm"
            disabled={!selectedId || busy}
            onClick={() => void handleDelete()}
          >
            <Trash2 className="size-3.5" />
            {confirmingDelete ? '再次点击确认删除' : '删除'}
          </Button>
          <Button size="sm" disabled={!selectedId || busy} onClick={() => void handleRestore()}>
            <Check className="size-3.5" />
            应用
          </Button>
        </div>
      </div>
    </>
  )
}

export function VersionModal({
  open,
  onClose,
  projectId,
}: {
  open: boolean
  onClose: () => void
  projectId: string
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="版本历史"
      description={`项目 ${projectId ? projectId.slice(0, 8) : ''} 的版本树`}
      className="max-w-2xl"
    >
      <ReactFlowProvider>
        <VersionTree projectId={projectId} />
      </ReactFlowProvider>
    </Modal>
  )
}
