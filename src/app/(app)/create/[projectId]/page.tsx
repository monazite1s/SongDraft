/** 已有项目制作台：校验所有权后注入 initialProject。 */
import { notFound } from "next/navigation";

import { SongDraftWorkspace } from "@/components/inspire/workspace";
import { requireCurrentUser } from "@/modules/auth/queries";
import { ProjectService } from "@/modules/projects/project-service";

export default async function WorkspacePage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireCurrentUser();
  const { projectId } = await params;
  if (projectId === "new") return <SongDraftWorkspace />;
  let project;
  try { project = await new ProjectService().get(user.id, projectId); }
  catch { notFound(); }
  return <SongDraftWorkspace initialProject={project} />;
}
