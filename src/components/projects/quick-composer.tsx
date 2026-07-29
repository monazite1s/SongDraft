"use client";

import { ImageIcon, LoaderCircle, Mic2, Plus, Sparkles, Type } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ApiResponse = { ok: boolean; data?: { id: string }; error?: { message?: string } };

export function QuickComposer() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [mode, setMode] = useState<"idea" | "lyrics">("idea");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const value = mode === "idea" ? description.trim() : lyrics.trim();
    if (!value) { setError(mode === "idea" ? "先写下一句灵感或一段描述" : "先写下至少一句歌词"); return; }
    setIsSubmitting(true); setError("");
    try {
      const response = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: value.slice(0, 30), description: mode === "idea" ? value : undefined, lyrics: mode === "lyrics" ? value : undefined }) });
      const body = await response.json() as ApiResponse;
      if (!response.ok || !body.data?.id) throw new Error(body.error?.message || "项目创建失败，请重试");
      router.push(`/create/${body.data.id}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "项目创建失败，请重试"); }
    finally { setIsSubmitting(false); }
  }

  return <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_-32px_rgba(30,41,59,.45)] lg:p-7">
    <div className="flex items-center gap-2 text-sm font-medium text-indigo-600"><Sparkles className="size-4" />从一个灵感开始</div>
    <div className="mt-5 flex gap-2" role="tablist" aria-label="输入类型">
      <button role="tab" aria-selected={mode === "idea"} onClick={() => setMode("idea")} className={`rounded-full px-3 py-1.5 text-sm ${mode === "idea" ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-500 hover:bg-slate-50"}`}><Type className="mr-1 inline size-3.5" />灵感描述</button>
      <button role="tab" aria-selected={mode === "lyrics"} onClick={() => setMode("lyrics")} className={`rounded-full px-3 py-1.5 text-sm ${mode === "lyrics" ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-500 hover:bg-slate-50"}`}>歌词原稿</button>
    </div>
    <label className="sr-only" htmlFor="inspiration">{mode === "idea" ? "灵感描述" : "歌词原稿"}</label>
    <textarea id="inspiration" value={mode === "idea" ? description : lyrics} onChange={(event) => mode === "idea" ? setDescription(event.target.value) : setLyrics(event.target.value)} placeholder={mode === "idea" ? "写下一句歌词、描述一个画面，或记录一段刚刚想到的旋律。" : "写下原始歌词；SongDraft 会保留它，不会被 AI 草稿覆盖。"} className="mt-4 min-h-40 w-full resize-none border-0 bg-transparent text-base leading-7 text-slate-900 outline-none placeholder:text-slate-400" />
    {error ? <p role="alert" className="mt-2 text-sm text-rose-600">{error}</p> : null}
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
      <button type="button" onClick={() => router.push("/create/new?input=audio")} className="composer-action"><Mic2 className="size-4" />录制哼唱</button>
      <button type="button" onClick={() => router.push("/create/new?input=visual")} className="composer-action"><ImageIcon className="size-4" />图片/视频</button>
      <button type="button" onClick={() => { setMode("idea"); setDescription("一场雨后的夜车，副歌要有释然但仍有遗憾的感觉。"); }} className="composer-action"><Plus className="size-4" />填入示例</button>
      <button type="button" disabled={isSubmitting} onClick={submit} className="ml-auto inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-wait disabled:bg-indigo-400">
        {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{isSubmitting ? "正在创建" : "开始创作"}
      </button>
    </div>
  </section>;
}
