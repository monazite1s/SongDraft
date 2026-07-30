/**
 * 歌曲详情页（/works/[projectId]/v/[versionId]）。
 * 层级：项目下某一版本（Demo）的播放 + 歌词 + 评论（全屏独立路由，不居中弹窗）。
 * Server Component 聚合 ProjectService + GenerationService + ShareService；
 * 顶部栏 / 信息区 / 播放器 / Tab 全部下沉到 SongDetailClient，播放器状态在 client 内提升。
 * 外壳（Sidebar + 内容 flex）由 (app)/layout.tsx 统一渲染，本页只返回内容客户端。
 */
import { notFound } from "next/navigation";

import { SongDetailClient } from "@/components/works/song-detail-client";
import { requireCurrentUser } from "@/modules/auth/queries";
import { GenerationService } from "@/modules/generation/generation-service";
import { InspirationService } from "@/modules/inspirations/inspiration-service";
import { ProjectService } from "@/modules/projects/project-service";
import { ShareService } from "@/modules/sharing/share-service";

export default async function SongDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; versionId: string }>;
}) {
  const user = await requireCurrentUser();
  const { projectId, versionId } = await params;

  // 项目详情聚合在页面层完成，避免 project-service ↔ inspiration-repository 循环 import。
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
  void inspirations;

  const version = versions.find((v) => v.id === versionId);
  if (!version) notFound();

  const comments = (await new ShareService().listComments(user, projectId)).filter(
    (c) => c.versionId === versionId,
  );

  const authorInitial = (user.displayName || "U").trim().charAt(0).toUpperCase();

  return (
    <SongDetailClient
      projectId={projectId}
      projectTitle={project.title}
      description={project.description}
      lyrics={project.lyrics ?? ""}
      authorName={user.displayName}
      authorInitial={authorInitial}
      createdAt={project.createdAt}
      updatedAt={project.updatedAt}
      status={project.status}
      versions={versions}
      version={version}
      comments={comments}
    />
  );
}
