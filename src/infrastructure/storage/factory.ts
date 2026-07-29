/**
 * 对象存储工厂（docs/technical-design.md §6）
 * STORAGE_DRIVER=cos → 腾讯云 COS；否则本地 Mock。密钥仅服务端读取。
 *
 * 安全：声明 cos 但缺凭据时 **不再静默降级**（生产误用风险）。
 * - 非宽松环境（生产 / 有 DATABASE_URL）→ throw fail-fast（见 assertStorageConfig）。
 * - 宽松环境（本地零配置 / test）→ 回退 mock 并 warn。
 */
import "server-only";

import { assertStorageConfig } from "@/infrastructure/env";

import type { ObjectStorage } from "./contracts";
import { MockObjectStorage } from "./mock-storage";
import { TencentCosStorage } from "./tencent-cos-storage";

let storage: ObjectStorage | undefined;

export function getObjectStorage(): ObjectStorage {
  if (storage) return storage;

  if (process.env.STORAGE_DRIVER === "cos") {
    // cos 声明：校验凭据。
    // - 非宽松环境缺凭据 → assertStorageConfig 直接 throw（fail-fast，不静默回落）。
    // - 宽松环境缺凭据 → 返回 false，回退 mock 并 warn（保护本地开发）。
    // - 凭据齐全 → 返回 true，构建真实 COS 客户端。
    const cosReady = assertStorageConfig();
    storage = cosReady ? new TencentCosStorage() : new MockObjectStorage();
  } else {
    // 未声明 driver（默认 mock）或 STORAGE_DRIVER=mock。
    storage = new MockObjectStorage();
  }
  return storage;
}
