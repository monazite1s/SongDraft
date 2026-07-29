'use client'

import { useState, useMemo } from 'react'
import { Search, Plus, Grid2x2, List, MoreVertical, Copy, Trash2 } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { Sidebar } from '@/components/inspire/sidebar'
import { Button } from '@/components/ui/button'
import { works } from '@/lib/inspire-data'

type SortOption = 'updated' | 'created' | 'name'
type FilterInputType = 'all' | 'text' | 'audio' | 'image' | 'video'
type FilterStatus = 'all' | 'Draft' | 'Ready' | 'Collaboration'

export default function WorksPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [sort, setSort] = useState<SortOption>('updated')
  const [filterInput, setFilterInput] = useState<FilterInputType>('all')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')

  const filtered = useMemo(() => {
    let results = [...works]

    if (searchQuery) {
      results = results.filter((w) =>
        w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (filterInput !== 'all') {
      results = results.filter((w) => w.inputTypes.includes(filterInput))
    }

    if (filterStatus !== 'all') {
      results = results.filter((w) => w.status === filterStatus)
    }

    if (sort === 'updated') {
      results.sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime())
    } else if (sort === 'created') {
      results.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
    } else {
      results.sort((a, b) => a.title.localeCompare(b.title))
    }

    return results
  }, [searchQuery, filterInput, filterStatus, sort])

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-background px-8 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">作品库</h1>
              <p className="text-sm text-muted-foreground mt-1">管理和浏览您的所有创意作品</p>
            </div>
            <Link href="/">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                新建作品
              </Button>
            </Link>
          </div>

          {/* Search and controls */}
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-64 relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="搜索作品..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <select
              value={filterInput}
              onChange={(e) => setFilterInput(e.target.value as FilterInputType)}
              className="px-4 py-2 bg-secondary border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">所有输入类型</option>
              <option value="text">歌词/文本</option>
              <option value="audio">音频/哼唱</option>
              <option value="image">图片</option>
              <option value="video">视频</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="px-4 py-2 bg-secondary border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">所有状态</option>
              <option value="Draft">草稿</option>
              <option value="Ready">已完成</option>
              <option value="Collaboration">协作中</option>
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="px-4 py-2 bg-secondary border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="updated">最近更新</option>
              <option value="created">最新创建</option>
              <option value="name">按名称</option>
            </select>

            <div className="flex gap-2">
              <Button
                variant={view === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setView('grid')}
              >
                <Grid2x2 className="w-4 h-4" />
              </Button>
              <Button
                variant={view === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setView('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-lg font-medium text-foreground mb-2">还没有作品</p>
                <p className="text-sm text-muted-foreground mb-4">开始创建新作品来捕捉灵感</p>
                <Link href="/">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    新建作品
                  </Button>
                </Link>
              </div>
            </div>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 p-8">
              {filtered.map((work) => (
                <WorkCard key={work.id} work={work} />
              ))}
            </div>
          ) : (
            <div className="space-y-2 p-8">
              {filtered.map((work) => (
                <WorkListItem key={work.id} work={work} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface WorkCardProps {
  work: (typeof works)[0]
}

function WorkCard({ work }: WorkCardProps) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className="group bg-card border border-border rounded-lg overflow-hidden hover:border-primary transition-colors">
      <Link href={`/works/${work.id}`} className="block aspect-square relative overflow-hidden bg-secondary">
        <Image
          src={work.cover}
          alt={work.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </Link>

      <div className="p-4">
        <Link href={`/works/${work.id}`} className="block mb-2">
          <h3 className="font-semibold text-foreground line-clamp-2 hover:text-primary transition-colors">
            {work.title}
          </h3>
        </Link>

        <p className="text-xs text-muted-foreground mb-3 line-clamp-1">{work.author}</p>

        <div className="flex flex-wrap gap-1 mb-3">
          {work.inputTypes.map((type: string) => (
            <span
              key={type}
              className="inline-block px-2 py-1 text-xs bg-secondary text-muted-foreground rounded"
            >
              {type === 'text' ? '文本' : type === 'audio' ? '音频' : type === 'image' ? '图片' : '视频'}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
          <span>{work.demos.length} 个版本</span>
          <span
            className={`px-2 py-1 rounded font-medium ${
              work.status === 'Ready'
                ? 'bg-green-100 text-green-700'
                : work.status === 'Collaboration'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700'
            }`}
          >
            {work.status === 'Ready' ? '已完成' : work.status === 'Collaboration' ? '协作中' : '草稿'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            更新于 {new Date(work.updated).toLocaleDateString('zh-CN')}
          </span>
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMenu(!showMenu)}
              className="h-6 w-6 p-0"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-md shadow-lg z-10">
                <Link href={`/works/${work.id}`}>
                  <button className="block w-full text-left px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors">
                    打开
                  </button>
                </Link>
                <button className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors flex gap-2">
                  <Copy className="w-4 h-4" />
                  复制
                </button>
                <button className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-secondary transition-colors flex gap-2">
                  <Trash2 className="w-4 h-4" />
                  删除
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface WorkListItemProps {
  work: (typeof works)[0]
}

function WorkListItem({ work }: WorkListItemProps) {
  return (
    <Link href={`/works/${work.id}`}>
      <div className="flex gap-4 p-4 bg-card border border-border rounded-lg hover:border-primary transition-colors cursor-pointer">
        <div className="relative w-16 h-16 flex-shrink-0 bg-secondary rounded overflow-hidden">
          <Image src={work.cover} alt={work.title} fill className="object-cover" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground line-clamp-1">{work.title}</h3>
          <p className="text-xs text-muted-foreground mb-2">{work.author}</p>
          <div className="flex flex-wrap gap-2">
            {work.inputTypes.map((type: string) => (
              <span key={type} className="inline-block px-2 py-1 text-xs bg-secondary text-muted-foreground rounded">
                {type === 'text' ? '文本' : type === 'audio' ? '音频' : type === 'image' ? '图片' : '视频'}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">{work.demos.length} 个版本</p>
            <p className="text-xs text-muted-foreground">
              {new Date(work.updated).toLocaleDateString('zh-CN')}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded text-xs font-medium ${
              work.status === 'Ready'
                ? 'bg-green-100 text-green-700'
                : work.status === 'Collaboration'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700'
            }`}
          >
            {work.status === 'Ready' ? '已完成' : work.status === 'Collaboration' ? '协作中' : '草稿'}
          </span>
        </div>
      </div>
    </Link>
  )
}
