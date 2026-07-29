"use client";

import { LoaderCircle, MessageCircle, Music2, Send } from "lucide-react";
import { useState } from "react";

import type { PublicComment, PublicShare } from "@/modules/sharing/share-service";
import { MockDemoPlayer } from "@/components/audio/mock-demo-player";

export function PublicShareClient({ token, share }: { token: string; share: PublicShare }) {
  const [comments, setComments] = useState(share.comments);
  const [content, setContent] = useState("");
  const [guestName, setGuestName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setIsSubmitting(true); setError("");
    try { const response = await fetch(`/api/public/shares/${token}/comments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content, guestName }) }); const body = await response.json() as { ok: boolean; data?: PublicComment; error?: { message?: string } }; if (!response.ok || !body.data) throw new Error(body.error?.message || "评论发送失败"); setComments((previous) => [...previous, body.data!]); setContent(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "评论发送失败"); }
    finally { setIsSubmitting(false); }
  }
  return <main className="mx-auto min-h-screen max-w-xl px-4 py-8 sm:py-12"><div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><p className="text-xs font-medium tracking-wide text-indigo-600">SONGDRAFT PRIVATE SHARE</p><h1 className="mt-2 text-2xl font-semibold text-slate-950">{share.title}</h1>{share.description ? <p className="mt-2 text-sm leading-6 text-slate-500">{share.description}</p> : null}<section className="mt-6 rounded-2xl bg-slate-950 p-5 text-white"><div className="flex items-center gap-2 text-xs text-indigo-200"><Music2 className="size-4" />版本 V{share.versionNo} · {share.executionKind === "simulated" ? "模拟生成" : "Demo"}</div><h2 className="mt-3 font-medium">{share.demoTitle}</h2>{share.hasAudio ? <p className="mt-2 text-sm leading-6 text-slate-300">音频播放器将在 COS 私有签名读取接入后展示。</p> : <div className="mt-3"><MockDemoPlayer /></div>}</section><section className="mt-7"><div className="flex items-center gap-2"><MessageCircle className="size-4 text-indigo-600" /><h2 className="font-semibold">协作评论</h2></div><div className="mt-4 space-y-3">{comments.length ? comments.map((comment) => <article key={comment.id} className="rounded-xl bg-slate-50 p-3"><div className="flex justify-between gap-3 text-xs"><span className="font-medium text-slate-700">{comment.author}</span>{comment.atMs !== null ? <span className="text-indigo-600">{Math.floor(comment.atMs / 1000)} 秒</span> : null}</div><p className="mt-1.5 text-sm leading-6 text-slate-600">{comment.content}</p></article>) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">还没有反馈，留下第一条创作建议吧。</p>}</div>{share.allowComments ? <form onSubmit={submit} className="mt-5 space-y-3"><label className="block text-sm font-medium text-slate-700">昵称<input value={guestName} onChange={(event) => setGuestName(event.target.value)} maxLength={40} placeholder="访客昵称（登录用户可留空）" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400" /></label><label className="block text-sm font-medium text-slate-700">评论<textarea value={content} onChange={(event) => setContent(event.target.value)} required maxLength={1000} placeholder="例如：副歌可以再提前四拍进入。" className="mt-1.5 min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-indigo-400" /></label>{error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : null}<button disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white disabled:bg-indigo-300">{isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}{isSubmitting ? "发送中" : "发送反馈"}</button></form> : <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">创建者没有开放评论。</p>}</section></div></main>;
}
