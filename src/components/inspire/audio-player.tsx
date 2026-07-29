'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'

function fmt(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// deterministic pseudo waveform
function waveform(seed: number, count: number) {
  const bars: number[] = []
  let x = seed * 9301 + 49297
  for (let i = 0; i < count; i++) {
    x = (x * 9301 + 49297) % 233280
    const r = x / 233280
    bars.push(0.25 + r * 0.75)
  }
  return bars
}

export function AudioPlayer({
  durationLabel,
  seed = 7,
  markers = [],
  current,
  onSeek,
  onTimeUpdate,
  bars = 56,
  className,
}: {
  durationLabel: string
  seed?: number
  markers?: { at: number; label?: string }[]
  current?: number
  onSeek?: (sec: number) => void
  onTimeUpdate?: (sec: number) => void
  bars?: number
  className?: string
}) {
  const totalSec = useMemo(() => {
    const [m, s] = durationLabel.split(':').map(Number)
    return m * 60 + s
  }, [durationLabel])

  const [playing, setPlaying] = useState(false)
  const [internal, setInternal] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const pos = current ?? internal

  useEffect(() => {
    if (playing) {
      timer.current = setInterval(() => {
        setInternal((p) => {
          const next = p + 0.25
          if (next >= totalSec) {
            setPlaying(false)
            onTimeUpdate?.(totalSec)
            return totalSec
          }
          onTimeUpdate?.(next)
          return next
        })
      }, 250)
    }
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [onTimeUpdate, playing, totalSec])

  const wf = useMemo(() => waveform(seed, bars), [seed, bars])
  const progress = totalSec ? pos / totalSec : 0

  function seekFromEvent(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const sec = ratio * totalSec
    setInternal(sec)
    onSeek?.(sec)
    onTimeUpdate?.(sec)
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <button
        onClick={() => setPlaying((v) => !v)}
        aria-label={playing ? '暂停' : '播放'}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {playing ? (
          <Pause className="size-4" />
        ) : (
          <Play className="size-4 translate-x-px" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div
          className="relative flex h-9 cursor-pointer items-center gap-[2px]"
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
                className={cn(
                  'w-full flex-1 rounded-full transition-colors',
                  on ? 'bg-brand' : 'bg-border',
                )}
                style={{ height: `${Math.round(h * 100)}%` }}
              />
            )
          })}
          {markers.map((m, i) => (
            <span
              key={i}
              className="absolute top-0 h-full w-px bg-warning/70"
              style={{ left: `${(m.at / totalSec) * 100}%` }}
              aria-hidden
            />
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-muted-foreground">
        <span className="text-foreground">{fmt(pos)}</span>
        <span>/</span>
        <span>{durationLabel}</span>
        <Volume2 className="ml-1 size-3.5" />
      </div>
    </div>
  )
}
