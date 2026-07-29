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

/** 灵感库查询条件（docs/implementation-todo.md §8.5 子集）。 */
export interface InspirationListFilters {
  query?: string;
  kinds?: InspirationPrimaryKind[];
  attached?: "all" | "unattached" | "attached";
  tags?: string[];
  sort?: "updated" | "created";
  page?: number;
  pageSize?: number;
}

/** 灵感库列表项：只载列表所需字段，不加载完整 snapshot。 */
export interface InspirationListItem {
  id: string;
  title: string | null;
  primaryKind: InspirationPrimaryKind;
  summary: string | null;
  tags: string[];
  projectId: string | null;
  projectName: string | null;
  versionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface InspirationListPage {
  items: InspirationListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface InspirationDetail {
  record: InspirationRecord;
  versions: InspirationRecordVersion[];
}

