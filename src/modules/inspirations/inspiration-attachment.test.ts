import { expect, test } from "vitest";

import { ProjectService } from "@/modules/projects/project-service";
import { MockInspirationRepository } from "./inspiration-repository";
import { InspirationService } from "./inspiration-service";

const owner = {
  id: "00000000-0000-4000-8000-000000000077",
  email: "attachment@example.test",
  displayName: "归档测试",
};

const snapshot = {
  primaryKind: "text" as const,
  title: "雨夜街角",
  tags: ["夜晚"],
  text: {
    inspirationType: "lyric" as const,
    content: "路灯把影子拉得很长",
    moods: [],
    speedFeel: "slow" as const,
    soundHints: "",
    referenceWorks: "",
    advanced: {},
  },
};

test("attaches a capture to a visible project and prevents silent moves", async () => {
  const service = new InspirationService(new MockInspirationRepository());
  const record = await service.create(owner, { snapshot });

  const attached = await service.attach(owner, record.id, {
    destination: "new_project",
    title: "雨夜街角 Demo",
  });

  expect(attached.projectId).toBeTruthy();
  expect((await new ProjectService().get(owner.id, attached.projectId!)).lyrics).toBe(snapshot.text.content);
  await expect(service.attach(owner, record.id, {
    destination: "new_project",
    title: "另一个项目",
  })).rejects.toMatchObject({ code: "ALREADY_ATTACHED", status: 409 });
});
