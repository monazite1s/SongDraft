'use client'

import { GitBranch, RotateCcw, Eye, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OUTPUT_TYPES, VERSIONS } from '@/lib/inspire-data'
import { Modal } from './modal'

export function VersionModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="版本历史"
      description="雨夜街角 · 共 4 个版本"
      className="max-w-xl"
    >
      <div className="max-h-[60vh] overflow-y-auto p-5">
        <ol className="relative space-y-4 border-l border-border pl-6">
          {VERSIONS.map((v) => {
            const output = OUTPUT_TYPES.find((o) => o.id === v.outputType)!
            return (
              <li key={v.id} className="relative">
                <span
                  className={cn(
                    'absolute -left-[27px] top-1 flex size-4 items-center justify-center rounded-full ring-4 ring-card',
                    v.current ? 'bg-brand' : 'bg-border',
                  )}
                >
                  {v.current && <span className="size-1.5 rounded-full bg-brand-foreground" />}
                </span>
                <div
                  className={cn(
                    'rounded-xl border p-3 transition-colors',
                    v.current
                      ? 'border-brand/40 bg-brand-muted/40'
                      : 'border-border bg-card hover:bg-muted/40',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <GitBranch className="size-3.5 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">
                      {v.label}
                    </span>
                    {v.current && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-medium text-brand-foreground">
                        <Crown className="size-3" />
                        当前
                      </span>
                    )}
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {v.time}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-foreground">{v.note}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded bg-muted px-1.5 py-0.5">
                        {output.label}
                      </span>
                      {v.author}
                    </span>
                    {!v.current && (
                      <div className="flex gap-1">
                        <button className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                          <Eye className="size-3" />
                          预览
                        </button>
                        <button className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-brand transition-colors hover:bg-brand-muted">
                          <RotateCcw className="size-3" />
                          恢复此版本
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </Modal>
  )
}
