import { expect, test } from "vitest";

import { routeGeneration } from "./provider-router";

test("routes lyric and humming input through a melody-reference plan", () => {
  const plan = routeGeneration({ combination: "melody+text", outputType: "song", brief: { theme: "雨后", genre: "流行", tempo: "92 BPM" } });
  expect(plan.steps.some((step) => step.title === "旋律参考")).toBe(true);
  expect(plan.steps.at(-1)?.title).toBe("输出歌曲 Demo");
});

test("routes a visual-only idea into a soundtrack plan", () => {
  const plan = routeGeneration({ combination: "visual", outputType: "soundtrack", brief: { theme: "海边日落", genre: "氛围", tempo: "76 BPM" } });
  expect(plan.steps.some((step) => step.title === "视觉氛围映射")).toBe(true);
  expect(plan.steps.at(-1)?.title).toBe("输出配乐 Demo");
});
