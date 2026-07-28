import Link from "next/link";

import { loginAction } from "@/modules/auth/actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="mt-8">
      <h1 className="text-2xl font-semibold">登录</h1>
      <p className="mt-2 text-sm text-slate-500">继续整理你的音乐灵感。</p>
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <form action={loginAction} className="mt-6 space-y-4">
        <label className="block text-sm">邮箱<input name="email" type="email" required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
        <label className="block text-sm">密码<input name="password" type="password" minLength={8} required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
        <button className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white">登录</button>
      </form>
      <p className="mt-5 text-sm text-slate-500">还没有账号？<Link className="ml-1 text-indigo-600" href="/register">注册</Link></p>
    </div>
  );
}
