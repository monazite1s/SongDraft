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
}

/** 将候选保存为正式版本的结果。 */
export interface SaveCandidatesResult {
  saved: DemoVersionView[];
}
