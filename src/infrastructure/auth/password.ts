/**
 * 口令哈希（自写 Auth，不依赖 Supabase Auth）。
 * 用 Node 内置 crypto.scrypt：salt 16B 随机，N=16384/r=8/p=1，keylen=64。
 * 存储格式：`${saltHex}$${hashHex}`。校验用 timingSafeEqual，常数时间防泄漏。
 */
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: { N?: number; r?: number; p?: number },
) => Promise<Buffer>;

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEYLEN = 64;
const SALT_BYTES = 16;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(plain, salt, KEYLEN, SCRYPT_PARAMS);
  return `${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split("$");
  if (!saltHex || !hashHex) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  const derived = await scrypt(plain, salt, KEYLEN, SCRYPT_PARAMS);
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
