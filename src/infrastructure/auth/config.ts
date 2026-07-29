export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function isMockAuthEnabled() {
  if (process.env.NODE_ENV === "production") return false;

  const mode = process.env.AUTH_MODE?.trim().toLowerCase();
  if (mode) return mode === "mock";

  // Keep a fresh checkout runnable without requiring third-party credentials.
  return !isSupabaseConfigured();
}

export function getAuthConfigurationError() {
  if (isMockAuthEnabled() || isSupabaseConfigured()) return null;
  return "认证服务尚未配置，请设置 Supabase 环境变量或在本地使用 AUTH_MODE=mock";
}
