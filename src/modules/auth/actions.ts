/**
 * 登录 / 注册 / 登出 Server Actions。
 * AUTH_MODE=mock 时登录直接进入首页；生产不得启用 Mock Auth。
 */
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createAuthServerClient } from "@/infrastructure/auth/server";
import {
  getAuthConfigurationError,
  isMockAuthEnabled,
} from "@/infrastructure/auth/config";

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

/**
 * 安全跳回路径校验：只允许以 "/" 开头且不含 "//" 的相对路径，防开放重定向。
 */
function safeRedirectTarget(raw: string | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.includes("//")) return "/";
  return raw;
}

export async function loginAction(formData: FormData) {
  if (isMockAuthEnabled()) {
    redirect(safeRedirectTarget(typeof formData.get("redirect") === "string" ? (formData.get("redirect") as string) : undefined));
  }
  ensureAuthConfigured("/login");
  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirectWithError("/login", parsed.error.issues[0]?.message ?? "登录信息无效");
  const redirectTo = safeRedirectTarget(parsed.data.redirect);

  const supabase = await createAuthServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) redirect(`/login?error=${encodeURIComponent("邮箱或密码不正确")}`);
  redirect(redirectTo);
}

export async function registerAction(formData: FormData) {
  if (isMockAuthEnabled()) redirect("/");
  ensureAuthConfigured("/register");
  const parsed = registrationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirectWithError("/register", parsed.error.issues[0]?.message ?? "注册信息无效");

  const { displayName, email, password, redirect: _redirect } = parsed.data;
  const supabase = await createAuthServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) {
    // 透出 Supabase 真实错误（status/code/message），便于定位：captcha、限流、已注册等。
    console.error("[auth] signUp 失败 status=", error.status, "code=", error.code, "msg=", error.message);
    redirect(`/register?error=${encodeURIComponent(`注册失败：${error.message}`)}`);
  }
  // signUp 成功但无 session：通常是 Supabase 开启了「邮箱确认」。此时用户尚未确认，无法直接登录。
  if (!data.session) {
    redirect(`/register?error=${encodeURIComponent("已创建账号，但 Supabase 开启了邮箱确认——需到邮箱点确认链接后才能登录；或在 Supabase 关闭 Confirm email。")}`);
  }
  redirect("/");
}

export async function logoutAction() {
  if (isMockAuthEnabled()) redirect("/login");
  ensureAuthConfigured("/login");
  const supabase = await createAuthServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
