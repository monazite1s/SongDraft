import type { CombinationKey } from "@/shared/contracts/domain";
import type { ArtistProfile } from "@/modules/artists/artist-types";
import type { DemoVersionView } from "@/modules/generation/generation-types";
import type { InspirationListItem } from "@/modules/inspirations/inspiration-types";

export type ProjectStatus = "draft" | "analyzing" | "review" | "ready" | "collaborating" | "archived";

export interface ProjectSummary {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  combination: CombinationKey;
  updatedAt: string;
  createdAt: string;
  artist: ArtistProfile | null;
  eventId: string | null;
}

export interface ProjectDetail extends ProjectSummary {
  lyrics: string | null;
  creativeContext: Record<string, unknown>;
  assets: Array<{ id: string; kind: "text" | "lyrics" | "audio" | "image" | "video"; content: string | null; included: boolean; status: "pending" | "uploading" | "ready" | "failed" | "deleted"; originalName?: string | null; mimeType?: string | null; sizeBytes?: number | null; objectKey?: string | null; previewUrl?: string }>;
}

/** 创作库项目列表项：在 ProjectSummary 上携带灵感数 / 歌曲数 / 封面。 */
export interface ProjectListItem extends ProjectSummary {
  inspirationCount: number;
  versionCount: number;
  coverUrl: string | null;
}

export interface ProjectListPage<T = ProjectSummary> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** 项目详情聚合（/works/[projectId] 数据源）：项目 + 关联灵感 + 版本（歌曲）列表。 */
export interface ProjectDetailAggregate {
  project: ProjectDetail;
  inspirations: InspirationListItem[];
  versions: DemoVersionView[];
}
