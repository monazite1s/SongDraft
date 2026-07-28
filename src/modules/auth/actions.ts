"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createAuthServerClient } from "@/infrastructure/auth/server";

const credentialsSchema = z.object({
  email: z.string().email("请输入有效邮箱"),
  password: z.string().min(8, "密码至少 8 位"),
});

export async function loginAction(formData: FormData) {
  const credentials = credentialsSchema.parse(Object.fromEntries(formData));
  const supabase = await createAuthServerClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) redirect(`/login?error=${encodeURIComponent("邮箱或密码不正确")}`);
  redirect("/");
}

export async function registerAction(formData: FormData) {
  const credentials = credentialsSchema.parse(Object.fromEntries(formData));
  const displayName = z.string().trim().min(1).max(40).parse(formData.get("displayName"));
  const supabase = await createAuthServerClient();
  const { error } = await supabase.auth.signUp({
    ...credentials,
    options: { data: { display_name: displayName } },
  });
  if (error) redirect(`/register?error=${encodeURIComponent("注册失败，请稍后重试")}`);
  redirect("/");
}

export async function logoutAction() {
  const supabase = await createAuthServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
