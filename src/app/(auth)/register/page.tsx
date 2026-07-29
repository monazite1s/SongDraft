import Link from "next/link";

import { isMockAuthEnabled } from "@/infrastructure/auth/config";
import { registerAction } from "@/modules/auth/actions";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const isMock = isMockAuthEnabled();
  return (
    <div className="mt-8">
      <h1 className="text-2xl font-semibold">创建账号</h1>
      <p className="mt-2 text-sm text-slate-500">从一条灵感开始你的 SongDraft。</p>
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {isMock ? (
        <form action={registerAction} className="mt-6">
          <button className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white">进入工作台</button>
        </form>
      ) : (
        <>
          <form action={registerAction} className="mt-6 space-y-4">
            <label className="block text-sm">昵称<input name="displayName" required maxLength={40} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
            <label className="block text-sm">邮箱<input name="email" type="email" required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
            <label className="block text-sm">密码<input name="password" type="password" minLength={8} required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
            <button className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white">注册</button>
          </form>
          <p className="mt-5 text-sm text-slate-500">已有账号？<Link className="ml-1 text-indigo-600" href="/login">登录</Link></p>
        </>
      )}
    </div>
  );
}
