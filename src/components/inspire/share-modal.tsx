'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import QRCode from 'qrcode'
import { Check, Copy, ExternalLink, MessageSquare, Ear, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from './modal'

const SHARE_URL = 'https://inspire2demo.app/s/rainy-corner-v4'

export function ShareModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [qr, setQr] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [permission, setPermission] = useState<'listen' | 'comment'>('comment')

  useEffect(() => {
    if (!open) return
    QRCode.toDataURL(SHARE_URL, {
      margin: 1,
      width: 320,
      color: { dark: '#26303f', light: '#ffffff' },
    })
      .then(setQr)
      .catch(() => setQr(''))
  }, [open])

  function copy() {
    navigator.clipboard?.writeText(SHARE_URL)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="分享 Demo"
      description="生成链接或二维码，邀请协作者试听并在时间点评论。"
    >
      <div className="space-y-5 p-5">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex size-40 items-center justify-center rounded-xl border border-border bg-background p-2">
            {qr ? (
              <Image
                src={qr}
                alt="分享链接二维码"
                width={144}
                height={144}
                className="size-36"
                unoptimized
              />
            ) : (
              <div className="size-36 animate-pulse rounded-md bg-muted" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">扫码在移动端试听</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex h-9 min-w-0 flex-1 items-center rounded-lg border border-input bg-muted/40 px-3">
            <span className="truncate text-sm text-foreground">{SHARE_URL}</span>
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

        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Lock className="size-3.5" />
            链接 7 天后过期
          </span>
          <Link
            href="/s/rainy-corner-v4"
            className="flex items-center gap-1 font-medium text-brand hover:underline"
          >
            打开协作者视图
            <ExternalLink className="size-3.5" />
          </Link>
        </div>
      </div>
    </Modal>
  )
}
