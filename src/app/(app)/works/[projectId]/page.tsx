/**
 * 歌曲详情页（/works/[projectId]）。
 * 层级：歌曲维度聚合 → 关联灵感 + 版本（Demo）列表。
 * Server Component 直接调 ProjectService；Tab 交互下沉到 client 子组件。
 */
import { notFound } from "next/navigation";

import { Sidebar } from "@/components/inspire/sidebar";
import { ProjectDetailTabs } from "@/components/works/project-detail-tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/inspire/ui";
import { requireCurrentUser } from "@/modules/auth/queries";
import { GenerationService } from "@/modules/generation/generation-service";
import { InspirationService } from "@/modules/inspirations/inspiration-service";
import { ProjectService } from "@/modules/projects/project-service";
import type { ProjectStatus } from "@/modules/projects/project-types";
import Link from "next/link";
import { ArrowLeft, Share2, Wand2 } from "lucide-react";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "草稿",
  analyzing: "分析中",
  review: "审阅",
  ready: "已完成",
  collaborating: "协作中",
  archived: "已归档",
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireCurrentUser();
  const { projectId } = await params;

  // 歌曲详情聚合在页面层完成，避免 project-service ↔ inspiration-repository 循环 import。
  let project: Awaited<ReturnType<ProjectService["get"]>>;
  try {
    project = await new ProjectService().get(user.id, projectId);
  } catch {
    notFound();
  }
  const [inspirations, versions] = await Promise.all([
    new InspirationService().listByProject(user.id, projectId),
    new GenerationService().listVersions(user, projectId),
  ]);

  const detail = { project, inspirations, versions };
  const coverLetter = (project.title || "作").trim().charAt(0).toUpperCase();

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-background px-8 py-3 flex items-center justify-between">
          <Link href="/works">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="size-4" />
              返回
            </Button>
          </Link>
          <div className="flex gap-2">
            <Link href={`/create/${projectId}`}>
              <Button variant="outline" size="sm" className="gap-2" title="在制作台中分享当前歌曲">
                <Share2 className="size-4" />
                分享
              </Button>
            </Link>
            <Link href={`/create/${projectId}`}>
              <Button size="sm" className="gap-2">
                <Wand2 className="size-4" />
                打开制作台
              </Button>
            </Link>
          </div>
        </div>

        {/* Song info */}
        <div className="border-b border-border bg-background px-8 py-6">
          <div className="flex gap-5">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-brand text-xl font-semibold text-primary-foreground">
              {coverLetter}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-foreground">{project.title || "未命名歌曲"}</h1>
                <Badge variant="secondary">{STATUS_LABEL[project.status]}</Badge>
              </div>
              {project.description ? (
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{project.description}</p>
              ) : (
                <p className="mt-1.5 text-sm text-muted-foreground/70">暂无描述</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">创建于 {fmtDate(project.createdAt)}</p>
            </div>
          </div>
        </div>

        {/* Tabs: 歌曲 / 灵感 */}
        <ProjectDetailTabs
          projectId={projectId}
          versions={versions}
          inspirations={inspirations}
        />
      </div>
    </div>
  );
}
