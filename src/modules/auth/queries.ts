/**
 * 当前用户查询（自写 Auth，脱离 Supabase）。
 * Route Handler / Server Component 统一经此取会话：读签名 cookie → 查 profiles。
 * AUTH_MODE=mock 或本地无 DB 时返回固定 Demo 用户；生产禁用 Mock。
 * 用 React cache() 在同一请求内去重——layout 与 page 都调用时只查一次 DB。
 */
import { cache } from "react";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getDatabase } from "@/infrastructure/db/client";
import { profiles } from "@/infrastructure/db/schema";
import { isMockAuthEnabled } from "@/infrastructure/auth/config";
import { readSessionUid } from "@/infrastructure/auth/session";
import type { AuthUser } from "./types";

const mockUser: AuthUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "demo@songdraft.local",
  displayName: "Demo 创作者",
};

/** 当前登录用户：读 session cookie → 查 profiles；Mock 模式返回固定 Demo 用户。同一请求内缓存。 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  if (isMockAuthEnabled()) return mockUser;

  const uid = await readSessionUid();
  if (!uid) return null;

  const [row] = await getDatabase().select({ id: profiles.id, email: profiles.email, displayName: profiles.displayName }).from(profiles).where(eq(profiles.id, uid)).limit(1);
  if (!row) return null;
  return { id: row.id, email: row.email, displayName: row.displayName };
});

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
