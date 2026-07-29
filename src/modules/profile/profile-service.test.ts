import { expect, test } from "vitest";

import { ProfileService } from "./profile-service";

const user = { id: "00000000-0000-4000-8000-000000000044", email: "profile@example.test", displayName: "原昵称" };

test("updates a mock profile display name", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const service = new ProfileService();
  expect((await service.get(user)).displayName).toBe("原昵称");
  expect((await service.update(user, { displayName: "新昵称" })).displayName).toBe("新昵称");
  if (original) process.env.DATABASE_URL = original;
});
