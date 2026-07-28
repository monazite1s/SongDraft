import { describe, expect, test } from "vitest";

import { detectCombination } from "./combination";

describe("detectCombination", () => {
  test.each([
    [{ hasText: true, hasMelody: false, hasVisual: false }, "text"],
    [{ hasText: false, hasMelody: true, hasVisual: false }, "melody"],
    [{ hasText: false, hasMelody: false, hasVisual: true }, "visual"],
    [{ hasText: true, hasMelody: true, hasVisual: false }, "melody+text"],
    [{ hasText: true, hasMelody: false, hasVisual: true }, "text+visual"],
    [{ hasText: false, hasMelody: true, hasVisual: true }, "melody+visual"],
    [{ hasText: true, hasMelody: true, hasVisual: true }, "melody+text+visual"],
  ] as const)("maps %o to %s", (presence, expected) => {
    expect(detectCombination(presence)).toBe(expected);
  });

  test("rejects empty inspiration", () => {
    expect(() => detectCombination({ hasText: false, hasMelody: false, hasVisual: false }))
      .toThrowError("input_required");
  });
});
