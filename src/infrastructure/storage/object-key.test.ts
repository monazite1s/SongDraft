import { expect, test } from "vitest";

import { createObjectKey, getSafeExtension, isOwnedObjectKey } from "./object-key";

test("creates an isolated object key without the original filename", () => {
  const key = createObjectKey({ environment: "dev", userId: "user-a", scope: { type: "project", id: "project-a" }, kind: "audio", filename: "我的 灵感.webm", objectId: "asset-a" });
  expect(key).toBe("dev/users/user-a/projects/project-a/audio/asset-a.webm");
  expect(isOwnedObjectKey(key, "user-a")).toBe(true);
});

test("rejects an executable extension", () => {
  expect(() => getSafeExtension("track.exe")).toThrow("不支持的文件扩展名");
});
