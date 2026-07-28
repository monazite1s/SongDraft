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
