/**
 * 创作对话与歌词精修流程（docs/technical-design.md §3）
 *
 * 顺序固定为：校验项目所有权 → 读取最近 20 条历史 → 保存 user 消息
 * → 调用 LyricAssistant（DeepSeek/Mock）→ 保存 assistant 消息 → 回写项目当前歌词。
 * 入口：POST /api/creative-chat/stream。
 */
import { and, asc, eq } from "drizzle-orm";

import { getDatabase } from "@/infrastructure/db/client";
import { creativeConversations, creativeMessages } from "@/infrastructure/db/schema";
import { getArtistCatalog } from "@/modules/artists/artist-catalog";
import type { AuthUser } from "@/modules/auth/types";
import { getLyricAssistant } from "@/modules/ai/lyric-assistant";
import { ProjectService } from "@/modules/projects/project-service";
import { DomainError } from "@/shared/errors/domain-error";

export interface ConversationMessageView { id: string; role: "user" | "assistant"; content: string; eventRefs: string[]; createdAt: string; }
export interface ConversationView { id: string; projectId: string; messages: ConversationMessageView[]; }

const songDraftConversationStore = globalThis as typeof globalThis & {
  __songDraftConversations?: Map<string, ConversationView>;
};
const mockConversations = songDraftConversationStore.__songDraftConversations ??= new Map<string, ConversationView>();

async function ensureConversation(owner: AuthUser, projectId: string): Promise<ConversationView> {
  await new ProjectService().get(owner.id, projectId);
  if (!process.env.DATABASE_URL) {
    const existing = mockConversations.get(projectId);
    if (existing) return existing;
    const created = { id: crypto.randomUUID(), projectId, messages: [] };
    mockConversations.set(projectId, created);
    return created;
  }
  const db = getDatabase();
  const [existing] = await db.select({ id: creativeConversations.id, projectId: creativeConversations.projectId }).from(creativeConversations).where(and(eq(creativeConversations.projectId, projectId), eq(creativeConversations.ownerId, owner.id))).limit(1);
  if (existing) return { ...existing, messages: [] };
  const [created] = await db.insert(creativeConversations).values({ projectId, ownerId: owner.id }).returning({ id: creativeConversations.id, projectId: creativeConversations.projectId });
  if (!created) throw new Error("Conversation creation failed");
  return { ...created, messages: [] };
}

async function appendMessage(conversation: ConversationView, role: "user" | "assistant", content: string, eventRefs: string[], lyricRevision?: Record<string, unknown>) {
  const createdAt = new Date().toISOString();
  if (!process.env.DATABASE_URL) {
    const message = { id: crypto.randomUUID(), role, content, eventRefs, createdAt };
    conversation.messages.push(message);
    return message;
  }
  const [row] = await getDatabase().insert(creativeMessages).values({ conversationId: conversation.id, role, content, eventRefs, lyricRevision }).returning();
  if (!row) throw new Error("Message creation failed");
  return { id: row.id, role, content, eventRefs: row.eventRefs, createdAt: row.createdAt.toISOString() } as ConversationMessageView;
}

async function listMessages(conversation: ConversationView): Promise<ConversationMessageView[]> {
  if (!process.env.DATABASE_URL) return structuredClone(conversation.messages);
  const rows = await getDatabase().select().from(creativeMessages).where(eq(creativeMessages.conversationId, conversation.id)).orderBy(asc(creativeMessages.createdAt));
  return rows.map((row) => ({ id: row.id, role: row.role === "assistant" ? "assistant" : "user", content: row.content, eventRefs: row.eventRefs, createdAt: row.createdAt.toISOString() }));
}

export class ConversationService {
  /** 一轮创作对话：无 projectId 时先建项目，有历史则带入模型上下文。 */
  async respond(owner: AuthUser, input: { projectId?: string; artistId?: string | null; message: string; eventIds?: string[]; currentLyrics?: string | null }) {
    const artist = input.artistId ? await getArtistCatalog().findById(input.artistId) : null;
    if (input.artistId && !artist) throw new DomainError("VALIDATION_FAILED", 422, "艺人不存在");
    // 1. 校验或创建项目
    const project = input.projectId
      ? await new ProjectService().get(owner.id, input.projectId)
      : await new ProjectService().create(owner, { title: artist ? `${artist.name}应援歌` : input.message.slice(0, 24), description: input.message, artistId: artist?.id, eventId: input.eventIds?.[0] });
    const conversation = await ensureConversation(owner, project.id);
    // 2. 最近 20 条历史供 DeepSeek 续聊
    const history = (await listMessages(conversation)).slice(-20).map(({ role, content }) => ({ role, content }));
    // 3. 先落库 user，再调模型，再落库 assistant
    await appendMessage(conversation, "user", input.message, input.eventIds ?? []);
    const draft = await getLyricAssistant().createDraft({ projectId: project.id, artist, message: input.message, eventIds: input.eventIds ?? [], currentLyrics: input.currentLyrics ?? project.lyrics, history });
    const assistant = await appendMessage(conversation, "assistant", draft.message, input.eventIds ?? [], draft.lyrics ? { lyrics: draft.lyrics } : undefined);
    // 4. 回写当前歌词与创作上下文
    await new ProjectService().updateDraft(owner.id, project.id, { artistId: artist?.id ?? null, eventId: input.eventIds?.[0] ?? null, currentLyrics: draft.lyrics ?? input.currentLyrics ?? project.lyrics, creativeContext: draft.context });
    return { projectId: project.id, messageId: assistant.id, ...draft };
  }

  async get(owner: AuthUser, projectId: string): Promise<ConversationView> {
    const conversation = await ensureConversation(owner, projectId);
    return { ...conversation, messages: await listMessages(conversation) };
  }
}
