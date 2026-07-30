/**
 * 认证配置（自写 Auth，脱离 Supabase）。
 * - 本地无 DB 时返回固定 Demo 用户（isMockAuthEnabled），生产禁用。
 * - 生产需 DATABASE_URL（查 profiles）+ AUTH_SESSION_SECRET（签发 session）。
 */
export function isSelfAuthConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.AUTH_SESSION_SECRET);
}

/** 是否启用开发 Mock Auth：生产恒为 false；本地无 DB 时默认 mock（零配置可跑）。 */
export function isMockAuthEnabled() {
  if (process.env.NODE_ENV === "production") return false;
  const mode = process.env.AUTH_MODE?.trim().toLowerCase();
  if (mode) return mode === "mock";
  return !process.env.DATABASE_URL;
}

export function getAuthConfigurationError() {
  if (isMockAuthEnabled() || isSelfAuthConfigured()) return null;
  if (!process.env.DATABASE_URL) return "认证服务尚未配置：缺少 DATABASE_URL";
  return "认证服务尚未配置：缺少 AUTH_SESSION_SECRET（随机 32+ 字符）";
}
