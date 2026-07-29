import type { InspirationPrimaryKind, InspirationSnapshot, InspirationSnapshotReason } from "./inspiration-schema";

export interface InspirationRecord {
  id: string;
  ownerId: string;
  projectId: string | null;
  title: string | null;
  primaryKind: InspirationPrimaryKind;
  summary: string | null;
  tags: string[];
  currentSnapshot: InspirationSnapshot;
  currentContentHash: string;
  versionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface InspirationRecordVersion {
  id: string;
  recordId: string;
  versionNo: number;
  snapshot: InspirationSnapshot;
  contentHash: string;
  reason: InspirationSnapshotReason;
  createdBy: string;
  createdAt: string;
}

export interface AutosaveResult {
  record: InspirationRecord;
  versionCreated: boolean;
}
