import { Image, Mic2, Plus, Type } from "lucide-react";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl p-5 lg:p-10">
      <p className="text-sm font-medium text-indigo-600">SongDraft 创作台</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight lg:text-4xl">今天想记录什么灵感？</h1>
      <p className="mt-3 text-slate-500">一句歌词、一段哼唱或一个画面，都可以成为 Demo 的起点。</p>
      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:p-7">
        <textarea aria-label="灵感描述" placeholder="写下一句歌词、描述一个画面，或者录下刚刚想到的旋律。" className="min-h-36 w-full resize-none border-0 bg-transparent text-lg outline-none" />
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          {[{ label: "文字", icon: Type }, { label: "录制哼唱", icon: Mic2 }, { label: "图片/视频", icon: Image }].map(({ label, icon: Icon }) => (
            <button key={label} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600"><Icon className="size-4" />{label}</button>
          ))}
          <button className="ml-auto flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white"><Plus className="size-4" />开始创作</button>
        </div>
      </section>
    </main>
  );
}
