'use client'

/**
 * 制作台分享弹窗（docs/SPEC.md §7、§8 分享权限）。
 * - 生成分享链接 / 有效期 / 允许评论开关（原始 token 仅创建时返回）。
 * - 访问者管理：列出已授权访问者，支持撤销（白名单后端已实现并验证通过）。
 * - 保持 `<ShareModal open onClose />` props 兼容，projectId 从 /create/[projectId] 路径推导。
 */
import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import QRCode from 'qrcode'
import { Check, Copy, ExternalLink, Loader2, MessageSquare, Ear, Lock, ShieldOff, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from './modal'

type ApiEnvelope<T> = { ok: boolean; data?: T; error?: { message?: string } }
type ShareView = { id: string; versionId: string; allowComments: boolean; expiresAt: string | null; revokedAt: string | null; createdAt: string }
type CreatedShare = { id: string; token: string; expiresAt: string | null; allowComments: boolean }
type Grant = {
  id: string
  accessorId: string
  accessorDisplayName: string
  accessorEmail: string
  firstAccessedAt: string | null
  lastAccessedAt: string | null
  revokedAt: string | null
}

function shareUrl(token: string) {
  if (typeof window === 'undefined') return `/s/${token}`
  return `${window.location.origin}/s/${token}`
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return '—'
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${m}/${day}`
}

export function ShareModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const pathname = usePathname()
  const projectId = deriveProjectId(pathname)

  const [activeShare, setActiveShare] = useState<ShareView | null>(null)
  const [loadingShare, setLoadingShare] = useState(false)
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [qr, setQr] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [permission, setPermission] = useState<'listen' | 'comment'>('comment')
  const [expiryDays, setExpiryDays] = useState<number>(7)
  const [creating, setCreating] = useState(false)
  const [shareError, setShareError] = useState('')

  // 访问者授权（白名单）
  const [grants, setGrants] = useState<Grant[]>([])
  const [grantsLoading, setGrantsLoading] = useState(false)
  const [grantsError, setGrantsError] = useState('')
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const link = createdToken ? shareUrl(createdToken) : ''

  /** 加载当前项目最近的有效分享链接（用于复用 shareId 加载访问者）。 */
  const loadShare = useCallback(async () => {
    if (!projectId) { setActiveShare(null); return }
    setLoadingShare(true)
    setShareError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/shares`)
      const body = await res.json() as ApiEnvelope<ShareView[]>
      if (!res.ok || !body.data) throw new Error(body.error?.message || '加载分享失败')
      const active = body.data.find((s) => !s.revokedAt) ?? null
      setActiveShare(active)
    } catch (e) {
      setShareError(e instanceof Error ? e.message : '加载分享失败')
      setActiveShare(null)
    } finally {
      setLoadingShare(false)
    }
  }, [projectId])

  /** 加载某分享的访问者授权列表（含已撤销，便于审计）。 */
  const loadGrants = useCallback(async (shareId: string) => {
    if (!projectId) return
    setGrantsLoading(true)
    setGrantsError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/shares/${shareId}/grants`)
      const body = await res.json() as ApiEnvelope<Grant[]>
      if (!res.ok || !body.data) throw new Error(body.error?.message || '加载访问者失败')
      setGrants(body.data)
    } catch (e) {
      setGrantsError(e instanceof Error ? e.message : '加载访问者失败')
      setGrants([])
    } finally {
      setGrantsLoading(false)
    }
  }, [projectId])

  // 弹窗打开态切换：在渲染期间重置一次性状态（原始 token 仅创建时返回，重开清空）。
  // 采用「渲染期间调整 state」替代 effect 内同步 setState，避免级联渲染。
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setCreatedToken(null)
      setCopied(false)
      setQr('')
    }
  }

  // 打开时加载已有分享；effect 只触发异步 fetch，setState 在 async 回调内（合规）。
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadShare()
  }, [open, loadShare])

  // 切换分享后清空访问者（渲染期间调整 state，非 effect 内 setState）。
  const [prevShareId, setPrevShareId] = useState<string | null>(activeShare?.id ?? null)
  const currentShareId = activeShare?.id ?? null
  if (currentShareId !== prevShareId) {
    setPrevShareId(currentShareId)
    setGrants([])
    setGrantsError('')
  }

  // 选中分享后加载访问者；effect 只触发异步 fetch，setState 在 async 回调内（合规）。
  useEffect(() => {
    if (!open || !activeShare) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadGrants(activeShare.id)
  }, [open, activeShare, loadGrants])

  // 生成二维码：仅在拥有 token 时触发；effect 只发起点异步，setState 在 Promise 回调内（合规）。
  useEffect(() => {
    if (!open || !createdToken) return
    QRCode.toDataURL(shareUrl(createdToken), {
      margin: 1,
      width: 320,
      color: { dark: '#26303f', light: '#ffffff' },
    })
      .then(setQr)
      .catch(() => setQr(''))
  }, [open, createdToken])

  async function createShare() {
    if (!projectId || creating) return
    setCreating(true)
    setShareError('')
    try {
      // 需要一个 versionId：复用当前活动分享的 versionId，没有则提示先保存版本。
      const versionId = activeShare?.versionId
      if (!versionId) throw new Error('请先生成并保存至少一个 Demo 版本再分享')
      const allowComments = permission === 'comment'
      const expiresAt = expiryDays > 0
        ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
        : null
      const res = await fetch(`/api/projects/${projectId}/shares`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ versionId, allowComments, expiresAt }),
      })
      const body = await res.json() as ApiEnvelope<CreatedShare>
      if (!res.ok || !body.data) throw new Error(body.error?.message || '生成分享失败')
      setCreatedToken(body.data.token)
      // 刷新分享与访问者列表（新链接尚未有访问者）。
      await loadShare()
    } catch (e) {
      setShareError(e instanceof Error ? e.message : '生成分享失败')
    } finally {
      setCreating(false)
    }
  }

  async function revokeGrant(grantId: string) {
    if (!projectId || !activeShare || revokingId) return
    setRevokingId(grantId)
    setGrantsError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/shares/${activeShare.id}/grants/${grantId}`, {
        method: 'DELETE',
      })
      const body = await res.json() as ApiEnvelope<{ id: string; revokedAt: string }>
      if (!res.ok || !body.data) throw new Error(body.error?.message || '撤销失败')
      setGrants((prev) => prev.map((g) => g.id === grantId ? { ...g, revokedAt: body.data!.revokedAt } : g))
    } catch (e) {
      setGrantsError(e instanceof Error ? e.message : '撤销失败')
    } finally {
      setRevokingId(null)
    }
  }

  function copy() {
    if (!createdToken) return
    navigator.clipboard?.writeText(shareUrl(createdToken))
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  // displayToken 非空表示有「本次会话生成」的可展示链接；已存在的链接不展示原始 token（仅创建时返回）。
  const displayToken = createdToken
  const canCreate = Boolean(projectId) && Boolean(activeShare?.versionId)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="分享 Demo"
      description="生成链接或二维码，邀请协作者试听并在时间点评论；原始链接仅生成时可见。"
    >
      <div className="space-y-5 p-5">
        {/* 链接与二维码：创建后才显示真实 token */}
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex size-40 items-center justify-center rounded-xl border border-border bg-background p-2">
            {displayToken && qr ? (
              <Image
                src={qr}
                alt="分享链接二维码"
                width={144}
                height={144}
                className="size-36"
                unoptimized
              />
            ) : displayToken ? (
              <div className="size-36 animate-pulse rounded-md bg-muted" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
                <Lock className="size-5" aria-hidden />
                <span>生成链接后展示二维码</span>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {displayToken ? '扫码在移动端试听' : '协作者首次访问会自动加入白名单'}
          </p>
        </div>

        {displayToken ? (
          <div className="flex items-center gap-2">
            <div className="flex h-9 min-w-0 flex-1 items-center rounded-lg border border-input bg-muted/40 px-3">
              <span className="truncate text-sm text-foreground">{link}</span>
            </div>
            <button
              onClick={copy}
              className={cn(
                'flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors',
                copied
                  ? 'bg-success/15 text-success-foreground'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
              )}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? '已复制' : '复制'}
            </button>
          </div>
        ) : null}

        {/* 权限与有效期 */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-foreground">协作者权限</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'listen' as const, icon: Ear, label: '仅试听', hint: '不可评论' },
              {
                id: 'comment' as const,
                icon: MessageSquare,
                label: '可评论',
                hint: '支持时间点反馈',
              },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setPermission(opt.id)}
                className={cn(
                  'flex items-start gap-2 rounded-lg border p-2.5 text-left transition-colors',
                  permission === opt.id
                    ? 'border-brand/40 bg-brand-muted/50'
                    : 'border-border hover:bg-muted',
                )}
              >
                <opt.icon
                  className={cn(
                    'mt-0.5 size-4',
                    permission === opt.id ? 'text-brand' : 'text-muted-foreground',
                  )}
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">
                    {opt.label}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {opt.hint}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 text-xs">
          <label className="flex items-center gap-1.5 text-muted-foreground">
            <Lock className="size-3.5" />
            有效期
            <select
              value={expiryDays}
              onChange={(e) => setExpiryDays(Number(e.target.value))}
              className="ml-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-foreground"
            >
              <option value={7}>7 天</option>
              <option value={30}>30 天</option>
              <option value={0}>永久</option>
            </select>
          </label>
          <button
            onClick={createShare}
            disabled={creating || !canCreate}
            className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {creating ? <Loader2 className="size-3.5 animate-spin" /> : <ExternalLink className="size-3.5" />}
            {displayToken ? '重新生成' : '生成链接'}
          </button>
        </div>

        {shareError ? <p role="alert" className="text-sm text-destructive">{shareError}</p> : null}
        {loadingShare && !activeShare ? (
          <p className="text-xs text-muted-foreground">正在加载现有分享…</p>
        ) : null}
        {!activeShare && !loadingShare && projectId ? (
          <p className="text-[11px] text-muted-foreground">当前项目尚无可分享的版本，请先生成并保存 Demo。</p>
        ) : null}
        {!projectId ? (
          <p className="text-[11px] text-muted-foreground">请先保存项目后再分享。</p>
        ) : null}

        {/* 访问者管理：列出已授权访问者 + 撤销 */}
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <Users className="size-3.5 text-muted-foreground" aria-hidden />
            <p className="text-xs font-medium text-foreground">访问者</p>
            {grants.length ? (
              <span className="text-[11px] text-muted-foreground">
                （{grants.filter((g) => !g.revokedAt).length} 有效 / {grants.length} 总计）
              </span>
            ) : null}
          </div>
          {grantsLoading ? (
            <p className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              正在加载访问者…
            </p>
          ) : grants.length ? (
            <ul className="space-y-1.5">
              {grants.map((g) => (
                <li
                  key={g.id}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2',
                    g.revokedAt && 'opacity-60',
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {g.accessorDisplayName}
                      {g.revokedAt ? (
                        <span className="ml-1.5 inline-flex items-center rounded-full border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                          已撤销
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      授权 {fmtDate(g.firstAccessedAt)} · 最近访问 {fmtDate(g.lastAccessedAt)}
                    </p>
                  </div>
                  {!g.revokedAt ? (
                    <button
                      onClick={() => void revokeGrant(g.id)}
                      disabled={revokingId === g.id}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      {revokingId === g.id ? <Loader2 className="size-3 animate-spin" /> : <ShieldOff className="size-3" />}
                      撤销
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              {activeShare ? '尚无访问者，协作者首次通过链接访问后将自动加入。' : '生成链接后展示访问者。'}
            </p>
          )}
          {grantsError ? <p role="alert" className="mt-1.5 text-xs text-destructive">{grantsError}</p> : null}
        </div>
      </div>
    </Modal>
  )
}

/** 从 /create/[projectId] 路径推导当前项目 ID；无项目（如 /create）返回空串。 */
function deriveProjectId(pathname: string | null): string {
  if (!pathname) return ''
  const match = pathname.match(/^\/create\/([^/]+)/)
  return match?.[1] && match[1] !== 'new' ? match[1] : ''
}
