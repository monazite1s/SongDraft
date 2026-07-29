'use client'

import { Badge } from '@/components/inspire/ui'

export function WorkVersionInfoTab({
  version,
}: {
  version: {
    id: string
    name: string
    provider: string
    generatedAt: string
    inputs: string[]
    parentVersion?: string
    plan: {
      steps: string[]
    }
  }
}) {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">版本信息</h3>
        <div className="grid grid-cols-2 gap-4 bg-secondary border border-border rounded-lg p-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">版本名称</p>
            <p className="text-sm font-medium text-foreground">{version.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">生成提供者</p>
            <p className="text-sm font-medium text-foreground">{version.provider}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">生成时间</p>
            <p className="text-sm font-medium text-foreground">{version.generatedAt}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">父版本</p>
            <p className="text-sm font-medium text-foreground">{version.parentVersion || '无'}</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">生成计划</h3>
        <div className="space-y-2">
          {version.plan.steps.map((step, idx) => (
            <div key={idx} className="flex gap-3 p-3 bg-secondary border border-border rounded-lg">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-background flex items-center justify-center text-xs font-bold">
                {idx + 1}
              </div>
              <p className="text-sm text-foreground leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">使用的输入</h3>
        <div className="flex flex-wrap gap-2">
          {version.inputs.map((input) => (
            <Badge key={input} variant="outline">
              {input === 'lyrics' ? '歌词' : input === 'audio' ? '音频' : input === 'image' ? '图片' : input}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  )
}
