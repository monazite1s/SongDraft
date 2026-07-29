'use client'

/**
 * 歌曲详情页全页唯一播放器（横向长播放器，docs/UI-design.md）。
 *
 * 设计要点：
 * - 播放器位于 Tab 之外的信息区，状态提升到父组件（SongDetailClient），
 *   切换歌词/评论 Tab 时播放器不会卸载、不刷新、不停止。
 * - 真实音频由内部 <audio> 元素承载；currentTime/isPlaying/duration 通过
 *   回调上报父组件，供评论时间轴与评论输入绑定当前时间。
 * - 受控 seek：父组件可外部 seek（点击时间轴节点）→ 通过 ref 同步 audio。
 * - 视觉：低对比度简洁波形（非剪辑/缩放编辑器），仅用于装饰进度。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, Repeat, Repeat1, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SongPlayerHandle {
  /** 外部 seek（如点击评论时间轴节点）→ 设置 audio.currentTime。 */
  seek: (sec: number) => void
  /** 外部触发播放（点击时间轴节点跳转后开始播放，规范 §6）。 */
  play: () => void
}

interface Props {
  audioUrl: string
  /** 稳定的波形 seed（按 versionId 计算，避免每次渲染抖动）。 */
  seed: number
  /** 当前时间变化（播放推进或 seek）回调，单位秒。 */
  onTimeChange: (sec: number) => void
  /** 播放/暂停状态变化回调。 */
  onPlayingChange: (playing: boolean) => void
  /** 总时长变化回调（loadedmetadata）。 */
  onDurationChange: (durationSec: number) => void
  /** 用户主动在进度条上 seek（点击/拖动）时回调——用于评论区自动绑定评论时间（规范 §2.2）。 */
  onUserSeek?: (sec: number) => void
  /** ref 句柄，供父组件外部 seek。 */
  handleRef?: React.MutableRefObject<SongPlayerHandle | null>
  className?: string
}

function fmt(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// 确定性伪波形：低对比度装饰用，非可编辑轨道。
function waveform(seed: number, count: number) {
  const bars: number[] = []
  let x = seed * 9301 + 49297
  for (let i = 0; i < count; i++) {
    x = (x * 9301 + 49297) % 233280
    const r = x / 233280
    bars.push(0.28 + r * 0.6)
  }
  return bars
}

export function SongPlayer({ audioUrl, seed, onTimeChange, onPlayingChange, onDurationChange, onUserSeek, handleRef, className }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [loop, setLoop] = useState(false)

  const wf = useMemo(() => waveform(seed, 64), [seed])
  const progress = duration > 0 ? Math.min(1, current / duration) : 0

  // 暴露 seek 句柄给父组件（外部 seek，如点击评论时间轴节点）。
  const seek = useCallback((sec: number) => {
    const audio = audioRef.current
    if (!audio) return
    const clamped = Math.max(0, Math.min(sec, duration || sec))
    audio.currentTime = clamped
    setCurrent(clamped)
    onTimeChange(clamped)
  }, [duration, onTimeChange])

  const play = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    void audio.play().catch(() => { /* 自动播放策略拦截 → 保持暂停态，不抛错 */ })
  }, [])

  useEffect(() => {
    if (handleRef) handleRef.current = { seek, play }
    return () => {
      if (handleRef) handleRef.current = null
    }
  }, [handleRef, seek, play])

  // volume/muted 为音频元素属性（非 React 受控 attribute），通过 ref 同步。
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = muted
    audio.volume = muted ? 0 : volume
  }, [muted, volume])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      void audio.play().catch(() => { /* 自动播放策略拦截 → 保持暂停态，不抛错 */ })
    } else {
      audio.pause()
    }
  }, [])

  function seekFromEvent(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const target = ratio * duration
    seek(target)
    // 用户主动选择播放位置 → 通知外部（评论输入区据此绑定评论时间）。
    onUserSeek?.(target)
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <audio
        ref={audioRef}
        src={audioUrl}
        loop={loop}
        preload="metadata"
        onPlay={() => { setPlaying(true); onPlayingChange(true) }}
        onPause={() => { setPlaying(false); onPlayingChange(false) }}
        onTimeUpdate={(e) => { const t = e.currentTarget.currentTime; setCurrent(t); onTimeChange(t) }}
        onLoadedMetadata={(e) => { const d = e.currentTarget.duration; const safe = Number.isFinite(d) ? d : 0; setDuration(safe); onDurationChange(safe) }}
        onEnded={() => { if (!loop) { setPlaying(false); onPlayingChange(false) } }}
      />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? '暂停' : '播放'}
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
      </button>

      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{fmt(current)}</span>

      {/* 低对比度简洁波形 + 进度（点击 seek） */}
      <div
        className="relative flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-[2px]"
        onClick={seekFromEvent}
        role="slider"
        aria-label="播放进度"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
      >
        {wf.map((h, i) => {
          const on = i / wf.length <= progress
          return (
            <span
              key={i}
              className={cn('w-full flex-1 rounded-full transition-colors', on ? 'bg-brand' : 'bg-border')}
              style={{ height: `${Math.round(h * 100)}%` }}
            />
          )
        })}
      </div>

      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{duration > 0 ? fmt(duration) : '--:--'}</span>

      {/* 音量 */}
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? '取消静音' : '静音'}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {muted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          aria-label="音量"
          onChange={(e) => { const v = Number(e.target.value); setVolume(v); setMuted(v === 0) }}
          className="h-1 w-16 cursor-pointer accent-primary"
        />
      </div>

      {/* 循环 */}
      <button
        type="button"
        onClick={() => setLoop((l) => !l)}
        aria-label={loop ? '取消循环' : '单曲循环'}
        aria-pressed={loop}
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-md transition-colors',
          loop ? 'bg-brand-muted text-brand' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        {loop ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
      </button>
    </div>
  )
}
