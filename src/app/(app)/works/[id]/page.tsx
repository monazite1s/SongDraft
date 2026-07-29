'use client'

import { use, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Share2, RotateCcw, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sidebar } from '@/components/inspire/sidebar'
import { AudioPlayer } from '@/components/inspire/audio-player'
import { WorkLyricsTab } from '@/components/inspire/work-lyrics-tab'
import { WorkCommentsTab } from '@/components/inspire/work-comments-tab'
import { WorkVersionInfoTab } from '@/components/inspire/work-version-info-tab'
import { works } from '@/lib/inspire-data'

interface WorkDetailPageProps {
  params: Promise<{ id: string }>
}

export default function WorkDetailPage({ params }: WorkDetailPageProps) {
  const { id } = use(params)
  const work = works.find((w: any) => w.id === id) || works[0]
  const mainDemo = work.demos.find((d: any) => d.isMain) || work.demos[0]

  const [activeTab, setActiveTab] = useState<'lyrics' | 'comments' | 'version'>('lyrics')
  const [currentTime, setCurrentTime] = useState(0)

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-background px-8 py-4 flex items-center justify-between">
          <Link href="/works">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              返回
            </Button>
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <ExternalLink className="w-4 h-4" />
              在工作区打开
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <RotateCcw className="w-4 h-4" />
              重新生成
            </Button>
            <Button size="sm" className="gap-2">
              <Share2 className="w-4 h-4" />
              分享
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto px-8 py-8">
            {/* Upper section */}
            <div className="grid grid-cols-3 gap-8 mb-8">
              {/* Cover and metadata */}
              <div>
                <div className="relative aspect-square rounded-lg overflow-hidden bg-secondary border border-border mb-4">
                  <Image src={work.cover} alt={work.title} fill className="object-cover" />
                </div>

                <div className="space-y-3 bg-secondary border border-border rounded-lg p-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">标题</p>
                    <p className="text-sm font-semibold text-foreground">{work.title}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">作者</p>
                    <p className="text-sm text-foreground">{work.author}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">主版本</p>
                    <p className="text-sm font-medium text-foreground">{mainDemo.title}</p>
                  </div>

                  <div className="pt-3 border-t border-border space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">创建于</span>
                      <span className="text-xs text-foreground">
                        {new Date(work.created).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">更新于</span>
                      <span className="text-xs text-foreground">
                        {new Date(work.updated).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Audio player and info */}
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground mb-3">{work.description}</p>

                <div className="bg-secondary border border-border rounded-lg p-6 mb-6">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-4">
                    音频播放
                  </p>
                  <AudioPlayer
                    durationLabel={mainDemo.duration}
                    seed={mainDemo.bpm}
                    current={currentTime}
                    onSeek={setCurrentTime}
                    onTimeUpdate={setCurrentTime}
                    className="mb-4"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>BPM: {mainDemo.bpm}</span>
                    <span className="px-2 py-1 bg-background rounded text-foreground font-medium">
                      {mainDemo.mode === 'simulated' ? '模拟输出' : '真实生成'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-secondary border border-border rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-2">输入类型</p>
                    <div className="flex flex-wrap gap-1">
                      {work.inputTypes.map((type) => (
                        <span
                          key={type}
                          className="inline-block px-2 py-1 text-xs bg-background text-muted-foreground rounded"
                        >
                          {type === 'text'
                            ? '文本'
                            : type === 'audio'
                              ? '音频'
                              : type === 'image'
                                ? '图片'
                                : '视频'}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-secondary border border-border rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-2">版本数量</p>
                    <p className="text-2xl font-bold text-foreground">{work.demos.length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-t border-border pt-8">
              <div className="flex gap-8 border-b border-border mb-6">
                <button
                  onClick={() => setActiveTab('lyrics')}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'lyrics'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  歌词
                </button>
                <button
                  onClick={() => setActiveTab('comments')}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'comments'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  评论
                </button>
                <button
                  onClick={() => setActiveTab('version')}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'version'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  版本信息
                </button>
              </div>

              <div className="pb-8">
                {activeTab === 'lyrics' && (
                  <WorkLyricsTab lyrics={`[Intro]
一个人走在雨夜的街角

[Verse 1]
霓虹灯映在湿润的地面上
行人撑伞匆匆路过
我站在咖啡馆的窗边
看着这座城市的冷漠与温暖

[Chorus]
在雨夜街角思考人生
灯光中闪烁着记忆
这一刻属于我
也属于每一个停留的人

[Bridge]
时间在流动
雨水在低诉
心在这一刻停止了跳跃`} />
                )}
                {activeTab === 'comments' && <WorkCommentsTab demoId={mainDemo.id} />}
                {activeTab === 'version' && (
                  <WorkVersionInfoTab
                    version={{
                      id: mainDemo.id,
                      name: mainDemo.title,
                      provider: mainDemo.providerId,
                      generatedAt: '2024-01-15 14:30',
                      inputs: work.inputTypes,
                      parentVersion: undefined,
                      plan: {
                        steps: [
                          '分析输入材料（歌词、音频、图像）',
                          '生成创意简报（主题、风格、情绪）',
                          '规划生成步骤和能力路由',
                          '使用选定提供者生成演示',
                          '应用用户反馈和优化',
                        ],
                      },
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
