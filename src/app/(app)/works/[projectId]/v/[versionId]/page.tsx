/**
 * 歌曲详情页（/works/[projectId]/v/[versionId]）。
 * 层级：项目下某一版本（Demo）的播放 + 歌词 + 评论。
 * Server Component 聚合 ProjectService + ShareService；歌词/评论 Tab 下沉 client 子组件。
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Share2, History, FileAudio } from "lucide-react";

import { Sidebar } from "@/components/inspire/sidebar";
import { SongDetailTabs } from "@/components/works/song-detail-tabs";
import { VersionSwitcher } from "@/components/works/version-switcher";
import { AudioPlayer } from "@/components/inspire/audio-player";
import { Badge, ModeTag } from "@/components/inspire/ui";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/modules/auth/queries";
import { GenerationService } from "@/modules/generation/generation-service";
import { InspirationService } from "@/modules/inspirations/inspiration-service";
import { ProjectService } from "@/modules/projects/project-service";
import { ShareService } from "@/modules/sharing/share-service";
import type { ExecutionKind } from "@/shared/contracts/domain";

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

  const lyrics = project.lyrics ?? "";
  const executionKind: ExecutionKind = version.executionKind;
  const runMode = executionKind === "simulated" ? "simulated" : "real";
  const isRealAudio = executionKind !== "simulated";

  function fmtDate(iso: string) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function handleShare() {
    // 分享能力占位：暂未接入创建分享链接流程。
    console.log("[share] placeholder clicked", { projectId, versionId });
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-background px-8 py-3 flex items-center justify-between">
          <Link href={`/works/${projectId}`}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="size-4" />
              返回
            </Button>
          </Link>
          <div className="flex gap-2">
            {versions.length > 1 ? (
              <VersionSwitcher projectId={projectId} versions={versions} currentId={version.id}>
                <Button variant="outline" size="sm" className="gap-2">
                  <History className="size-4" />
                  历史切换
                </Button>
              </VersionSwitcher>
            ) : null}
            <Button variant="outline" size="sm" className="gap-2" onClick={handleShare}>
              <Share2 className="size-4" />
              分享
            </Button>
            <Link href={`/create/${projectId}`}>
              <Button variant="outline" size="sm" className="gap-2">
                <Pencil className="size-4" />
                编辑
              </Button>
            </Link>
          </div>
        </div>

        {/* Song info */}
        <div className="border-b border-border bg-background px-8 py-6">
          <div className="flex gap-5">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-brand text-primary-foreground">
              <FileAudio className="size-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-foreground">{version.title || "未命名版本"}</h1>
                <Badge variant="secondary">v{version.versionNo}</Badge>
                {version.isMain ? (
                  <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-medium text-success-foreground">
                    主版本
                  </span>
                ) : null}
                <ModeTag mode={runMode} />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                <span>{user.displayName}</span>
                <span className="mx-1.5 text-muted-foreground/50">·</span>
                <span>{fmtDate(version.createdAt)}</span>
                {version.restoredFromVersionId ? (
                  <>
                    <span className="mx-1.5 text-muted-foreground/50">·</span>
                    <span className="text-muted-foreground/80">恢复自历史版本</span>
                  </>
                ) : null}
              </p>
            </div>
          </div>

          {/* Audio / controls row */}
          <div className="mt-5 rounded-lg border border-border bg-card p-4">
            {version.hasAudio && version.audioUrl ? (
              <>
                <AudioPlayer durationLabel="1:30" seed={hashSeed(version.id)} className="mb-3" />
                <p className="text-xs text-muted-foreground">
                  {isRealAudio ? "真实生成音频" : "模拟输出（未接入音乐模型）"}
                </p>
              </>
            ) : (
              <p className="py-2 text-sm text-muted-foreground">该版本无音频</p>
            )}
          </div>
        </div>

        {/* Tabs: 歌词 / 评论 */}
        <SongDetailTabs lyrics={lyrics} comments={comments} />
      </div>
    </div>
  );
}

/** 稳定的波形 seed（避免每次渲染抖动）。 */
function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 100000;
}
