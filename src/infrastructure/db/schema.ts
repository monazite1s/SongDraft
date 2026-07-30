import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const projectStatus = pgEnum("project_status", [
  "draft",
  "analyzing",
  "review",
  "ready",
  "collaborating",
  "archived",
]);
export const assetKind = pgEnum("asset_kind", ["text", "lyrics", "audio", "image", "video"]);
export const assetStatus = pgEnum("asset_status", ["pending", "uploading", "ready", "failed", "deleted"]);
export const inspirationRecordKind = pgEnum("inspiration_record_kind", ["audio", "image", "text"]);
export const inspirationSnapshotReason = pgEnum("inspiration_snapshot_reason", ["autosave", "manual", "restore", "attach"]);
export const executionKind = pgEnum("execution_kind", ["real_local", "real_external", "simulated"]);
export const jobStatus = pgEnum("job_status", ["queued", "analyzing", "generating", "completed", "failed", "cancelled"]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  avatarObjectKey: text("avatar_object_key"),
  /** 自写 Auth：scrypt 口令哈希（salt$hash）。可空兼容无口令历史行。 */
  passwordHash: text("password_hash"),
  ...timestamps,
});

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: projectStatus("status").notNull().default("draft"),
    coverAssetId: uuid("cover_asset_id"),
    mainVersionId: uuid("main_version_id"),
    artistId: text("artist_id"),
    artistSnapshot: jsonb("artist_snapshot").$type<Record<string, unknown>>(),
    creativeContext: jsonb("creative_context").$type<Record<string, unknown>>().notNull().default({}),
    currentLyrics: text("current_lyrics"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("projects_owner_updated_idx").on(table.ownerId, table.updatedAt)],
);

export const creativeConversations = pgTable(
  "creative_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => [uniqueIndex("conversations_project_idx").on(table.projectId), index("conversations_owner_updated_idx").on(table.ownerId, table.updatedAt)],
);

export const creativeMessages = pgTable(
  "creative_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").notNull().references(() => creativeConversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    eventRefs: jsonb("event_refs").$type<string[]>().notNull().default([]),
    lyricRevision: jsonb("lyric_revision").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("messages_conversation_created_idx").on(table.conversationId, table.createdAt)],
);

/**
 * A quick-capture record is independent from project creation. This lets users
 * persist an idea first, then decide where it belongs.
 */
export const inspirationRecords = pgTable(
  "inspiration_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    title: text("title"),
    primaryKind: inspirationRecordKind("primary_kind").notNull(),
    summary: text("summary"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    currentSnapshot: jsonb("current_snapshot").$type<Record<string, unknown>>().notNull().default({}),
    currentContentHash: text("current_content_hash").notNull(),
    versionCount: integer("version_count").notNull().default(1),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("inspiration_records_owner_updated_idx").on(table.ownerId, table.updatedAt),
    index("inspiration_records_owner_project_updated_idx").on(table.ownerId, table.projectId, table.updatedAt),
    index("inspiration_records_owner_kind_updated_idx").on(table.ownerId, table.primaryKind, table.updatedAt),
  ],
);

/** Immutable snapshots are added only when their canonical content hash changes. */
export const inspirationRecordVersions = pgTable(
  "inspiration_record_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recordId: uuid("record_id").notNull().references(() => inspirationRecords.id, { onDelete: "cascade" }),
    versionNo: integer("version_no").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    contentHash: text("content_hash").notNull(),
    reason: inspirationSnapshotReason("reason").notNull().default("autosave"),
    createdBy: uuid("created_by").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("inspiration_record_versions_number_idx").on(table.recordId, table.versionNo),
    uniqueIndex("inspiration_record_versions_hash_idx").on(table.recordId, table.contentHash),
  ],
);

export const inspirationAssets = pgTable(
  "inspiration_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    recordId: uuid("record_id").references(() => inspirationRecords.id, { onDelete: "set null" }),
    ownerId: uuid("owner_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    kind: assetKind("kind").notNull(),
    content: text("content"),
    objectKey: text("object_key"),
    originalName: text("original_name"),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    durationMs: integer("duration_ms"),
    included: boolean("included").notNull().default(true),
    status: assetStatus("status").notNull().default("pending"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [
    index("assets_project_created_idx").on(table.projectId, table.createdAt),
    index("assets_record_created_idx").on(table.recordId, table.createdAt),
    // An uploaded file may be pending project selection, but must always have an owner scope.
    check("assets_project_or_record_check", sql`${table.projectId} IS NOT NULL OR ${table.recordId} IS NOT NULL`),
  ],
);

export const analysisResults = pgTable("analysis_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  assetId: uuid("asset_id").references(() => inspirationAssets.id, { onDelete: "set null" }),
  analyzer: text("analyzer").notNull(),
  provider: text("provider").notNull(),
  executionKind: executionKind("execution_kind").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  limitations: jsonb("limitations").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const creativeBriefs = pgTable("creative_briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull().default(1),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  /** 生成该简报所用 system prompt 的版本（PROMPT_VERSIONS.brief），可空以兼容历史数据。 */
  promptVersion: text("prompt_version"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdBy: uuid("created_by").notNull().references(() => profiles.id),
  ...timestamps,
});

export const providerConfigs = pgTable("provider_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  name: text("name").notNull(),
  baseUrl: text("base_url"),
  encryptedSecret: text("encrypted_secret"),
  capabilities: jsonb("capabilities").$type<Record<string, unknown>>().notNull().default({}),
  enabled: boolean("enabled").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  ...timestamps,
});

export const generationPlans = pgTable("generation_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  briefId: uuid("brief_id").notNull().references(() => creativeBriefs.id, { onDelete: "cascade" }),
  providerConfigId: uuid("provider_config_id").references(() => providerConfigs.id, { onDelete: "set null" }),
  providerName: text("provider_name").notNull(),
  outputType: text("output_type").notNull(),
  combination: text("combination").notNull(),
  steps: jsonb("steps").$type<Record<string, unknown>[]>().notNull(),
  warnings: jsonb("warnings").$type<string[]>().notNull().default([]),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const generationJobs = pgTable(
  "generation_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    planId: uuid("plan_id").notNull().references(() => generationPlans.id, { onDelete: "cascade" }),
    idempotencyKey: text("idempotency_key").notNull(),
    status: jobStatus("status").notNull().default("queued"),
    progress: integer("progress").notNull().default(0),
    attempt: integer("attempt").notNull().default(0),
    errorCode: text("error_code"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("jobs_idempotency_idx").on(table.idempotencyKey),
    index("jobs_project_created_idx").on(table.projectId, table.createdAt),
  ],
);

export const demoVersions = pgTable("demo_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id"),
  versionNo: integer("version_no").notNull(),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
  isMain: boolean("is_main").notNull().default(false),
  createdBy: uuid("created_by").notNull().references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const demoAssets = pgTable("demo_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  versionId: uuid("version_id").notNull().references(() => demoVersions.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").references(() => generationJobs.id, { onDelete: "set null" }),
  objectKey: text("object_key").notNull(),
  durationMs: integer("duration_ms").notNull(),
  executionKind: executionKind("execution_kind").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * 生成候选（docs/SPEC.md §7.4）：生成完成只创建候选，用户点「保存为版本」后才进入
 * demo_versions 正式历史。未保存候选可删除，不污染版本树。savedVersionId 在保存后回填。
 */
export const generationCandidates = pgTable(
  "generation_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id").notNull().references(() => generationJobs.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    objectKey: text("object_key"),
    audioUrl: text("audio_url"),
    durationMs: integer("duration_ms").notNull(),
    executionKind: executionKind("execution_kind").notNull(),
    /** 音乐生成所用 prompt 版本（PROMPT_VERSIONS.music）与模型名，可空以兼容历史数据。 */
    promptVersion: text("prompt_version"),
    modelVersion: text("model_version"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    savedVersionId: uuid("saved_version_id").references(() => demoVersions.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("candidates_project_created_idx").on(table.projectId, table.createdAt),
    index("candidates_job_idx").on(table.jobId),
  ],
);

export const shareLinks = pgTable(
  "share_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    versionId: uuid("version_id").notNull().references(() => demoVersions.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    allowComments: boolean("allow_comments").notNull().default(true),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdBy: uuid("created_by").notNull().references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("shares_token_hash_idx").on(table.tokenHash)],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    versionId: uuid("version_id").notNull().references(() => demoVersions.id, { onDelete: "cascade" }),
    shareId: uuid("share_id").references(() => shareLinks.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id").references(() => profiles.id, { onDelete: "set null" }),
    guestName: text("guest_name"),
    content: text("content").notNull(),
    atMs: integer("at_ms"),
    readAt: timestamp("read_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("comments_version_created_idx").on(table.versionId, table.createdAt)],
);

/**
 * 分享访问授权（docs/SPEC.md §7 分享权限白名单）。
 * 首次有效访问时为已登录访问者建立授权记录；撤销后 revoked_at 非空。
 * partial unique 保证同一 share + accessor 仅有一条未撤销记录，防重复授权。
 */
export const shareAccessGrants = pgTable(
  "share_access_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shareId: uuid("share_id").notNull().references(() => shareLinks.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    accessorUserId: uuid("accessor_user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    grantedBy: uuid("granted_by").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    firstAccessedAt: timestamp("first_accessed_at", { withTimezone: true }),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("share_grants_share_accessor_idx").on(table.shareId, table.accessorUserId).where(sql`${table.revokedAt} IS NULL`),
    index("share_grants_accessor_project_idx").on(table.accessorUserId, table.projectId),
  ],
);
