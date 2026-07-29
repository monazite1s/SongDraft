/**
 * 当前用户查询（docs/technical-design.md §6）
 * AUTH_MODE=mock 时返回固定 Demo 用户；生产禁用 Mock Auth，改走 Supabase。
 * Route Handler / Server Component 统一经此取会话，浏览器不接触 Provider Key。
 */
import { redirect } from "next/navigation";

import { isMockAuthEnabled, isSupabaseConfigured } from "@/infrastructure/auth/config";
import { createAuthServerClient } from "@/infrastructure/auth/server";
import type { AuthUser } from "./types";

const mockUser: AuthUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "demo@songdraft.local",
  displayName: "Demo 创作者",
};

/** 当前登录用户；Mock 模式返回固定 Demo 用户。 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  if (isMockAuthEnabled()) return mockUser;
  if (!isSupabaseConfigured()) return null;

  const supabase = await createAuthServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;

  return {
    id: data.user.id,
    email: data.user.email,
    displayName: String(data.user.user_metadata.display_name || data.user.email.split("@")[0]),
  };
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
