# 项目主线 IA 设计 — 主链路打通

> 日期：2026-07-30。分支 `feature/songdraft-foundation`。
> 上游：`docs/SPEC.md`（§2 制作台 / §4 版本 / §5 创作库 / §6 歌曲详情）、`docs/UI-design.md`。
> 背景：项目是数据层组织单位（SPEC §三.1），但 UI 层未将其作为脊柱——制作台无项目归属引导、灵感与项目脱节、一个项目的资产散落无聚合视图。本轮把项目变成可见的**浏览脊柱**。

## 目标（范围：主链路打通）

```
创作库 /works                            真实项目列表（列表形式）
项目详情 /works/[projectId]              顶部信息 + Tab[歌曲 | 灵感]     ← 新增
歌曲详情 /works/[projectId]/v/[versionId]  单版本详情（真实数据）         ← 迁移自扁平 /works/[id]
```

附带（SPEC 硬要求）：制作台 `/create` 空状态二选一；侧栏「最近项目」接真实。

## 路由迁移

- 当前扁平 `/works/[id]`（mock 歌曲详情）→ 层级 `/works/[projectId]/v/[versionId]`，消歧 projectId/versionId。
- `/works/[projectId]`（项目详情）为**新增**路由。
- 旧扁平路由删除；内部链接（`works/page.tsx` 卡片、`works-client.test.tsx`、`workspace.test.tsx`）随迁。
- 返回入口：歌曲详情「返回」→ 项目详情；项目详情「返回」→ 创作库。

## 数据层

复用（已存在，勿重写）：
- `GenerationService.listVersions(owner, projectId)` → `DemoVersionView[]`（项目详情「歌曲」Tab 数据源）。
- `ShareService.listComments(owner, projectId)` → `OwnerCommentView[]`（歌曲详情评论，前端按 `versionId` 过滤）。
- `ProjectRepository.findOwned / listPage`。

新增类型（`project-types.ts`）：
- `ProjectListItem extends ProjectSummary` + `inspirationCount: number` + `versionCount: number` + `coverUrl: string | null`。
- `ProjectDetailAggregate`：`project: ProjectDetail` + `inspirations: InspirationListItem[]` + `versions: DemoVersionView[]`。

新增方法：
- `ProjectRepository.listPageWithCounts(ownerId, page, pageSize)` → `ProjectListPage<ProjectListItem>`（Drizzle: `projects` LEFT JOIN 聚合 `inspiration_records` / `demo_versions` 计数；Mock: 遍历 `__songDraftInspirationRecords` / `__songDraftVersionIndex` 计数）。
- `ProjectService.listWithCounts` / `getProjectDetail`（后者组合 `projectRepo.findOwned` + `inspirationRepo.listByProject` + `generationService.listVersions`）。
- `InspirationRepository.listByProject(ownerId, projectId)` → 关联灵感列表（复用现有 `InspirationListItem`）。

封面口径：`coverUrl` 取主版本 `demoAssets.metadata`；无版本用占位（待 schema 确认 `projects` 是否有封面字段）。
「歌曲数」口径 = `demo_versions` 数（**不含未保存候选**）。

API：
- `GET /api/works` — 创作库 client 用，返回 `ProjectListPage<ProjectListItem>`。
- 项目详情 / 歌曲详情为 Server Component，**直接调 service**，不开聚合 API。

## 页面设计（严格遵循 UI-design.md：克制/专业/高密度/细边框/低饱和蓝）

### 创作库 `/works`（去 mock，照 inspirations 页模式）
- Server Component 读 searchParams → Client 组件 fetch `/api/works`。
- **列表形式**（非卡片）：封面 / 标题 / 描述 / 创建时间 / 灵感数 / 歌曲数 / 状态。
- 保留搜索 + 筛选 + 排序控件，接真实分页；URL query 同步；条件 Chips。
- 空状态：引导去 `/`（记灵感）或 `/create`（建项目）。
- 点行 → `/works/[projectId]`。

### 项目详情 `/works/[projectId]`（新增）
- Server Component：`requireCurrentUser` → `ProjectService.getProjectDetail`；404 处理。
- **顶部信息区**：封面 / 标题 / 描述 / 创建时间 + 「打开制作台」（→`/create/[projectId]`）+ 「分享」。
- **Tab 切换**（取代上下堆叠）：`歌曲`（默认）+ `灵感`。
  - 歌曲 Tab：版本列表（封面/标题/时长/主版本标记/生成时间），点 → `/works/[projectId]/v/[versionId]`。
  - 灵感 Tab：关联灵感列表（标题/类型/更新时间），点开灵感详情 sheet。
- 两 Tab 各自独立空状态。

### 歌曲详情 `/works/[projectId]/v/[versionId]`（改造，去 mock）
- Server Component：真实版本数据（音频/封面/歌词/Brief）+ 评论（按版本过滤）。
- 按钮：**分享**（ShareModal）+ **编辑**（→`/create/[projectId]`，载入当前版本）+ **历史切换**（同项目其他版本下拉，不进制作台）。
- ❌ **去掉「重新生成」**（与「编辑」重复）。
- Tabs：歌词 / 评论（SPEC §6）。

## 附带项
- **制作台空状态**：`/create`（无 `initialProject`）显示「新建项目 / 导入已有项目」二选一，未选不进 workspace（SPEC §2）。
- **侧栏「最近项目」**：接 `/api/projects` 取最近 N 项，替换硬编码 3 条；点 → `/works/[projectId]`。

## 范围外（各自主线，本轮不动）
版本树删除/应用接线、分享白名单（Track B）、灵感 AI 补全（问题 4）、灵感记录 tab 美化（问题 1）、两库 UI 重设计（问题 3）。

## 验证
每步 `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build`，保持 49+ 测试绿、lint 0 错误。路由迁移同步更新 `works-client.test.tsx` / `workspace.test.tsx`。新增：listWithCounts 计数/隔离、项目详情聚合、歌曲详情按版本评论过滤。
