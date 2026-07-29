import { expect, test } from "vitest";

import { createProjectSchema } from "./project";

test("accepts a project with one valid inspiration input", () => {
  const result = createProjectSchema.safeParse({ title: "雨后", description: "雨停以后" });

  expect(result.success).toBe(true);
});

test("allows a project with only a title (制作台新建空项目，素材在制作台内补充)", () => {
  const result = createProjectSchema.safeParse({ title: "空白灵感" });

  expect(result.success).toBe(true);
});
