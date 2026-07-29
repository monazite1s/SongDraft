/** 已有项目制作台：校验所有权后注入 initialProject。 */
import { redirect } from "next/navigation";

import { Sidebar } from "@/components/inspire/sidebar";
import { SongDraftWorkspace } from "@/components/inspire/workspace";
import { CreateEmptyState } from "@/components/inspire/create-empty-state";
import { requireCurrentUser } from "@/modules/auth/queries";
import { ProjectService } from "@/modules/projects/project-service";

export default async function WorkspacePage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireCurrentUser();
  const { projectId } = await params;
  // 「new」视为未选择项目：渲染空状态，避免空工作台与幽灵项目。
  if (projectId === "new") {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="app-main-scroll flex min-w-0 flex-1 flex-col">
          <CreateEmptyState />
        </div>
      </div>
    );
  }
  let project;
  try {
    project = await new ProjectService().get(user.id, projectId);
  } catch {
    // 项目不存在 / 无权访问：回制作台入口，并带 missing=1 让客户端清掉失效的 lastProject，
    // 避免侧栏「制作台」链到死链后再 404 死循环。
    redirect("/create?missing=1");
  }
  return <SongDraftWorkspace initialProject={project} />;
}
