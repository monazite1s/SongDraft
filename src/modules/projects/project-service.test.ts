import { expect, test } from "vitest";

import { MockProjectRepository } from "./project-repository";
import { ProjectService } from "./project-service";

const owner = { id: "00000000-0000-4000-8000-000000000099", email: "creator@example.test", displayName: "创作者" };

test("creates and retrieves a text-only project in mock mode", async () => {
  const service = new ProjectService(new MockProjectRepository());
  const created = await service.create(owner, { title: "雨后列车", description: "雨停以后，还在旧车站等你" });

  expect(created.combination).toBe("text");
  expect((await service.get(owner.id, created.id)).title).toBe("雨后列车");
  expect((await service.list(owner.id))).toHaveLength(1);
});
