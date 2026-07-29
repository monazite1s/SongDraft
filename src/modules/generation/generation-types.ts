import type { CombinationKey, ExecutionKind, OutputType } from "@/shared/contracts/domain";

export type GenerationStatus = "queued" | "analyzing" | "generating" | "completed" | "failed" | "cancelled";

export interface DemoCandidate {
  id: string;
  versionId: string;
  title: string;
  variation: string;
  durationMs: number;
  executionKind: ExecutionKind;
  hasAudio: boolean;
}

export interface GenerationResult {
  jobId: string;
  status: GenerationStatus;
  progress: number;
  plan: { id: string; combination: CombinationKey; outputType: OutputType; providerName: string; confirmedAt: string; steps: Array<{ title: string; executionKind: ExecutionKind; detail: string }> };
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
}
