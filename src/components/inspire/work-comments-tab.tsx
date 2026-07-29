'use client'

import { useState } from 'react'
import { Heart, MoreVertical, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function WorkCommentsTab({
  demoId,
}: {
  demoId: string
}) {
  const [comments] = useState([
    {
      id: '1',
      author: '李创意',
      timestamp: '2024-01-15 14:30',
      text: '前奏的风格感很强！',
      likes: 3,
      liked: false,
    },
    {
      id: '2',
      author: '王编曲',
      timestamp: '2024-01-15 15:45',
      text: '副歌部分还可以再加一个层次的编排',
      likes: 5,
      liked: false,
    },
  ])

  const [timestampComments] = useState([
    {
      id: 't1',
      at: 12.5,
      author: '张制作',
      text: '这里的鼓声很有意思',
      adopted: false,
    },
    {
      id: 't2',
      at: 45.2,
      author: '刘声学',
      text: '很喜欢这个过渡，已采用',
      adopted: true,
    },
  ])

  const [newComment, setNewComment] = useState('')

  return (
    <div className="space-y-8">
      {/* Regular comments */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">常规评论</h3>
        <div className="space-y-4 mb-6">
          {comments.map((comment) => (
            <div key={comment.id} className="bg-secondary border border-border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-foreground">{comment.author}</p>
                  <p className="text-xs text-muted-foreground">{comment.timestamp}</p>
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm text-foreground mb-3">{comment.text}</p>
              <Button
                variant="ghost"
                size="sm"
                className={`gap-1 text-xs ${comment.liked ? 'text-primary' : 'text-muted-foreground'}`}
              >
                <Heart className={`w-4 h-4 ${comment.liked ? 'fill-current' : ''}`} />
                {comment.likes}
              </Button>
            </div>
          ))}
        </div>

        <div className="bg-secondary border border-border rounded-lg p-4">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="添加您的评论..."
            className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            rows={3}
          />
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" size="sm">
              取消
            </Button>
            <Button size="sm" disabled={!newComment.trim()}>
              发送
            </Button>
          </div>
        </div>
      </div>

      {/* Timestamp comments */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">时间戳评论</h3>
        <div className="space-y-3">
          {timestampComments.map((comment) => (
            <div
              key={comment.id}
              className="flex gap-4 p-4 bg-secondary border border-border rounded-lg hover:border-primary transition-colors"
            >
              <div className="flex-shrink-0">
                <button className="text-sm font-mono font-semibold text-primary hover:text-primary/80">
                  {comment.at.toFixed(1)}s
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-foreground text-sm">{comment.author}</p>
                  {comment.adopted && (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                      已采用
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground">{comment.text}</p>
              </div>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0">
                <MessageSquare className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
