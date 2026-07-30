/**
 * 会话 Cookie（自写 Auth）：HMAC-SHA256 签名，httpOnly。
 * 格式：`base64url(payload).base64url(hmac)`，payload = {uid, exp}。7 天有效。
 * 密钥来自 AUTH_SESSION_SECRET；生产缺密钥由 config 层 fail-fast，dev 自动用临时密钥。
 */
import "server-only";

import { cookies, headers } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "sd_session";
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

let ephemeralSecret = "";

export type CookieSecureInput = {
  override?: string | undefined;
  forwardedProto?: string | null | undefined;
  appUrl?: string | undefined;
  nodeEnv?: string | undefined;
};

/**
 * 是否给 session cookie 加 Secure。
 * Secure cookie 在纯 HTTP 下会被浏览器丢弃 → 登录 303 后后续接口全未认证。
 *
 * 优先级：COOKIE_SECURE 显式覆盖 → X-Forwarded-Proto → NEXT_PUBLIC_APP_URL scheme → production 默认 true。
 * 腾讯云 HTTP + Nginx（已设 X-Forwarded-Proto $scheme）会自动得到 false。
 */
export function resolveCookieSecure(input: CookieSecureInput = {}): boolean {
  const override = input.override?.trim().toLowerCase();
  if (override === "true") return true;
  if (override === "false") return false;

  const proto = input.forwardedProto?.split(",")[0]?.trim().toLowerCase();
  if (proto === "https") return true;
  if (proto === "http") return false;

  const appUrl = input.appUrl?.trim() ?? "";
  if (appUrl.startsWith("https://")) return true;
  if (appUrl.startsWith("http://")) return false;

  return (input.nodeEnv ?? process.env.NODE_ENV) === "production";
}

async function cookieSecure(): Promise<boolean> {
  const h = await headers();
  return resolveCookieSecure({
    override: process.env.COOKIE_SECURE,
    forwardedProto: h.get("x-forwarded-proto"),
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    nodeEnv: process.env.NODE_ENV,
  });
}

function getSecret(): string {
  const env = process.env.AUTH_SESSION_SECRET;
  if (env) return env;
  // 生产缺密钥不应走到这（config 层已 fail-fast）；兜底抛错避免用弱密钥签发。
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SESSION_SECRET 未配置");
  if (!ephemeralSecret) {
    ephemeralSecret = randomBytes(32).toString("hex");
    console.warn("[auth] 未设置 AUTH_SESSION_SECRET，dev 用临时密钥（重启会话失效）");
  }
  return ephemeralSecret;
}

function sign(payloadB64: string): string {
  return createHmac("sha256", getSecret()).update(payloadB64).digest("base64url");
}

function b64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

export function createSessionToken(uid: string): string {
  const payload = JSON.stringify({ uid, exp: Date.now() + MAX_AGE_SECONDS * 1000 });
  const payloadB64 = b64url(payload);
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifySessionToken(token: string): { uid: string } | null {
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;
  const expected = sign(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as { uid?: string; exp?: number };
    if (!payload.uid || typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return { uid: payload.uid };
  } catch {
    return null;
  }
}

/** 读取当前请求的会话 uid；无/无效/过期返回 null。 */
export async function readSessionUid(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) { console.warn("[auth] readSessionUid: 无 sd_session cookie"); return null; }
  const verified = verifySessionToken(token);
  if (!verified) { console.warn("[auth] readSessionUid: sd_session token 校验失败/过期（可能 AUTH_SESSION_SECRET 不一致或已轮换）"); return null; }
  return verified.uid;
}

export async function setSessionCookie(uid: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, createSessionToken(uid), {
    httpOnly: true,
    secure: await cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "", { httpOnly: true, secure: await cookieSecure(), sameSite: "lax", path: "/", maxAge: 0 });
}
