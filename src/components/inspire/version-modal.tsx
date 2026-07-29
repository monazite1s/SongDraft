'use client'

/**
 * 版本历史弹窗（docs/SPEC.md 版本树）。
 *
 * 用 React Flow 渲染版本谱系：
 * - 背景：半透明灰色圆点（BackgroundVariant.Dots），外层 p-4 提供上下固定留白；
 * - 节点：树形卡片展示每个版本，hover 弹出详细信息；
 * - 点击节点选中，激活底部「删除 / 应用」操作。
 */
import { useMemo, useState } from 'react'
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
import { Crown, Trash2, Check, MousePointerClick } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OUTPUT_TYPES, VERSIONS, type DemoVersion } from '@/lib/inspire-data'
import { Button } from '@/components/ui/button'
import { Modal } from './modal'

type VersionNodeData = {
  version: DemoVersion
  outputLabel: string
  selected: boolean
}

const NODE_WIDTH = 232
const NODE_GAP_Y = 118
const TOP_MARGIN = 8

/** 单个版本节点：卡片 + 顶部/底部连接桩 + hover 详情弹出。 */
function VersionNode({ data }: NodeProps) {
  const { version, outputLabel, selected } = data as VersionNodeData
  const [hovered, setHovered] = useState(false)

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
        <span className="text-sm font-semibold text-foreground">{version.label}</span>
        {version.current && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-medium text-brand-foreground">
            <Crown className="size-2.5" />
            当前
          </span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">{version.time}</span>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-foreground">{outputLabel}</span>
        <span className="truncate text-[11px] text-muted-foreground">{version.author}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!size-2 !border-border !bg-border" />

      {hovered && (
        <div
          role="tooltip"
          className="pointer-events-none absolute left-full top-1/2 z-20 ml-3 w-60 -translate-y-1/2 rounded-lg border border-border bg-popover p-3 text-left shadow-lg"
        >
          <p className="text-xs font-semibold text-foreground">
            {version.label} · {version.author}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{version.note}</p>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>输出：{outputLabel}</span>
            <span>{version.time}</span>
          </div>
        </div>
      )}
    </div>
  )
}

const nodeTypes = { version: VersionNode }

function VersionTree() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { nodes, edges } = useMemo(() => {
    // VERSIONS 默认「最新在前」(v4→v1)；树形自上而下展示为「最早在顶」(v1→v4)。
    const ordered = [...VERSIONS].reverse()
    const flowNodes: Node[] = ordered.map((version, index) => {
      const output = OUTPUT_TYPES.find((o) => o.id === version.outputType)!
      return {
        id: version.id,
        type: 'version',
        position: { x: 0, y: TOP_MARGIN + index * NODE_GAP_Y },
        data: {
          version,
          outputLabel: output.label,
          selected: selectedId === version.id,
        } satisfies VersionNodeData,
        selectable: false,
        draggable: false,
      }
    })
    const flowEdges: Edge[] = VERSIONS.filter((v) => v.parent).map((v) => ({
      id: `${v.parent}-${v.id}`,
      source: v.parent!,
      target: v.id,
      type: 'smoothstep',
      style: { stroke: '#cbd5e1', strokeWidth: 1.5 },
    }))
    return { nodes: flowNodes, edges: flowEdges }
  }, [selectedId])

  const selected = VERSIONS.find((v) => v.id === selectedId) ?? null

  return (
    <>
      <div className="h-[52vh] w-full border-b border-border p-4">
        <div className="relative h-full w-full overflow-hidden rounded-lg border border-border bg-background">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
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
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <MousePointerClick className="size-3.5 shrink-0" />
          {selected ? (
            <span className="truncate">
              已选择 <span className="font-medium text-foreground">{selected.label}</span> · {selected.note}
            </span>
          ) : (
            '点击版本节点选择，hover 查看详情'
          )}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" disabled={!selectedId}>
            <Trash2 className="size-3.5" />
            删除
          </Button>
          <Button size="sm" disabled={!selectedId}>
            <Check className="size-3.5" />
            应用
          </Button>
        </div>
      </div>
    </>
  )
}

export function VersionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="版本历史"
      description={`雨夜街角 · 共 ${VERSIONS.length} 个版本`}
      className="max-w-2xl"
    >
      <ReactFlowProvider>
        <VersionTree />
      </ReactFlowProvider>
    </Modal>
  )
}
