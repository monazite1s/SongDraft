import { redirect } from "next/navigation";

import { isMockAuthEnabled, isSupabaseConfigured } from "@/infrastructure/auth/config";
import { createAuthServerClient } from "@/infrastructure/auth/server";
import type { AuthUser } from "./types";

const mockUser: AuthUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "demo@songdraft.local",
  displayName: "Demo 创作者",
};

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
