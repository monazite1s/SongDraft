import { describe, expect, test } from "vitest";

import { hashSnapshot } from "./snapshot";

describe("hashSnapshot", () => {
  test("normalizes object key order and line endings without changing array order", () => {
    const first = {
      primaryKind: "text" as const,
      title: "雨夜",
      tags: ["夜晚", "雨"],
      text: {
        inspirationType: "lyric" as const,
        content: "路灯把影子拉得很长\r\n我数着水洼里的光",
        moods: [],
        speedFeel: "unknown" as const,
        soundHints: "",
        referenceWorks: "",
        advanced: {},
      },
    };
    const sameContentDifferentKeyOrder = {
      text: {
        advanced: {},
        referenceWorks: "",
        soundHints: "",
        speedFeel: "unknown" as const,
        moods: [],
        content: "路灯把影子拉得很长\n我数着水洼里的光",
        inspirationType: "lyric" as const,
      },
      tags: ["夜晚", "雨"],
      title: "雨夜",
      primaryKind: "text" as const,
    };

    expect(hashSnapshot(first)).toBe(hashSnapshot(sameContentDifferentKeyOrder));
    expect(hashSnapshot({ ...first, tags: ["雨", "夜晚"] })).not.toBe(hashSnapshot(first));
  });
});
