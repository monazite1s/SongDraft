'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, RadioTags, SectionCard } from '@/components/inspire/ui'
import { logoutAction } from '@/modules/auth/actions'
import { loadDefaultQuantity, saveDefaultQuantity } from '@/lib/client-draft-store'

type ProfileView = {
  id: string
  email: string
  displayName: string
  avatarObjectKey: string | null
}

type ProfileEnvelope = { ok?: boolean; data?: ProfileView }

const QUANTITY_OPTIONS: { value: '1' | '3' | '5' | '10'; label: string }[] = [
  { value: '1', label: '1 首' },
  { value: '3', label: '3 首' },
  { value: '5', label: '5 首' },
  { value: '10', label: '10 首' },
]

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileView | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [profileLoading, setProfileLoading] = useState(true)

  // 默认生成数量：渲染期惰性读取 localStorage（避免 effect 内 setState 触发级联渲染）。
  const [defaultQuantity, setDefaultQuantity] = useState<'1' | '3' | '5' | '10'>(() => {
    const stored = loadDefaultQuantity()
    if (stored === 1 || stored === 3 || stored === 5 || stored === 10) {
      return String(stored) as '1' | '3' | '5' | '10'
    }
    return '3'
  })
  const [quantitySaved, setQuantitySaved] = useState(false)

  const [savingName, setSavingName] = useState(false)
  const [nameSavedAt, setNameSavedAt] = useState<number | null>(null)
  const [error, setError] = useState('')

  // 拉取当前用户信息（独立请求，fetch 回调内 setState 合规）。
  useEffect(() => {
    fetch('/api/profile')
      .then(async (r) => {
        const body = (await r.json()) as ProfileEnvelope
        if (r.ok && body.ok && body.data) {
          setProfile(body.data)
          setDisplayName(body.data.displayName ?? '')
        }
      })
      .catch(() => {
        /* 取数失败保持未登录态 */
      })
      .finally(() => setProfileLoading(false))
  }, [])

  async function handleSaveName(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = displayName.trim()
    if (!trimmed) {
      setError('请输入昵称')
      return
    }
    if (trimmed.length > 40) {
      setError('昵称最多 40 个字符')
      return
    }
    setSavingName(true)
    setError('')
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName: trimmed }),
      })
      const body = (await response.json()) as ProfileEnvelope
      if (!response.ok || !body.data) {
        throw new Error('昵称保存失败')
      }
      setProfile(body.data)
      setDisplayName(body.data.displayName ?? trimmed)
      setNameSavedAt(Date.now())
    } catch {
      setError('昵称保存失败，请重试')
    } finally {
      setSavingName(false)
    }
  }

  function handleSaveQuantity() {
    saveDefaultQuantity(Number(defaultQuantity))
    setQuantitySaved(true)
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-background px-8 py-6">
        <h1 className="text-3xl font-bold text-foreground">设置</h1>
        <p className="mt-1 text-sm text-muted-foreground">账户、生成默认值与登录会话</p>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl px-8 py-8">
          <div className="flex flex-col gap-6">
            {/* 账户区 */}
            <SectionCard title="账户">
              <div className="space-y-4 p-4">
                {profileLoading ? (
                  <p className="text-sm text-muted-foreground">加载中…</p>
                ) : profile ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-brand-muted text-sm font-semibold text-brand">
                        {(profile.displayName || '?').slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {profile.displayName || '未命名用户'}
                        </p>
                        <p className="truncate text-xs text-muted-foreground" title={profile.email}>
                          {profile.email || '—'}
                        </p>
                      </div>
                    </div>
                    <form onSubmit={handleSaveName} className="space-y-2">
                      <Field label="昵称" hint="1–40 个字符">
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => {
                            setDisplayName(e.target.value)
                            setNameSavedAt(null)
                          }}
                          maxLength={40}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                          placeholder="给自己起个昵称"
                        />
                      </Field>
                      <div className="flex items-center gap-3">
                        <Button type="submit" size="sm" disabled={savingName}>
                          {savingName ? '保存中…' : '保存昵称'}
                        </Button>
                        {nameSavedAt && (
                          <span className="text-xs text-success">已保存</span>
                        )}
                        {error && (
                          <span className="text-xs text-destructive" role="alert">{error}</span>
                        )}
                      </div>
                    </form>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    当前为本地访客，登录后可同步昵称与作品。
                  </p>
                )}
              </div>
            </SectionCard>

            {/* 生成默认值区 */}
            <SectionCard title="生成默认值">
              <div className="space-y-4 p-4">
                <Field label="默认生成数量" hint="进入制作台时的初始值">
                  <RadioTags
                    value={defaultQuantity}
                    options={QUANTITY_OPTIONS}
                    onChange={(value) => {
                      setDefaultQuantity(value)
                      setQuantitySaved(false)
                    }}
                  />
                </Field>
                <div className="flex items-center gap-3">
                  <Button size="sm" onClick={handleSaveQuantity}>
                    保存默认值
                  </Button>
                  {quantitySaved && (
                    <span className="text-xs text-success">已保存，下次进入制作台生效</span>
                  )}
                </div>
              </div>
            </SectionCard>

            {/* 登出 */}
            {profile && (
              <SectionCard title="登录会话">
                <div className="flex items-center justify-between gap-3 p-4">
                  <p className="text-sm text-muted-foreground">退出当前账号，返回登录页。</p>
                  <form action={logoutAction}>
                    <Button type="submit" variant="outline" size="sm">
                      退出登录
                    </Button>
                  </form>
                </div>
              </SectionCard>
            )}

            <p className="text-xs text-muted-foreground">
              AI 生成由服务端环境变量统一配置。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
