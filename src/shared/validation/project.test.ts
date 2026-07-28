import { expect, test } from "vitest";

import { createProjectSchema } from "./project";

test("accepts a project with one valid inspiration input", () => {
  const result = createProjectSchema.safeParse({ title: "雨后", description: "雨停以后" });

  expect(result.success).toBe(true);
});

test("rejects a project without inspiration", () => {
  const result = createProjectSchema.safeParse({ title: "空白灵感" });

  expect(result.success).toBe(false);
});
