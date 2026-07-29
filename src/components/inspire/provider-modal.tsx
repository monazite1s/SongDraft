'use client'

import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  PROVIDERS,
  type InputKind,
  type Provider,
} from '@/lib/inspire-data'
import { Modal } from './modal'
import { ModeTag, StatusDot } from './ui'

const CAPS: { kind: InputKind; label: string }[] = [
  { kind: 'text', label: '文本' },
  { kind: 'audio', label: '音频' },
  { kind: 'image', label: '图像' },
  { kind: 'video', label: '视频' },
]

const STATUS_LABEL = {
  ready: '可用',
  limited: '受限',
  offline: '离线',
} as const

export function ProviderModal({
  open,
  onClose,
  current,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  current: Provider
  onSelect: (p: Provider) => void
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="供应商与能力"
      description="选择生成供应商，并查看各自支持的输入类型与真实 / 模拟状态。"
      className="max-w-2xl"
    >
      <div className="scrollbar-none max-h-[60vh] space-y-3 overflow-y-auto p-5">
        {PROVIDERS.map((p) => {
          const active = p.id === current.id
          return (
            <div
              key={p.id}
              className={cn(
                'rounded-xl border p-4 transition-colors',
                active ? 'border-brand/40 ring-1 ring-brand/20' : 'border-border',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="mt-1">
                    <StatusDot status={p.status} />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">
                        {p.name}
                      </h3>
                      <ModeTag mode={p.mode} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.vendor} · {STATUS_LABEL[p.status]} · {p.latency}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    onSelect(p)
                    onClose()
                  }}
                  disabled={active}
                  className={cn(
                    'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    active
                      ? 'cursor-default bg-brand-muted text-brand'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90',
                  )}
                >
                  {active ? '使用中' : '切换'}
                </button>
              </div>

              <p className="mt-2.5 text-xs text-muted-foreground">{p.note}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {CAPS.map((cap) => {
                  const ok = p.supports.includes(cap.kind)
                  return (
                    <span
                      key={cap.kind}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]',
                        ok
                          ? 'border-border bg-muted text-foreground'
                          : 'border-dashed border-border text-muted-foreground/60',
                      )}
                    >
                      {ok ? (
                        <Check className="size-3 text-success" />
                      ) : (
                        <Minus className="size-3" />
                      )}
                      {cap.label}
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}

        <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
          能力说明：切换供应商后，若已选素材包含其不支持的类型，工作台会显示警告并在生成时自动忽略这些素材。标注「模拟输出」的供应商仅用于流程演示。
        </p>
      </div>
    </Modal>
  )
}
