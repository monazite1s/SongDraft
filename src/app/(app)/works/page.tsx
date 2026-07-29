import Link from "next/link";

import { requireCurrentUser } from "@/modules/auth/queries";
import { ProjectService } from "@/modules/projects/project-service";
import { WorksClient } from "@/components/projects/works-client";

export default async function WorksPage() {
  const user = await requireCurrentUser();
  const projects = await new ProjectService().list(user.id);
  return <main className="mx-auto max-w-6xl p-5 lg:p-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-indigo-600">你的作品</p><h1 className="mt-2 text-3xl font-semibold">灵感项目</h1><p className="mt-2 text-slate-500">每次创作都保留素材、计划和版本的上下文。</p></div><Link href="/" className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white">新建灵感</Link></div>{projects.length ? <WorksClient projects={projects} /> : <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="font-medium">还没有项目</h2><p className="mt-2 text-sm text-slate-500">从一句歌词、一个画面或一段哼唱开始。</p><Link href="/" className="mt-5 inline-block text-sm font-medium text-indigo-600">创建第一个项目</Link></section>}</main>;
}
