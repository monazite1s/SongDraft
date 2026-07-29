import type { CombinationKey } from "@/shared/contracts/domain";
import type { ArtistProfile } from "@/modules/artists/artist-types";

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

export interface ProjectListPage {
  items: ProjectSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
