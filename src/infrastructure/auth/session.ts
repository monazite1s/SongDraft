/**
 * 会话 Cookie（自写 Auth）：HMAC-SHA256 签名，httpOnly。
 * 格式：`base64url(payload).base64url(hmac)`，payload = {uid, exp}。7 天有效。
 * 密钥来自 AUTH_SESSION_SECRET；生产缺密钥由 config 层 fail-fast，dev 自动用临时密钥。
 */
import "server-only";

import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "sd_session";
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

let ephemeralSecret = "";

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
  if (!token) return null;
  const verified = verifySessionToken(token);
  return verified?.uid ?? null;
}

export async function setSessionCookie(uid: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, createSessionToken(uid), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}
