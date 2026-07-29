"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useState } from "react";

import type { ProfileView } from "@/modules/profile/profile-service";

export function ProfileSettings({ profile }: { profile: ProfileView }) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function save(event: React.FormEvent) { event.preventDefault(); setIsSaving(true); setMessage(""); try { const response = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName }) }); const body = await response.json() as { ok: boolean; data?: ProfileView; error?: { message?: string } }; if (!response.ok || !body.data) throw new Error(body.error?.message || "保存失败"); setDisplayName(body.data.displayName); setMessage("资料已保存"); } catch (error) { setMessage(error instanceof Error ? error.message : "保存失败"); } finally { setIsSaving(false); } }
  return <section className="mt-8 max-w-xl rounded-2xl border border-slate-200 bg-white p-5"><p className="section-kicker">应用 Profile</p><h2 className="mt-1 text-lg font-semibold">个人资料</h2><p className="mt-2 text-sm leading-6 text-slate-500">认证由 Supabase 管理；这里保存 SongDraft 内部的展示资料。</p><form onSubmit={save} className="mt-5 space-y-4"><label className="block text-sm font-medium text-slate-700">昵称<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={40} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-indigo-400" /></label><label className="block text-sm font-medium text-slate-700">邮箱<input value={profile.email} disabled className="mt-1.5 w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-slate-500" /></label><button disabled={isSaving} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white disabled:bg-indigo-300">{isSaving ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}{isSaving ? "保存中" : "保存资料"}</button>{message ? <p role="status" className="text-sm text-slate-600">{message}</p> : null}</form><p className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">头像会在接入腾讯云 COS 后通过私有对象键保存；当前版本不在浏览器或数据库中保存任何认证 Token、密码或 Secret。</p></section>;
}
