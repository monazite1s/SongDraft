'use client'

/**
 * 应用内帮助文档（VitePress 式：左目录 + 右正文）。
 * 数据源：help-content.ts；锚点滚动 + 可复制示例块。
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronRight, Copy, LifeBuoy } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { HELP_NAV, SLEEPLESS_NIGHT, sleeplessCopyBlocks, type CopyBlock } from './help-content'

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* 剪贴板不可用时静默失败 */
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
      {copied ? '已复制' : '复制'}
    </button>
  )
}

function CopyCard({ block }: { block: CopyBlock }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <span className="text-xs font-medium text-foreground">{block.label}</span>
        <CopyButton value={block.value} />
      </div>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap px-3 py-2.5 font-sans text-[13px] leading-relaxed text-foreground/90">
        {block.value}
      </pre>
    </div>
  )
}

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 text-lg font-semibold tracking-tight text-foreground">
      <a href={`#${id}`} className="group inline-flex items-center gap-1.5 no-underline hover:text-brand">
        {children}
        <span className="opacity-0 transition-opacity group-hover:opacity-50">#</span>
      </a>
    </h2>
  )
}

function SubTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="scroll-mt-24 text-base font-semibold text-foreground">
      <a href={`#${id}`} className="group inline-flex items-center gap-1.5 no-underline hover:text-brand">
        {children}
        <span className="opacity-0 transition-opacity group-hover:opacity-50">#</span>
      </a>
    </h3>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">{children}</ul>
}

function Ol({ children }: { children: React.ReactNode }) {
  return <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">{children}</ol>
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[12px] text-foreground">
      {children}
    </code>
  )
}

function HelpArticle() {
  const copyBlocks = useMemo(() => sleeplessCopyBlocks(), [])

  return (
    <article className="mx-auto max-w-3xl space-y-12 px-5 py-8 lg:px-10 lg:py-10">
      <header className="space-y-2 border-b border-border pb-8">
        <div className="flex items-center gap-2 text-brand">
          <LifeBuoy className="size-4" />
          <span className="text-sm font-medium">帮助与文档</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">SongDraft 使用指南</h1>
        <P>
          从灵感记录到 Demo 生成的完整路径说明。可按目录跳转；文末「不眠之夜」示例可直接复制到制作台联调。
        </P>
      </header>

      {/* —— 开始 —— */}
      <section className="space-y-8">
        <SectionTitle id="start">开始</SectionTitle>

        <div className="space-y-3">
          <SubTitle id="intro">产品简介</SubTitle>
          <P>
            SongDraft 是以<strong className="font-medium text-foreground">歌曲</strong>为组织单位的音乐灵感与 Demo
            协作工具。你先把歌词、哼唱、画面留下来，再整理成创意简报（Brief），最后生成可试听的 Demo 并保存版本。
          </P>
          <Ul>
            <li>灵感记录：低压力捕捉，不必立刻决定属于哪首歌。</li>
            <li>制作台：素材构建 → 生成简报 → 生成 Demo。</li>
            <li>歌曲库：按歌曲查看版本与关联灵感。</li>
          </Ul>
        </div>

        <div className="space-y-3">
          <SubTitle id="concepts">核心概念</SubTitle>
          <Ul>
            <li>
              <strong className="font-medium text-foreground">灵感</strong>：一条可版本化的记录（文本 / 音频 / 图像）。
            </li>
            <li>
              <strong className="font-medium text-foreground">歌曲</strong>：创作的容器；一首歌对应一个项目，多版本仍属同一首歌。
            </li>
            <li>
              <strong className="font-medium text-foreground">制作台</strong>：把素材变成 Brief 与 Demo 的工作区。
            </li>
            <li>
              <strong className="font-medium text-foreground">创意简报</strong>：主题、情绪、速度、乐器等结构化设定，驱动生成。
            </li>
            <li>
              <strong className="font-medium text-foreground">Demo / 版本</strong>：生成的候选可试听；确认后保存为歌曲版本树节点。
            </li>
          </Ul>
        </div>
      </section>

      {/* —— 快速上手 —— */}
      <section className="space-y-8">
        <SectionTitle id="guide">快速上手</SectionTitle>

        <div className="space-y-3">
          <SubTitle id="flow-inspire">记录灵感并归档</SubTitle>
          <Ol>
            <li>
              打开 <InlineCode>/</InlineCode> 灵感记录，选择录音 / 图片 / 文本。
            </li>
            <li>填写可选标题、情绪、速度感觉；内容会自动沉淀为版本。</li>
            <li>保存时选择「新建项目」或「已有项目」，把灵感挂到项目下。</li>
            <li>
              也可在 <Link href="/inspirations" className="text-brand hover:underline">灵感库</Link> 稍后归档。
            </li>
          </Ol>
        </div>

        <div className="space-y-3">
          <SubTitle id="flow-studio">制作台出 Demo</SubTitle>
          <Ol>
            <li>
              进入 <Link href="/create" className="text-brand hover:underline">制作台</Link>，新建或导入项目。
            </li>
            <li>在「素材构建」写入歌词 / 创作提示；精修歌词为可选，可跳过直接「生成简报」。</li>
            <li>确认右侧 Brief（主题、速度、乐器、额外要求、生成数量）。</li>
            <li>点击生成 Demo，试听候选；需要时保存为版本。</li>
          </Ol>
        </div>

        <div className="space-y-3">
          <SubTitle id="flow-library">歌曲库与版本</SubTitle>
          <Ol>
            <li>
              在 <Link href="/works" className="text-brand hover:underline">歌曲库</Link> 查看全部歌曲。
            </li>
            <li>进入歌曲详情可浏览歌曲版本与关联灵感。</li>
            <li>制作台内的版本树可应用历史节点，把 Prompt / 歌词 / Demo 载回当前工作区。</li>
          </Ol>
        </div>
      </section>

      {/* —— 完整示例 —— */}
      <section className="space-y-8">
        <SectionTitle id="demo">完整示例</SectionTitle>

        <div className="space-y-3">
          <SubTitle id="demo-goal">不眠之夜 · 目标</SubTitle>
          <P>
            用一首慢板城市情歌验证全流程：歌词要韵律和谐、朗朗上口；Brief 字段齐全；可不经精修直接生成简报与
            Demo。歌曲名建议使用 <InlineCode>{SLEEPLESS_NIGHT.title}</InlineCode>。
          </P>
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">预期听感</p>
            <p className="mt-1 leading-relaxed">
              {SLEEPLESS_NIGHT.genre} · {SLEEPLESS_NIGHT.tempo} · 情绪：{SLEEPLESS_NIGHT.moods.join(' / ')}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <SubTitle id="demo-lyrics">歌词</SubTitle>
          <P>结构：主歌 → 预副歌 → 副歌 → 主歌 → 桥段 → 副歌。副歌短句重复，便于记忆。</P>
          <CopyCard block={{ label: '原始歌词 / 文本', value: SLEEPLESS_NIGHT.lyrics }} />
        </div>

        <div className="space-y-3">
          <SubTitle id="demo-brief">主题与编曲设定</SubTitle>
          <P>生成简报后，可在右侧 Brief 中对照或粘贴下列字段做微调。</P>
          <div className="grid gap-3 sm:grid-cols-2">
            {copyBlocks
              .filter((b) =>
                ['主题', '情绪标签', '风格', '速度', '乐器', '歌词概要', '旋律特征', '视觉参考'].includes(b.label),
              )
              .map((block) => (
                <CopyCard key={block.label} block={block} />
              ))}
          </div>
        </div>

        <div className="space-y-3">
          <SubTitle id="demo-prompt">Prompt 与演唱</SubTitle>
          <P>创作提示与处理指令用于精修与生成引导；演唱技巧可作为额外生成要求的补充说明。</P>
          <div className="space-y-3">
            {copyBlocks
              .filter((b) =>
                ['创作提示', '处理指令', '演唱技巧', '额外生成要求', '项目名称'].includes(b.label),
              )
              .map((block) => (
                <CopyCard key={block.label} block={block} />
              ))}
          </div>
        </div>

        <div className="space-y-3">
          <SubTitle id="demo-steps">建议操作路径</SubTitle>
          <Ol>
            <li>
              歌曲库点「新建歌曲」，名称填 <InlineCode>不眠之夜</InlineCode>，进入歌曲详情后点「进入制作台」；
              或在制作台弹窗直接创建同名项目。
            </li>
            <li>
              素材 Tab「歌词」：粘贴创作提示、原始歌词；启用「纳入本次生成」。精修可选。
            </li>
            <li>
              点「生成简报」。若 Brief 偏空，把主题 / 速度 / 乐器 / 额外要求粘贴进对应字段。
            </li>
            <li>
              输出类型选歌曲，数量建议 <InlineCode>{String(SLEEPLESS_NIGHT.quantity)}</InlineCode>，再生成 Demo。
            </li>
            <li>试听后保存满意版本；回到歌曲库应能看到同一首歌曲卡片（不因多版本拆成多张）。</li>
          </Ol>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href="/works">
              <Button type="button" size="sm">
                打开歌曲库
                <ChevronRight className="size-3.5" />
              </Button>
            </Link>
            <Link href="/create">
              <Button type="button" size="sm" variant="outline">
                打开制作台
                <ChevronRight className="size-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* —— 参考 —— */}
      <section className="space-y-8">
        <SectionTitle id="ref">参考</SectionTitle>

        <div className="space-y-3">
          <SubTitle id="sitemap">页面地图</SubTitle>
          <Ul>
            <li>
              <InlineCode>/</InlineCode> 灵感记录
            </li>
            <li>
              <InlineCode>/create</InlineCode> 制作台入口 · <InlineCode>/create/[projectId]</InlineCode> 项目工作台
            </li>
            <li>
              <InlineCode>/inspirations</InlineCode> 灵感库
            </li>
            <li>
              <InlineCode>/works</InlineCode> 歌曲库 · <InlineCode>/works/[projectId]</InlineCode> 歌曲详情
            </li>
            <li>
              <InlineCode>/settings</InlineCode> 设置 · <InlineCode>/help</InlineCode> 本页
            </li>
          </Ul>
        </div>

        <div className="space-y-3">
          <SubTitle id="faq">常见问题</SubTitle>
          <Ul>
            <li>
              <strong className="font-medium text-foreground">只填歌曲名能创建吗？</strong> 可以。制作台与歌曲库都支持先建空项目，再补素材。
            </li>
            <li>
              <strong className="font-medium text-foreground">必须先精修歌词吗？</strong>{' '}
              不必。精修是可选步骤，有素材即可直接生成简报。
            </li>
            <li>
              <strong className="font-medium text-foreground">歌曲库新建为何不进制作台？</strong>{' '}
              歌曲库有独立新建弹窗，创建后进入歌曲详情；制作台入口另有引导弹窗。
            </li>
          </Ul>
        </div>
      </section>
    </article>
  )
}

export function HelpDocsClient() {
  const [activeId, setActiveId] = useState('intro')
  const flatIds = useMemo(
    () => HELP_NAV.flatMap((g) => [g.id, ...(g.children?.map((c) => c.id) ?? [])]),
    [],
  )

  useEffect(() => {
    const nodes = flatIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el))

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        const first = visible[0]?.target.id
        if (first) setActiveId(first)
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: [0, 1] },
    )

    nodes.forEach((n) => observer.observe(n))
    return () => observer.disconnect()
  }, [flatIds])

  function jump(id: string) {
    setActiveId(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex min-h-0 flex-1">
      {/* 桌面文档目录 */}
      <nav
        aria-label="文档目录"
        className="hidden w-56 shrink-0 overflow-y-auto border-r border-border bg-card/40 px-3 py-6 lg:block"
      >
        <p className="px-2 pb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          目录
        </p>
        <ul className="space-y-4">
          {HELP_NAV.map((group) => (
            <li key={group.id}>
              <button
                type="button"
                onClick={() => jump(group.id)}
                className={cn(
                  'w-full rounded-md px-2 py-1 text-left text-xs font-semibold transition-colors',
                  activeId === group.id ? 'text-brand' : 'text-foreground hover:text-brand',
                )}
              >
                {group.title}
              </button>
              {group.children && (
                <ul className="mt-1 space-y-0.5 border-l border-border ml-2 pl-2">
                  {group.children.map((child) => (
                    <li key={child.id}>
                      <button
                        type="button"
                        onClick={() => jump(child.id)}
                        className={cn(
                          'w-full rounded-md px-2 py-1 text-left text-[13px] transition-colors',
                          activeId === child.id
                            ? 'bg-brand-muted font-medium text-brand'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        {child.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="app-main-scroll min-w-0 flex-1">
        {/* 窄屏目录 */}
        <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-2 backdrop-blur lg:hidden">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="shrink-0">跳转到</span>
            <select
              className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              value={activeId}
              onChange={(e) => jump(e.target.value)}
            >
              {HELP_NAV.map((group) => (
                <optgroup key={group.id} label={group.title}>
                  <option value={group.id}>{group.title}</option>
                  {group.children?.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
        <HelpArticle />
      </div>
    </div>
  )
}
