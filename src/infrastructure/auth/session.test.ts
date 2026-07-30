import { beforeEach, expect, expectTypeOf, test, vi } from "vitest";

// session.ts 顶部 import next/headers；token 纯函数测试用不到真实实现。
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {} }),
  headers: async () => ({ get: () => null }),
}));

import { createSessionToken, resolveCookieSecure, verifySessionToken } from "./session";

beforeEach(() => {
  process.env.AUTH_SESSION_SECRET = "test-secret-key-very-long";
});

test("createSessionToken → verifySessionToken 往返保留 uid", () => {
  const token = createSessionToken("user-xyz");
  const verified = verifySessionToken(token);
  expect(verified?.uid).toBe("user-xyz");
});

test("篡改 payload 使校验失败", () => {
  const token = createSessionToken("user-xyz");
  const tampered = token.slice(0, -2) + (token.endsWith("A") ? "B" : "A");
  expect(verifySessionToken(tampered)).toBeNull();
});

test("换密钥后旧 token 失效", () => {
  const token = createSessionToken("user-xyz");
  process.env.AUTH_SESSION_SECRET = "a-different-secret-key-also-long";
  expect(verifySessionToken(token)).toBeNull();
});

test("格式错误的 token 返回 null", () => {
  expect(verifySessionToken("garbage")).toBeNull();
  expect(verifySessionToken("a.b.c")).toBeNull();
});

test("verifySessionToken 返回类型为 {uid} | null", () => {
  expectTypeOf(verifySessionToken("x")).toMatchTypeOf<{ uid: string } | null>();
});

test("resolveCookieSecure：COOKIE_SECURE 覆盖优先", () => {
  expect(resolveCookieSecure({ override: "false", forwardedProto: "https", nodeEnv: "production" })).toBe(false);
  expect(resolveCookieSecure({ override: "true", forwardedProto: "http", nodeEnv: "development" })).toBe(true);
});

test("resolveCookieSecure：跟随 X-Forwarded-Proto（Nginx HTTP 反代）", () => {
  expect(resolveCookieSecure({ forwardedProto: "http", nodeEnv: "production" })).toBe(false);
  expect(resolveCookieSecure({ forwardedProto: "https", nodeEnv: "production" })).toBe(true);
  expect(resolveCookieSecure({ forwardedProto: "https, http", nodeEnv: "production" })).toBe(true);
});

test("resolveCookieSecure：跟随 NEXT_PUBLIC_APP_URL", () => {
  expect(resolveCookieSecure({ appUrl: "http://1.2.3.4", nodeEnv: "production" })).toBe(false);
  expect(resolveCookieSecure({ appUrl: "https://app.example", nodeEnv: "development" })).toBe(true);
});
