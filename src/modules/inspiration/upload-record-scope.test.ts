import { expect, test } from "vitest";

import { createObjectKey } from "@/infrastructure/storage/object-key";
import { getUploadScope, createUploadIntentSchema } from "./upload-schema";

test("uses a record prefix for a pre-project asset", () => {
  const input = createUploadIntentSchema.parse({
    recordId: "00000000-0000-4000-8000-000000000003",
    assetId: "00000000-0000-4000-8000-000000000004",
    kind: "image",
    filename: "cover.png",
    mimeType: "image/png",
    sizeBytes: 1024,
  });
  const scope = getUploadScope(input);
  const key = createObjectKey({
    environment: "dev",
    userId: "00000000-0000-4000-8000-000000000001",
    scope,
    kind: input.kind,
    filename: input.filename,
    objectId: input.assetId,
  });

  expect(scope).toEqual({ type: "record", id: input.recordId });
  expect(key).toContain(`/records/${input.recordId}/image/${input.assetId}.png`);
});
