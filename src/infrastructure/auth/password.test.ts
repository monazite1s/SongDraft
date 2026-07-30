import { expect, test } from "vitest";

import { hashPassword, verifyPassword } from "./password";

test("hashPassword → verifyPassword 正确口令通过", async () => {
  const stored = await hashPassword("correct horse battery");
  expect(stored).toContain("$");
  await expect(verifyPassword("correct horse battery", stored)).resolves.toBe(true);
});

test("错误口令不通过", async () => {
  const stored = await hashPassword("correct horse battery");
  await expect(verifyPassword("wrong password", stored)).resolves.toBe(false);
});

test("相同口令每次哈希不同（随机 salt）", async () => {
  const a = await hashPassword("same-password-123");
  const b = await hashPassword("same-password-123");
  expect(a).not.toBe(b);
  await expect(verifyPassword("same-password-123", a)).resolves.toBe(true);
  await expect(verifyPassword("same-password-123", b)).resolves.toBe(true);
});

test("损坏的存储值返回 false 而非抛错", async () => {
  await expect(verifyPassword("x", "not-a-valid-hash")).resolves.toBe(false);
  await expect(verifyPassword("x", "")).resolves.toBe(false);
});
