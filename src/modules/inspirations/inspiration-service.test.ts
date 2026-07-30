import { describe, expect, test } from "vitest";

import { MockInspirationRepository } from "./inspiration-repository";
import { InspirationService } from "./inspiration-service";

const owner = {
  id: "00000000-0000-4000-8000-000000000099",
  email: "creator@example.test",
  displayName: "创作者",
};

function textSnapshot(content = "路灯把影子拉得很长") {
  return {
    primaryKind: "text" as const,
    title: "雨夜街角",
    tags: ["夜晚"],
    text: {
      inspirationType: "lyric" as const,
      content,
      moods: ["孤独"],
      speedFeel: "slow" as const,
      soundHints: "轻鼓和电钢琴",
      referenceWorks: "",
      advanced: {},
    },
  };
}

describe("InspirationService", () => {
  test("creates a record from meaningful content and skips redundant autosaves", async () => {
    const service = new InspirationService(new MockInspirationRepository());
    const record = await service.create(owner, { snapshot: textSnapshot() });

    const unchanged = await service.autosave(owner.id, record.id, { snapshot: textSnapshot() });
    expect(unchanged?.versionCreated).toBe(false);
    expect(unchanged?.record.versionCount).toBe(1);

    const changed = await service.autosave(owner.id, record.id, { snapshot: textSnapshot("我数着水洼里的光") });
    expect(changed?.versionCreated).toBe(true);
    expect(changed?.record.versionCount).toBe(2);
    expect(changed?.record.summary).toBe("雨夜街角");
  });

  test("allows one record to accumulate multiple content types (text + audio)", async () => {
    const service = new InspirationService(new MockInspirationRepository());
    const record = await service.create(owner, { snapshot: textSnapshot() });

    // 同一条灵感可以追加音频槽位，primaryKind 随当前主类型变化（不再 PRIMARY_KIND_IMMUTABLE）。
    const merged = await service.autosave(owner.id, record.id, {
      snapshot: {
        primaryKind: "audio",
        title: "雨夜街角",
        tags: [],
        text: textSnapshot("我数着水洼里的光").text,
        audio: {
          note: "副歌旋律",
          items: [{
            assetId: "00000000-0000-4000-8000-000000000098",
            label: "humming.webm",
            note: "",
          }],
        },
      },
    });
    expect(merged?.versionCreated).toBe(true);
    expect(merged?.record.primaryKind).toBe("audio");
    // 文本槽位仍保留在同一条记录里。
    expect(merged?.record.currentSnapshot.text?.content).toBe("我数着水洼里的光");
  });

  test("keeps records isolated by owner", async () => {
    const service = new InspirationService(new MockInspirationRepository());
    const record = await service.create(owner, { snapshot: textSnapshot() });

    await expect(service.autosave("00000000-0000-4000-8000-000000000088", record.id, {
      snapshot: textSnapshot("不属于当前用户"),
    })).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});
