/**
 * 登录 / 注册 / 登出 Server Actions（自写 Auth，脱离 Supabase）。
 * email + 密码，不验证邮箱；密码 scrypt 哈希，session 为 HMAC 签名 cookie。
 * AUTH_MODE=mock / 本地无 DB 时直接进入首页；生产不得启用 Mock Auth。
 */
"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getDatabase } from "@/infrastructure/db/client";
import { profiles } from "@/infrastructure/db/schema";
import { getAuthConfigurationError, isMockAuthEnabled } from "@/infrastructure/auth/config";
import { hashPassword, verifyPassword } from "@/infrastructure/auth/password";
import { clearSessionCookie, setSessionCookie } from "@/infrastructure/auth/session";

const credentialsSchema = z.object({
  email: z.string().email("请输入有效邮箱"),
  password: z.string().min(8, "密码至少 8 位"),
  redirect: z.string().optional(),
});

const registrationSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(1, "请输入昵称").max(40, "昵称最多 40 个字符"),
});

function redirectWithError(path: "/login" | "/register", message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function ensureAuthConfigured(path: "/login" | "/register") {
  const error = getAuthConfigurationError();
  if (error) redirectWithError(path, error);
}

/** 安全跳回路径校验：只允许以 "/" 开头且不含 "//" 的相对路径，防开放重定向。 */
function safeRedirectTarget(raw: string | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.includes("//")) return "/";
  return raw;
}

async function findProfileByEmail(email: string) {
  const [row] = await getDatabase().select({ id: profiles.id, email: profiles.email, displayName: profiles.displayName, passwordHash: profiles.passwordHash }).from(profiles).where(eq(profiles.email, email)).limit(1);
  return row ?? null;
}

export async function loginAction(formData: FormData) {
  if (isMockAuthEnabled()) {
    redirect(safeRedirectTarget(typeof formData.get("redirect") === "string" ? (formData.get("redirect") as string) : undefined));
  }
  ensureAuthConfigured("/login");
  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirectWithError("/login", parsed.error.issues[0]?.message ?? "登录信息无效");
  const redirectTo = safeRedirectTarget(parsed.data.redirect);

  const profile = await findProfileByEmail(parsed.data.email);
  // 邮箱不存在 / 未设密码 / 密码错：统一模糊提示，避免探测邮箱是否注册。
  if (!profile?.passwordHash || !(await verifyPassword(parsed.data.password, profile.passwordHash))) {
    redirectWithError("/login", "邮箱或密码不正确");
  }
  await setSessionCookie(profile.id);
  redirect(redirectTo);
}

export async function registerAction(formData: FormData) {
  if (isMockAuthEnabled()) redirect("/");
  ensureAuthConfigured("/register");
  const parsed = registrationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirectWithError("/register", parsed.error.issues[0]?.message ?? "注册信息无效");

  const { displayName, email, password } = parsed.data;
  const existing = await findProfileByEmail(email);
  if (existing) redirectWithError("/register", "该邮箱已注册，请直接登录");

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  try {
    await getDatabase().insert(profiles).values({ id, email, displayName, passwordHash });
  } catch (error) {
    console.error("[auth] 注册写库失败：", error);
    redirectWithError("/register", "注册失败，请稍后重试");
  }
  await setSessionCookie(id);
  redirect("/");
}

export async function logoutAction() {
  if (isMockAuthEnabled()) redirect("/login");
  ensureAuthConfigured("/login");
  await clearSessionCookie();
  redirect("/login");
}
