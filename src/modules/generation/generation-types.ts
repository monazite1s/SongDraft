import type { ExecutionKind } from "@/shared/contracts/domain";

export type GenerationStatus = "queued" | "analyzing" | "generating" | "completed" | "failed" | "cancelled";

export interface DemoCandidate {
  id: string;
  versionId: string;
  title: string;
  variation: string;
  durationMs: number;
  executionKind: ExecutionKind;
  hasAudio: boolean;
  audioUrl?: string | null;
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
