'use client'

import { useState } from 'react'
import { Plus, Edit2, Trash2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sidebar } from '@/components/inspire/sidebar'
import { Badge } from '@/components/inspire/ui'

interface Provider {
  id: string
  name: string
  type: string
  model: string
  status: 'connected' | 'error' | 'inactive'
  capabilities: string[]
  isDefault: boolean
}

export default function SettingsPage() {
  const [providers, setProviders] = useState<Provider[]>([
    {
      id: '1',
      name: 'OpenAI GPT-4',
      type: 'Text Generation',
      model: 'gpt-4-turbo',
      status: 'connected',
      capabilities: ['Creative Brief', 'Lyrics Generation', 'Music Theory Analysis'],
      isDefault: true,
    },
    {
      id: '2',
      name: 'Runway ML',
      type: 'Music Generation',
      model: 'melody-v2',
      status: 'connected',
      capabilities: ['Melody Generation', 'Arrangement'],
      isDefault: false,
    },
    {
      id: '3',
      name: 'Mubert',
      type: 'Music Generation',
      model: 'production-v1',
      status: 'error',
      capabilities: ['Background Music', 'Ambient'],
      isDefault: false,
    },
  ])

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingProvider, setEditingProvider] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'Text Generation',
    model: '',
    apiKey: '',
    baseUrl: '',
  })

  const handleAddProvider = () => {
    if (formData.name && formData.model) {
      const newProvider: Provider = {
        id: Date.now().toString(),
        name: formData.name,
        type: formData.type,
        model: formData.model,
        status: 'connected',
        capabilities: [],
        isDefault: false,
      }
      setProviders([...providers, newProvider])
      setFormData({ name: '', type: 'Text Generation', model: '', apiKey: '', baseUrl: '' })
      setShowAddModal(false)
    }
  }

  const handleDeleteProvider = (id: string) => {
    setProviders(providers.filter((p) => p.id !== id))
  }

  const handleSetDefault = (id: string) => {
    setProviders(
      providers.map((p) => ({
        ...p,
        isDefault: p.id === id,
      }))
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-background px-8 py-6">
          <h1 className="text-3xl font-bold text-foreground">设置</h1>
          <p className="text-sm text-muted-foreground mt-1">管理提供商和生成配置</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-4xl mx-auto px-8 py-8 space-y-8">
            {/* Provider Configuration */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">提供者配置</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    配置AI模型和音乐生成提供者
                  </p>
                </div>
                <Button
                  onClick={() => setShowAddModal(true)}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  添加提供者
                </Button>
              </div>

              <div className="space-y-3">
                {providers.map((provider) => (
                  <div
                    key={provider.id}
                    className="bg-card border border-border rounded-lg p-4 flex items-start justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-foreground">{provider.name}</h3>
                        {provider.isDefault && (
                          <Badge variant="outline">默认</Badge>
                        )}
                        <div
                          className={`flex items-center gap-1 text-xs font-medium ${
                            provider.status === 'connected'
                              ? 'text-green-600'
                              : provider.status === 'error'
                                ? 'text-red-600'
                                : 'text-gray-600'
                          }`}
                        >
                          {provider.status === 'connected' ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <AlertCircle className="w-4 h-4" />
                          )}
                          {provider.status === 'connected'
                            ? '已连接'
                            : provider.status === 'error'
                              ? '连接失败'
                              : '未激活'}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-muted-foreground">类型：</span>
                          <span className="text-foreground">{provider.type}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">模型：</span>
                          <span className="text-foreground font-mono">{provider.model}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">能力数：</span>
                          <span className="text-foreground">{provider.capabilities.length}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {provider.capabilities.map((cap) => (
                          <Badge key={cap} variant="secondary">
                            {cap}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4 flex-shrink-0">
                      {!provider.isDefault && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetDefault(provider.id)}
                          className="text-xs"
                        >
                          设为默认
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => setEditingProvider(provider.id)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-1"
                        onClick={() => handleDeleteProvider(provider.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Generation Preferences */}
            <section className="border-t border-border pt-8">
              <h2 className="text-lg font-semibold text-foreground mb-6">生成偏好</h2>

              <div className="space-y-4 bg-card border border-border rounded-lg p-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    默认输出类型
                  </label>
                  <select className="w-full px-4 py-2 bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                    <option>歌曲演示</option>
                    <option>配乐演示</option>
                    <option>旋律草图</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    默认生成数量
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    defaultValue="3"
                    className="w-full px-4 py-2 bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    默认显示真实/模拟标签
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="disclosure" defaultChecked className="w-4 h-4" />
                      <span className="text-sm text-foreground">是</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="disclosure" className="w-4 h-4" />
                      <span className="text-sm text-foreground">否</span>
                    </label>
                  </div>
                </div>

                <div className="pt-4 border-t border-border flex justify-end gap-2">
                  <Button variant="outline">取消</Button>
                  <Button>保存</Button>
                </div>
              </div>
            </section>

            {/* API Configuration */}
            <section className="border-t border-border pt-8">
              <h2 className="text-lg font-semibold text-foreground mb-6">API 配置</h2>

              <div className="space-y-4 bg-card border border-border rounded-lg p-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    API 基础 URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://api.example.com"
                    className="w-full px-4 py-2 bg-secondary border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    API 密钥
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••••••••••"
                    className="w-full px-4 py-2 bg-secondary border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    请求超时（秒）
                  </label>
                  <input
                    type="number"
                    defaultValue="30"
                    className="w-full px-4 py-2 bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="pt-4 border-t border-border flex justify-end gap-2">
                  <Button variant="outline">取消</Button>
                  <Button>测试连接</Button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Add Provider Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="border-b border-border px-6 py-4">
              <h2 className="font-semibold text-foreground">添加提供者</h2>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  提供者名称
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如：OpenAI GPT-4"
                  className="w-full px-4 py-2 bg-secondary border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  类型
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-2 bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option>Text Generation</option>
                  <option>Music Generation</option>
                  <option>Image Generation</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  模型
                </label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="例如：gpt-4-turbo"
                  className="w-full px-4 py-2 bg-secondary border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  API 密钥
                </label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="输入您的 API 密钥"
                  className="w-full px-4 py-2 bg-secondary border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="border-t border-border px-6 py-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddModal(false)
                  setFormData({ name: '', type: 'Text Generation', model: '', apiKey: '', baseUrl: '' })
                }}
              >
                取消
              </Button>
              <Button onClick={handleAddProvider}>添加</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
