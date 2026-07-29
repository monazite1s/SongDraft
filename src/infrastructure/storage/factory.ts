/**
 * 对象存储工厂（docs/technical-design.md §6）
 * STORAGE_DRIVER=cos → 腾讯云 COS；否则本地 Mock（浏览器经签名 URL 直传）。
 */
/**
 * 对象存储工厂（docs/technical-design.md §6）
 * STORAGE_DRIVER=cos → 腾讯云 COS；否则本地 Mock。密钥仅服务端读取。
 */
import "server-only";

import type { ObjectStorage } from "./contracts";
import { MockObjectStorage } from "./mock-storage";
import { TencentCosStorage } from "./tencent-cos-storage";

let storage: ObjectStorage | undefined;

export function getObjectStorage(): ObjectStorage {
  if (storage) return storage;
  storage = process.env.STORAGE_DRIVER === "cos" ? new TencentCosStorage() : new MockObjectStorage();
  return storage;
}
