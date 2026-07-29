import { ArrowUpRight, Clock3, Music2 } from "lucide-react";

import { QuickComposer } from "@/components/projects/quick-composer";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl p-5 lg:p-10">
      <div className="flex items-start justify-between gap-5"><div><p className="text-sm font-medium text-indigo-600">SongDraft 创作台</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">今天想记录什么灵感？</h1><p className="mt-3 max-w-2xl text-slate-500">一句歌词、一段哼唱或一个画面，都可以成为能被协作者听见、讨论和继续创作的 Demo 起点。</p></div><span className="hidden rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 sm:block">Mock 模式已就绪</span></div>
      <div className="mt-8"><QuickComposer /></div>
      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {[{ icon: Clock3, title: "保留原始灵感", text: "每一段文字、录音和画面都独立保存，AI 不会覆盖原稿。" }, { icon: Music2, title: "先确认，再生成", text: "创作简报与生成计划可解释、可调整，避免黑箱输出。" }, { icon: ArrowUpRight, title: "分享一个版本", text: "把确定的 Demo 发给协作者，在对应时间点收回意见。" }].map(({ icon: Icon, title, text }) => <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5"><Icon className="size-5 text-indigo-600" /><h2 className="mt-4 font-medium text-slate-900">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></article>)}
      </section>
    </main>
  );
}
