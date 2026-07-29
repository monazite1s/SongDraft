import { notFound } from "next/navigation";

import { WorkspaceClient } from "@/components/projects/workspace-client";
import { requireCurrentUser } from "@/modules/auth/queries";
import { ProjectService } from "@/modules/projects/project-service";

export default async function WorkspacePage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireCurrentUser();
  const { projectId } = await params;
  if (projectId === "new") return <main className="mx-auto max-w-2xl p-8"><h1 className="text-2xl font-semibold">先从首页写下一段灵感</h1><p className="mt-2 text-slate-500">文字、哼唱或画面都可以创建项目。</p></main>;
  let project;
  try { project = await new ProjectService().get(user.id, projectId); }
  catch { notFound(); }
  return <WorkspaceClient project={project} />;
}
