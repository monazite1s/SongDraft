/**
 * 回归测试：项目进入页面的两条数据流（/works/[projectId] 与 /create/[projectId]）
 * 不再因循环 import 抛错。
 *
 * 修复前：ProjectService.getProjectDetail 内部 new InspirationService()/new GenerationService()，
 * 与 inspiration-repository 反向 import ProjectService 形成循环，在 Next.js (Turbopack/webpack)
 * 运行时抛 ReferenceError，被页面 try/catch 吞成 404。
 *
 * 修复后：聚合上移到页面层（本测试模拟该聚合），ProjectService 不再依赖灵感/生成模块，
 * inspiration-repository 不再 import ProjectService。本测试默认构造各 Service（命中真实
 * 仓库实例），断言 create → get / listByProject / listVersions 链路畅通。
 */
import { expect, test } from "vitest";

import { GenerationService } from "@/modules/generation/generation-service";
import { InspirationService } from "@/modules/inspirations/inspiration-service";
import { ProjectService } from "./project-service";

const owner = {
  id: "00000000-0000-4000-8000-0000000000d0",
  email: "detail-repro@example.test",
  displayName: "详情复现",
};

test("works page aggregation: project + inspirations + versions loads without error", async () => {
  const created = await new ProjectService().create(owner, {
    title: "详情聚合回归",
    description: "验证页面层聚合不被循环 import 破坏",
  });

  // 模拟 works/[projectId]/page.tsx 修复后的聚合写法。
  const project = await new ProjectService().get(owner.id, created.id);
  const [inspirations, versions] = await Promise.all([
    new InspirationService().listByProject(owner.id, created.id),
    new GenerationService().listVersions(owner, created.id),
  ]);

  expect(project.id).toBe(created.id);
  expect(project.title).toBe("详情聚合回归");
  expect(inspirations).toEqual([]);
  expect(versions).toEqual([]);
});

test("create page flow: ProjectService.get returns the project", async () => {
  const created = await new ProjectService().create(owner, {
    title: "制作台入口回归",
    description: "验证 ProjectService.get 不被循环 import 破坏",
  });

  const project = await new ProjectService().get(owner.id, created.id);

  expect(project.id).toBe(created.id);
  expect(project.title).toBe("制作台入口回归");
});

test("inspiration attach new_project creates a project without circular ProjectService import", async () => {
  // 回归 inspiration-repository.mock attach 的 new_project 分支：
  // 修复后改走 getProjectRepository().create，不再 import ProjectService。
  const inspirationService = new InspirationService();
  const record = await inspirationService.create(owner, {
    snapshot: {
      primaryKind: "text",
      title: "循环依赖回归",
      tags: [],
      text: {
        inspirationType: "lyric",
        content: "路灯把影子拉得很长",
        moods: [],
        speedFeel: "slow",
        soundHints: "",
        referenceWorks: "",
        advanced: {},
      },
    },
  });

  const attached = await inspirationService.attach(owner, record.id, {
    destination: "new_project",
    title: "循环依赖回归 Demo",
  });

  expect(attached.projectId).toBeTruthy();
  const project = await new ProjectService().get(owner.id, attached.projectId!);
  expect(project.title).toBe("循环依赖回归 Demo");
});
