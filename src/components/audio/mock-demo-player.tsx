"use client";

import { Pause, Play } from "lucide-react";
import { useRef, useState } from "react";

const frequencies = [261.63, 329.63, 392, 523.25, 440, 392, 329.63, 293.66];

export function MockDemoPlayer({ compact = false }: { compact?: boolean }) {
  const contextRef = useRef<AudioContext | null>(null);
  const [playing, setPlaying] = useState(false);
  function stop() { contextRef.current?.close().catch(() => undefined); contextRef.current = null; setPlaying(false); }
  async function play() {
    if (playing) { stop(); return; }
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return;
    const context = new AudioContextConstructor(); contextRef.current = context; await context.resume();
    const start = context.currentTime + 0.04;
    frequencies.forEach((frequency, index) => { const oscillator = context.createOscillator(); const gain = context.createGain(); const noteStart = start + index * 0.45; oscillator.type = index % 4 === 0 ? "triangle" : "sine"; oscillator.frequency.setValueAtTime(frequency, noteStart); gain.gain.setValueAtTime(0.0001, noteStart); gain.gain.exponentialRampToValueAtTime(0.11, noteStart + 0.025); gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.38); oscillator.connect(gain).connect(context.destination); oscillator.start(noteStart); oscillator.stop(noteStart + 0.4); });
    setPlaying(true); window.setTimeout(stop, frequencies.length * 450 + 160);
  }
  return <div className={`flex items-center gap-2 ${compact ? "" : "rounded-xl border border-indigo-100 bg-indigo-50 p-3"}`}><button type="button" onClick={() => void play()} className="inline-flex size-9 items-center justify-center rounded-full bg-indigo-600 text-white" aria-label={playing ? "停止合成样例" : "播放合成样例"}>{playing ? <Pause className="size-4" /> : <Play className="size-4" />}</button><div><p className="text-xs font-medium text-indigo-900">{playing ? "正在播放合成样例" : "试听合成样例"}</p>{compact ? null : <p className="mt-0.5 text-[11px] leading-4 text-indigo-700">本地 Web Audio 合成旋律，仅用于演示播放与评论流程；不是外部音乐模型输出。</p>}</div></div>;
}

declare global { interface Window { webkitAudioContext?: typeof AudioContext; } }
