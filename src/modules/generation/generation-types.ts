import type { ExecutionKind } from "@/shared/contracts/domain";

export type GenerationStatus = "queued" | "analyzing" | "generating" | "completed" | "failed" | "cancelled";

/**
 * 生成候选（docs/SPEC.md §7.4）。
 * 生成完成只创建候选；savedVersionId 为空表示「未保存」，保存为版本后回填。
 */
export interface DemoCandidate {
  id: string;
  title: string;
  variation: string;
  durationMs: number;
  executionKind: ExecutionKind;
  hasAudio: boolean;
  audioUrl?: string | null;
  savedVersionId?: string | null;
}

export interface GenerationResult {
  jobId: string;
  status: GenerationStatus;
  progress: number;
  candidates: DemoCandidate[];
}

export interface DemoVersionView {
  id: string;
  versionNo: number;
  title: string;
  variation: string;
  isMain: boolean;
  createdAt: string;
  executionKind: ExecutionKind;
  hasAudio: boolean;
  audioUrl?: string | null;
  restoredFromVersionId?: string | null;
  /** 父版本 id（版本树父子关系）；null 表示根节点。 */
  parentId?: string | null;
  /**
   * 版本树展示标签：与歌曲真实 versionNo 一致（v1、v2、v3…）。
   * 父子分叉由 parentId 布局表达，不再用 vN.M 拓扑重编号。
   */
  label?: string;
}

/** restore（应用历史版本）返回：版本视图 + 写回工作区的歌词快照。 */
export type RestoreVersionResult = DemoVersionView & { lyrics: string | null };

/** 将候选保存为正式版本的结果。 */
export interface SaveCandidatesResult {
  saved: DemoVersionView[];
}

/** 最近歌曲（侧栏「最近歌曲」数据源）：取每个最近项目的代表版本（主版本/最新版本）。 */
export interface RecentSongItem {
  /** 版本 id（歌曲代表版本）。 */
  versionId: string;
  /** 所属项目 id（点击进入 /create/[projectId]）。 */
  projectId: string;
  /** 版本标题（歌曲名）。 */
  title: string;
  /** 所属项目名（小字展示）。 */
  projectName: string;
  /** 版本更新时间（用于排序与展示）。 */
  updatedAt: string;
}
