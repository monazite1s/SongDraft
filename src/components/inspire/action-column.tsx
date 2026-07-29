/**
 * 生成控制（docs/SPEC.md §6.2）。
 *
 * 旧的三栏「生成控制列」已按 SPEC 删除；这里保留工作台与简报共享的 Phase/Busy 类型与
 * 生成数量候选值，并提供固定在素材面板底部的主操作按钮 WorkspacePrimaryAction。
 * 主按钮负责「生成创意简报」；生成 Demo 的入口位于创意简报下方的操作区。
 */
'use client'

import { Loader2, Sparkles } from 'lucide-react'
import { type InputKind } from '@/lib/inspire-data'

export type Phase = 'idle' | 'brief' | 'results'
export type Busy = false | 'analyze' | 'generate'

/** 创意简报「生成数量」候选值（docs/SPEC.md §0）。 */
export const QUANTITIES = [1, 3, 5, 10] as const

/**
 * 固定在左侧素材面板底部的主操作按钮：生成 / 重新生成创意简报。
 * 无素材或繁忙时禁用。
 */
export function WorkspacePrimaryAction({
  busy,
  selectedInputs,
  onPrimary,
}: {
  busy: Busy
  selectedInputs: InputKind[]
  onPrimary: () => void
}) {
  const disabled = !!busy || selectedInputs.length === 0
  const analyzing = busy === 'analyze'

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={onPrimary}
        disabled={disabled}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {analyzing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {analyzing ? '正在生成简报…' : '生成简报'}
      </button>
      <p className="text-center text-[11px] text-muted-foreground">
        解析已选素材并生成结构化创意简报
      </p>
    </div>
  )
}
