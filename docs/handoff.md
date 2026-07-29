# SongDraft 工作交接 Spec（compact 后续接用）

> 本文是上下文压缩后续接的权威文档。读这一份即可恢复全部上下文。最后更新：2026-07-30。
> 配套：`docs/SPEC.md`（产品需求）、`docs/UI-design.md`（UI 风格）、`docs/implementation-todo.md` + `implementation-todo-spec-coverage.md`（细粒度 todo）、`docs/todo.md`（分级进度）、`docs/future-work.md`（P0/部署）。
> 工作目录：`/Users/marongzhen/code/hackthon`，分支 `feature/songdraft-foundation`，git 用户 `nikorzma`。

---

## 0. 项目速查

- **产品**：音乐灵感记录 → Demo 制作协作工具。核心流程：`记录灵感 → 保存到项目 → 制作台 → 生成 Brief → 生成 Demo → 保存版本 → 详情/分享/评论`。**项目是核心组织单位**（这条很关键，见问题 2）。
- **技术栈**：Next.js 16 App Router · React 19 · TypeScript · Tailwind 4（CSS 变量）· Drizzle/PostgreSQL · Supabase Auth · 腾讯云 COS · AI=DeepSeek(歌词/Brief)+MiniMax(音乐)。
- **设计基调（`docs/UI-design.md`）**：克制/专业/冷静/高信息密度/创作工具感。白/微冷白底、白面板、浅冷灰分区、深蓝黑正文、低饱和蓝强调(`brand`)、细边框、6–8px 圆角、极弱阴影。**禁**渐变发光/霓虹/玻璃拟态/大圆角/厚阴影/营销插画/AI 营销腔/把复杂流程伪装成单一 Generate。真实/模拟必须清晰标注(`ModeTag`)。
- **默认全 mock**：无 `DATABASE_URL` → 所有 service 降级为 `globalThis` 进程级 Map；无 AI key → 透明 mock（不冒充真实）。`.env.local` 已配 DeepSeek+MiniMax（勿提交）。

## 1. 已完成的工作（**勿重复**，改动较大）

1. **路由/布局修复**：首页 `/` = 灵感记录页（`InspirationRecordPage` + 侧栏外壳）。各页自带 `<Sidebar/>`。
2. **骨架屏**：`(app)/loading.tsx` 渲染 Sidebar + 右侧 content 骨架（React 按子节点位置复用 Sidebar DOM，切路由不闪烁）。
3. **创作台 SPEC 改造**：等分两栏 1:1（`xl:grid-cols-2`）；「生成简报」按钮固定在 `MaterialPanel` 底部（`WorkspacePrimaryAction`）；Brief 含输出类型/额外要求/生成数量；Brief+结果可折叠卡片；删除中栏 ActionColumn 与「生成计划」PlanCard；TopToolbar 去掉输出类型下拉。
4. **shadcn/ui 初始化**：已建 `components.json`；已装 `@xyflow/react`、`wavesurfer.js`、`@tanstack/react-table`；`src/components/ui/button.tsx` 是 shadcn 风格 Button。
5. **版本树弹窗**（`version-modal.tsx`）：React Flow + 圆点背景 + hover 详情 + 点节点激活「删除/应用」（**按钮未接 API、数据用 mock `VERSIONS`**）。
6. **候选多选批量保存**：候选卡 checkbox + 底栏「已选 N/保存为版本」；`saveCandidates` 同批设 `parentId` 互为兄弟节点。
7. **P0-1 Brief 链路**：`BriefGenerator`(DeepSeek+Mock)+`BriefService`(generate/update/confirm)+`POST/PATCH/confirm` 三个端点；前端「生成简报」调真实 API；初始 phase=idle（简报先空，点「生成简报」后填入）。
8. **P0-2 候选/版本拆分**：新增 `generation_candidates` 表 + 迁移 `0003_early_mentallo.sql`；`generate()` 只产候选不落版本；`saveCandidates()` 候选→版本事务；`POST /api/generation-candidates/save`。
9. **P0-3 参数走 Brief（方案 A）**：`BriefPayload` 承载 `outputType`/`extraPrompt`/`quantity`；`POST /api/generation-jobs` 只收 `projectId+briefId+idempotencyKey`；`generate()` 从该简报读全部参数（不再硬编码 outputType）；前端点「生成」时先把当前参数 PATCH 进简报。
10. **P0-4 灵感库（刚完成）**：`InspirationRepository` 加 listPage/findDetail/updateMeta/softDelete/listVersions/restoreVersion（Drizzle+Mock）；`InspirationService`+`inspiration-query.ts`；6 个端点；`/inspirations` 页（查询表单 URL 同步 + 桌面表格/H5 卡片/分页/空状态 + 详情 Sheet 480px + 版本时间线 + 恢复）；侧栏加「灵感库」。

## 2. 当前验证基线（每次改动后都要保持绿）

- `pnpm typecheck` ✅ · `pnpm lint` **0 错误**（1 个 `<img>` warning 在 `inspiration-record-page.tsx`，blob 预览，可接受）· `pnpm vitest` **49 全过** · `pnpm build` ✅。
- 测试 mock 注意：渲染含 Sidebar 的组件时，`vi.mock("next/navigation")` 必须含 `usePathname: () => "/"`（workspace.test.tsx、page.test.tsx 已加）。

## 3. 关键架构与模式（**复用，别另造**）

- **API 响应**：`ApiEnvelope{T}={ok,data?,error?{message}}`；`apiSuccess(data,status=200)` / `apiError(err)`（`src/shared/http/api-response.ts`）。错误用 `DomainError(code,status,msg)`（`src/shared/errors/domain-error.ts`），常用码：`UNAUTHENTICATED 401 / FORBIDDEN 403 / NOT_FOUND 404 / VALIDATION_FAILED 422 / CONFLICT 409`。
- **鉴权/所有权**：每个 route 先 `getCurrentUser()`（null→401）；service 用 `findOwned(id, ownerId)` 校验所有权。`getCurrentUser` mock 模式返回固定 demo 用户 `demo@songdraft.local`。
- **Repository 双实现**：`getXxxRepository()` 工厂 `process.env.DATABASE_URL ? Drizzle : Mock`。Mock 用 `globalThis.__songDraft*` Map（跨 handler 共享）。
- **AI 适配器**：`getLyricAssistant()`/`getBriefGenerator()`/`getMusicGenerator()` 按 env 选真实/透明 mock；真实失败**不**冒充成功。
- **Drizzle 迁移生成**：`drizzle.config.ts` 无 `DATABASE_URL` 会抛错；用 `DATABASE_URL=dummy pnpm drizzle:generate`（只做 schema↔快照 diff，不连库）。已发布迁移不可改，只能新增。
- **现有 mock 全局 store**：`__songDraftInspirationRecords/Versions`、`__songDraftProjects`、`__songDraftVersionIndex`、`__songDraftCandidates`、`__songDraftShares`、`__songDraftBriefs`、`__songDraftGenerationResults`。

## 4. 关键文件地图

```
src/app/
  (app)/page.tsx                       首页=灵感记录（含侧栏外壳）
  (app)/inspirations/page.tsx          灵感库（新）
  (app)/create/{page,[projectId]/page} 制作台入口/已有项目
  (app)/works/{page,[id]/page}         创作库（mock）、歌曲详情（mock，待重做）
  (app)/settings/page.tsx
  (public)/s/[token]/page.tsx          公开分享页（Codex 旧 UI，待重做）
  api/inspirations/*                   灵感：GET 列表/POST；[id] GET/PATCH/DELETE；autosave/attach/drafts；versions；restore
  api/generation-jobs/route.ts         生成（收 briefId）
  api/generation-candidates/save       候选→版本
  api/projects/[id]/brief/*            Brief generate/PATCH/confirm
  api/projects/[id]/versions/*         版本 main/restore（缺 DELETE）
src/components/
  inspire/{workspace,material-panel,brief-panel,action-column,version-modal,share-modal,top-toolbar,sidebar,modal}.tsx
  inspire/ui.tsx                       SectionCard/Field/Chip/Badge/RadioTags/ModeTag
  inspiration/{inspiration-record-page,inspiration-media-capture}.tsx   首页灵感记录（UI 待美化，问题1）
  inspirations/{inspiration-library-client,inspiration-search-form,inspiration-detail-sheet,library-filters}.tsx  灵感库（新）
  sharing/public-share-client.tsx      分享页客户端（待重做）
  ui/button.tsx                        shadcn Button
src/modules/
  inspirations/{inspiration-repository,inspiration-service,inspiration-types,inspiration-schema,inspiration-query,snapshot}.ts
  inspiration/{upload-service,asset-service,...}.ts   旧上传模块（注意与 inspirations 区分）
  generation/{generation-service,generation-types,music-generator,provider-router}.ts
  projects/{project-service,project-repository,project-types,brief-service}.ts
  sharing/share-service.ts             待加白名单（P0-5）
  ai/{lyric-assistant,brief-generator}.ts + prompts/{conversation,lyrics,music,brief,system}.ts
src/infrastructure/db/schema.ts        16 表 + generation_candidates；缺 share_access_grants
drizzle/0000..0003_*.sql + meta/       迁移
src/lib/inspire-data.ts                前端 mock 数据+类型（CreativeBrief/DemoCandidate/PROVIDERS/VERSIONS/works）
```

## 5. 待办（用户最新问题，**优先级最高**）

> 这 6 条是用户在本轮最后明确提出的、对当前实现的修正与新方向。**问题 2 是架构级的，建议先用 brainstorming/设计 agent 理清再动代码。**

### 问题 1：灵感记录页 tab 太丑，要像制作台 tab
- 文件：`src/components/inspiration/inspiration-record-page.tsx`（tab 在 ~189-195 行，朴素 grid 按钮）。
- 参照：`src/components/inspire/material-panel.tsx` 的 `TABS`（pill 风格：激活态边框+bg+brand 点、Lucide 图标、`已选 N/3 类素材` 计数）。
- 动作：把灵感记录页的三 tab（录音/音频、图片、文本）改成与制作台素材 tab 一致的视觉语言（激活态、图标、指示点）。

### 问题 2：项目作为体系主线（**架构级**，最重要）
- 现状问题：系统是"项目制"，但项目存在感薄弱——灵感记录没真正"在"项目里；新工作台(`/create`)没有「新建项目 / 从已有项目导入素材」入口；项目没把灵感/素材/Brief/版本/分享串成一个体系。
- SPEC 立场：`SPEC.md §三.1`「项目是核心组织单位……记录灵感时不强制提前创建项目，可在保存阶段新建或选择已有项目」。所以 SPEC 允许两种流程，问题是 UI/UX 没把项目可视化为脊柱。
- 需要决策（建议先 brainstorm）：
  - 工作台空状态：是否强制「新建项目 / 导入已有项目」二选一才能进入创作（SPEC §2 制作台："直接进入时需要选择导入已有项目或新建项目，未选择项目时以空状态展示"）。
  - 灵感记录：是否在项目上下文内记录（`/create/[id]` 里直接加灵感），还是保持首页独立记录后 attach（现状）。两者都要支持，但要让"项目→灵感→素材→Brief→Demo→版本"的链路在 UI 上可见。
  - 可能需要一个「项目中心/HUB」视图，聚合该项目下所有灵感、素材、版本、分享。
- 涉及：`/create/page.tsx`（空状态）、`workspace.tsx`（项目选择/导入）、灵感 attach 流程、可能新增项目详情/聚合视图。**这是底层 IA，先设计后实现。**

### 问题 3：创作库、灵感库 UI 重新设计
- 现状：`/works`（创作库，mock `inspire-data` works）、`/inspirations`（刚建的灵感库，基础表格）。
- 动作：用 **ui-ux-designer agent** 基于 `docs/UI-design.md` + 常见库类产品（筛选/列表/卡片/详情）出设计方案，再实现。两个库要有一致的查询区、卡片、空状态、分页语言。

### 问题 4：灵感入库/查找能力偏弱
- 入库：即使输入少，**AI 也应自动补全**非空字段（情绪/速度/风格线索等）并展示（类似 Brief 生成，但用于灵感结构化）。需新增「灵感 AI 补全」能力（可复用 DeepSeek 适配器 + 新 prompt）。
- 查找/展示：支持更多字段筛选与多种展示模式（表格列可调、卡片信息密度、按字段排序）。扩展 `inspiration-query.ts` 与列表/详情展示。

### 问题 5：作品详情 0 进展 + 三栏 1:1:1
- 现状：`/works/[id]`（歌曲详情）是 mock，无真实数据；生成 Demo 后**点击候选 item 无法打开半屏详情**，无法形成「素材 / 成果 / 详情」1:1:1 三栏（SPEC §三.3、`spec-coverage §3 SongDetailSheet`）。
- 动作：
  - 工作台 `workspace.tsx`：候选点击 → 右侧滑出 `SongDetailSheet`（480px），网格从 `grid-cols-2` 切到 `grid-cols-3`（1:1:1）。Sheet 复用详情数据类型/播放器/歌词/评论；顶部「进入全屏详情」跳 `/works/[id]`。
  - `SongDetailPage`（`/works/[id]`）：上下布局，顶部信息区+播放器，底部歌词/评论 Tabs（spec §6）。

其他重要todo：

1. 生成链路的prompt未调优
2. 灵感的生成入库过于简陋、查找局限极大
3. 生成歌曲的版本记录的存在感淡泊，没有形成一个生成版本的体系，需要完善自动版本记录，并区分自动记录和手动记录的版本
4. 分享页面暂时不可见，需要完善流程后验收
5. 歌曲暂无时间线评论（评论不同普通评论区，用户发送评论需要选择时间点，默认为空，空则不生成对应时间节点，如果选择了会有纵向的时间轴评论区，点击节点会跳转歌曲对应的时间点）

### 问题 6：作品详情页按钮不可用
- `/works/[id]` 现有「分析、工作区打开、重新生成」按钮全部无 onClick（Codex mock）。
- 动作：接真实行为；**「重新生成」去掉**（与「工作区打开」重复）；「工作区打开」→跳 `/create/[id]`；「分析」→接 `GET /api/projects/[id]/analysis`（已存在）或对应分析视图。

## 6. 待办（原计划未完成项）

- **Track B — P0-5 分享访问白名单（安全硬伤）**（`SPEC §7` + `spec-coverage §5`）：
  - 新增 `share_access_grants` 表（`id, share_id, project_id, accessor_user_id, granted_by, first_accessed_at, last_accessed_at, revoked_at`，唯一约束防重复授权，索引 `accessor_user_id+project_id`）+ 迁移 0004。
  - `comments.share_id` 改可空（站内评论不要求分享链接）。
  - `ShareService`：`getPublic(token, user)` 首次有效访问写 grant、仅未撤销 grant 可访问、owner 放行；`comment` 同样校验；新增 `listGrants/revokeGrant`。失效/未授权返回 404/403 **不泄露标题封面**。
  - 登录跳回：`loginAction`(`src/modules/auth/actions.ts`) 收 `redirect` 参数（只允许 `/` 开头相对路径）；`login/page.tsx` 透传。
  - 前端：`/s/[token]` 重做（白名单态、未登录跳登录、失效页不泄露）；`share-modal.tsx` 加访问者管理（列已授权+撤销）。
  - 端点：`GET/DELETE /api/projects/[id]/shares/[shareId]/grants`。
- **Track C — 歌曲详情 `/works/[id]` 重做**（与问题 5/6 合并）：真实数据（`ProjectService.get`+`GenerationService.listVersions`+`ShareService.listComments`）+ spec §6 UI。
- **版本树弹窗接线**：删除/应用按钮接 `restore` + 新增 `DELETE /api/projects/[id]/versions/[versionId]`（`GenerationService` 缺 delete，删主版本需先指定新主）；数据源换真实 `listVersions`；删除需事务修复子节点 parent。
- **P1 碎片**：`/works` 创作库接真实（现 mock）；侧栏「最近项目」接 `/api/projects`（现硬编码）；H5 顶部栏+底部导航；`GET /api/generation-jobs/[id]`；MiniMax 转存 COS；3 个未接线 env；安全头；env 启动校验。
- **P2**：DeepSeek 真 SSE token 直通（现伪流式）；wavesurfer 接播放器；outputType `melody`→`melody_sketch` 全量重命名（生成计划内部已临时归一化）。
- **部署/国内化**（`docs/todo.md` §部署与国内生产化）：自有域名、Vercel hkg1、同区 PG、COS 直传+短时签名、字体/脚本本地化、非 Google 登录、首屏聚合 API、SSE 轮询降级、国内三网实测；P95 首屏>3s/API>1.5s/上传失败>1% → 切腾讯云+ICP。

## 7. 已知坑/约定

- **lint 规则 `react-hooks/set-state-in-effect`**：在 effect 里同步 setState 会被禁；数据获取的 loading 态是合规场景，用 `// eslint-disable-next-line react-hooks/set-state-in-effect` 放在**调用 load() 的 effect 那一行**（不是 setState 行），见 `inspiration-library-client.tsx` / `inspiration-detail-sheet.tsx`。
- **渲染期调整 state** 替代 effect（避免级联）：见 `brief-panel.tsx`（auto-collapse）与 `inspiration-record-page.tsx`（kind/recordId 切换重置）的 `prevXxx` 模式。
- **outputType 别名**：前端 `inspire-data.ts` 与简报用 `"song"|"soundtrack"|"melody"`；`shared/contracts/domain` 的 `OutputType` 用 `melody_sketch`；`routeGeneration` 收 canonical，`generation-service` 已把 `melody`→`melody_sketch` 归一化。全量重命名是 P2。
- **`creative_briefs.payload` 是 `jsonb Record<string,unknown>`**：写入 BriefPayload 需 `as unknown as Record<string,unknown>`，读回 `as unknown as BriefPayload`。
- **`workspace-client.tsx` 已作为死代码删除**；`works-client.tsx` 也基本闲置。
- **首页灵感记录**（`InspirationRecordPage`）是先建私有灵感草稿→上传媒体→保存到项目（新/已有）→进 `/create/[id]`；记录级对象键 `users/{userId}/records/{recordId}/...`。

## 8. 执行建议顺序（compact 后从这里续）

1. **先处理问题 2（项目主线）**：用 brainstorming/ui-ux-designer agent 出 IA 方案（工作台项目选择/导入、灵感与项目的可视化关联、项目聚合视图），用户确认后再动代码——这是底层，会影响问题 1/3/5。
2. 问题 1（灵感记录 tab 美化）+ 问题 4（灵感 AI 补全 + 查找增强）：UI + 能力，相对独立。
3. 问题 3（两库 UI 重设计）：ui-ux-designer agent 出方案后实现。
4. 问题 5+6（歌曲详情 + 三栏 1:1:1 + 按钮接线）= Track C：工作台 SongDetailSheet + `/works/[id]` 重做。
5. Track B（P0-5 分享白名单）：独立安全模块。
6. 版本树接线、P1 碎片、部署。
- **每步小跑验证**：`pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build`，保持 49+ 测试绿、lint 0 错误。
- 用户偏好：**小步慢走、质量优先、UI 严格按 `docs/UI-design.md`、SPEC 为准、不删已完成的正确内容**。用户会自己做 UI 微调，**不要回滚用户的 UI 调整**。
