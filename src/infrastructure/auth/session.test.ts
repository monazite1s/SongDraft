import { beforeEach, expect, expectTypeOf, test, vi } from "vitest";

// session.ts 顶部 import next/headers 的 cookies；这里桩一个空实现，token 纯函数测试用不到。
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {} }) }));

import { createSessionToken, verifySessionToken } from "./session";

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
