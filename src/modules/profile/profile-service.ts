import { eq } from "drizzle-orm";

import { getDatabase } from "@/infrastructure/db/client";
import { profiles } from "@/infrastructure/db/schema";
import type { AuthUser } from "@/modules/auth/types";
import { DomainError } from "@/shared/errors/domain-error";

export interface ProfileView { id: string; email: string; displayName: string; avatarObjectKey: string | null; }
const mockProfiles = new Map<string, ProfileView>();

export class ProfileService {
  async get(user: AuthUser): Promise<ProfileView> {
    if (!process.env.DATABASE_URL) { const existing = mockProfiles.get(user.id); if (existing) return existing; const profile = { id: user.id, email: user.email, displayName: user.displayName, avatarObjectKey: null }; mockProfiles.set(user.id, profile); return profile; }
    const db = getDatabase();
    const [profile] = await db.insert(profiles).values({ id: user.id, email: user.email, displayName: user.displayName }).onConflictDoUpdate({ target: profiles.id, set: { email: user.email, updatedAt: new Date() } }).returning();
    if (!profile) throw new Error("Profile upsert failed"); return { id: profile.id, email: profile.email, displayName: profile.displayName, avatarObjectKey: profile.avatarObjectKey };
  }

  async update(user: AuthUser, input: { displayName: string }) {
    const displayName = input.displayName.trim();
    if (!displayName || displayName.length > 40) throw new DomainError("VALIDATION_FAILED", 422, "昵称需为 1–40 字");
    if (!process.env.DATABASE_URL) { const profile = await this.get(user); const updated = { ...profile, displayName }; mockProfiles.set(user.id, updated); return updated; }
    const [profile] = await getDatabase().update(profiles).set({ displayName, updatedAt: new Date() }).where(eq(profiles.id, user.id)).returning();
    if (!profile) throw new DomainError("NOT_FOUND", 404, "用户资料不存在"); return { id: profile.id, email: profile.email, displayName: profile.displayName, avatarObjectKey: profile.avatarObjectKey };
  }
}
