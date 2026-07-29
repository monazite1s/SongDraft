import { expect, test } from "vitest";

import { MockProjectRepository } from "@/modules/projects/project-repository";
import { ProjectService } from "@/modules/projects/project-service";
import { BriefService } from "./brief-service";

const owner = { id: "00000000-0000-4000-8000-000000000015", email: "brief@example.test", displayName: "简报测试" };

test("generates a brief from project materials, then supports edit and confirm", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const projects = new ProjectService(new MockProjectRepository());
  const project = await projects.create(owner, { title: "雨夜街角", description: "雨夜街角的独处与释然", lyrics: "路灯把影子拉得很长" });

  const service = new BriefService();
  const brief = await service.generate(owner, project.id);
  expect(brief.projectId).toBe(project.id);
  expect(brief.payload.theme).toBeTruthy();
  expect(brief.payload.lyricSummary).toContain("路灯");
  expect(brief.confirmedAt).toBeNull();

  // 编辑覆盖 payload 并清空确认状态。
  const edited = await service.update(owner, project.id, brief.id, { ...brief.payload, theme: "改写后的主题" });
  expect(edited.payload.theme).toBe("改写后的主题");
  expect(edited.confirmedAt).toBeNull();

  // 确认写入确认时间。
  const confirmed = await service.confirm(owner, project.id, edited.id);
  expect(confirmed.confirmedAt).not.toBeNull();

  if (original) process.env.DATABASE_URL = original;
});

test("rejects brief access from another owner", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const projects = new ProjectService(new MockProjectRepository());
  const project = await projects.create(owner, { title: "权限", description: "隔离", lyrics: "只属于我" });
  const service = new BriefService();
  const brief = await service.generate(owner, project.id);
  const intruder = { id: "00000000-0000-4000-8000-000000000016", email: "intruder@example.test", displayName: "入侵者" };
  // 入侵者无法直接读取/确认他人项目下的简报（项目所有权校验先失败）。
  await expect(service.confirm(intruder, project.id, brief.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  if (original) process.env.DATABASE_URL = original;
});
