export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function isMockAuthEnabled() {
  return process.env.AUTH_MODE === "mock" && process.env.NODE_ENV !== "production";
}
