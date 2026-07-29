# SongDraft 上线前总 TODO

> 更新记录：
> - 2026-07-30 初版：基于 SPEC + 代码级深挖的分级 TODO。
> - 2026-07-30 二次：P0-1/P0-2/P0-3 已完成，标注完成状态；新增「部署与国内生产化」整节。
>
> 事实校正：① 迁移无漂移——`creative_briefs` 在 0000、`inspiration_records` 在 0002，16 张表都有迁移；本轮新增 `generation_candidates`（迁移 0003）。缺的是全新表 `share_members`（schema 里还没有）。② `docs/delivery-readiness.md` 已过期（描述的是已删除的"对话式首页/艺人 Hero"v0），不能作为上线依据。

核心判断：服务层（鉴权/所有权/事务/快照去重/迁移）质量高、骨架是生产级；SPEC 的四条核心链路中 **Brief 生成 / 候选/版本拆分 / 生成参数透传 三条已端到端打通**，剩余 **灵感库、分享白名单** 两条核心链路 + 大量前端 mock 壳 + 部署/国内化待办。标签：🛠开发 / 🔌接入API / 🔗联调。状态：✅已完成 / 🟡部分 / ⬜未开始。

---

## 🔴 P0 阻塞上线（核心功能链路）

### #1 Brief 生成链路 — ✅ 已完成（2026-07-30）
- 原现状：前端 `generateBrief()` 是 `setTimeout` 假动作，永远显示硬编码 `DEFAULT_BRIEF`；无 brief API/Service。
- 原计划：新建 POST/PATCH/confirm brief 三个端点 + BriefService（AI 从素材生成）；前端接真实 API。
- **完成状态**：新增 `BriefGenerator`（DeepSeek 结构化 + 确定性 Mock）+ `BriefService`（generate/update/confirm 写 `creative_briefs`）+ 三个端点；前端 `generateBrief` 调真实 API，初始 phase=idle（简报先空，点「生成简报」后填入）。

### #2 候选/版本拆分 — ✅ 已完成（2026-07-30）
- 原现状：无 `generation_candidates` 表；生成直接 `tx.insert(demoVersions)`——违背 SPEC §7.4。
- 原计划：新增表 + 迁移 0003；`generate()` 改为只插候选；新建 `POST /api/generation-candidates/save`。
- **完成状态**：新增 `generation_candidates` 表 + 迁移 `0003_early_mentallo.sql`；`generate()` 只产未保存候选（按 quantity 受控并发 ≤2，不落 `demo_versions`）；`saveCandidates` 事务转正式版本（首个设主版本、回填 `savedVersionId`、**同批互为兄弟节点**）；候选多选 + 批量保存底栏已上前端。

### #3 生成参数透传 — ✅ 已完成（方案 A：参数进简报，2026-07-30）
- 原现状：`quantity`/`outputType`/`extraPrompt` 被 zod 静默丢弃；`outputType` 硬编码 `"song"`。
- 原计划：`generateSchema` 加 confirmedBriefId，服务端从已确认 Brief 读三参数。
- **完成状态**：`BriefPayload` 扩展承载 `outputType`/`extraPrompt`/`quantity`；`POST /api/generation-jobs` 改为只收 `projectId + briefId + idempotencyKey`，`GenerationService.generate` 从该简报读取全部参数（不再硬编码）；前端点「生成」时先把当前参数 PATCH 进简报再据此生成。注：简报沿用别名 `melody`，生成计划内部归一化为 canonical `melody_sketch`（完整重命名见 P2）。

### #4 灵感库 — ⬜ 未开始
- 现状/证据：`/inspirations` 路由+页面完全不存在；`InspirationRepository` 无 `listPage`；`GET /api/inspirations` 仅 POST。
- 要做什么：`listPage(ownerId, 14 个筛选参数, pageSize≤50)` + 6 个端点（列表/详情/PATCH/DELETE/快照历史/快照恢复）+ 前端页（桌面 TanStack Table + H5 卡片）。

### #5 分享白名单 — ⬜ 未开始（安全硬伤）
- 现状/证据：SPEC §7 核心要求未实现——任何拿到 token 的人都能无限访问（`share-service.ts:63` 只校验 token+评论开关+过期），无身份绑定/成员表/撤销。
- 要做什么：新增 `share_members` 表 + 迁移；首次有效访问写入访问者；`getPublic`/`comment` 校验成员；owner 可列表+撤销。

---

## 🟠 P1 上线前应完成（完整性 / 安全）

### 前端（🛠开发）
- ⬜ 创作库 `/works` + 详情 `/works/[id]` 接真实 API（当前用 mock `inspire-data`）。注：原"闲置的 `works-client.tsx`"已作为死代码删除，需基于真实 `ProjectSummary` 重写。
- ⬜ 工作台歌曲详情列（SPEC 三栏 1:1:1）：点击候选打开右侧详情栏（当前 `grid-cols-2`，候选点击只 `setMainId`）。
- 🟡 版本树弹窗：React Flow 版本树**已重写**（点节点激活删除/应用、hover 详情、圆点背景），但**数据仍是 mock `VERSIONS`、删除/应用按钮未接 API**。应用接 `restore`，删除接新增的版本删除 API。
- 🟡 侧栏：已用 `usePathname` 做 active 态；⬜"最近项目"仍硬编码 3 条、未接 `/api/projects`。
- ⬜ H5 外壳：顶部栏 + 底部导航（当前移动端无导航，`sidebar.tsx` `hidden lg:flex`）。

### 后端/API（🛠+🔌）
- ⬜ `DELETE /api/projects/[id]/versions/[versionId]`（`GenerationService` 缺 delete）。
- ⬜ `GET /api/generation-jobs/[id]`（任务进度/候选/脱敏错误）。
- ⬜ MiniMax 音频转存私有 COS + 短时签名 URL（当前依赖 Provider 长期 URL）。
- ⬜ 3 个 env 声明未接线：`SUPABASE_SERVICE_ROLE_KEY` / `TENCENT_COS_PUBLIC_BASE_URL` / `PROVIDER_SECRET_ENCRYPTION_KEY`——接或删。
- ⬜ `AnalysisService`/`ProfileService` mock 存储改 `globalThis`（当前模块级 Map，多实例不一致）。
- ⬜ 工作台首屏聚合 API（见部署节 #7），避免首屏多次串行往返。

### 安全（🛠）
- ⬜ `next.config.ts` 加安全头：CSP / `X-Frame-Options` / HSTS / `Referrer-Policy`（分享页 `/s/[token]` 尤其需要防嵌套）。
- ⬜ 启动期 zod env 校验 + fail-fast（当前缺配置静默降级到 mock/401）。
- ⬜ 公开评论身份策略（是否强制登录以对齐白名单）。

---

## 🟡 P2 增强 / 上线后迭代

- ⬜ DeepSeek 真 SSE token 直通（当前伪流式：先全量返回再切片，`creative-chat/stream/route.ts:36`）。配合部署节 #8 轮询降级。
- ⬜ 哼唱 MiniMax Cover 预处理 / 短时 COS GET URL。
- 🟡 波形/播放器接 wavesurfer.js：**库已装**，`AudioPlayer` 当前仍是 mock 波形。
- 🟡 继续用 shadcn/ui 组件化：**已初始化 `components.json` + 装 Button/RadioTags**，后续逐步替换手写组件。
- ⬜ IndexedDB 离线补交、HEIC 转码、A/B 同步播放、版本树自动布局精调。
- ⬜ outputType 别名清理 `melody`→`melody_sketch`（数据模型连带，风险项；生成计划内部已临时归一化）。

---

## 🚀 部署与国内生产化（Vercel 仅作「快速验证架构」）

> 结论：Vercel 不能当国内稳定性保障。正式面向大量国内用户前，要准备国内部署。落地组合：**自有域名 + Vercel hkg1 + 同区 PG + COS 直传 + 依赖本地化 + API 聚合 + SSE 降级**。现在就买可备案域名、预留 `cn` 环境。

### 当前阶段必做
1. ⬜ **自有域名**，不用 `*.vercel.app`。
2. ⬜ **Function 固定 `hkg1`（香港）**。
3. ⬜ **PostgreSQL 与 Function 同区/邻近亚太**（别香港 Function + 美国库）。
4. 🟡 **音频/图片走腾讯 COS 直传 + 短时签名播放**，不经 Vercel 中转（直传 Intent 已实现；⬜ MiniMax 结果转存 COS + 短时签名播放未做）。
5. ⬜ **字体、脚本、图标全部本地化**（禁 Google Fonts / 海外 CDN）。
6. ⬜ **登录不要只靠 Google**（至少邮箱；正式版考虑手机/微信）。
7. ⬜ **工作台首屏聚合 API**，少打多次往返；避免 N+1。
8. ⬜ **SSE 必须有轮询降级**，断线不等于生成失败。
9. ⬜ **国内三网 + 微信内实测**，设阈值再决定是否切国内云。

### 架构原则
| 做 | 不做 |
|---|---|
| 浏览器 ↔ COS 直传 | 大文件经 Vercel 转发 |
| Function ≈ DB 区域 | 跨境 Function↔DB |
| 依赖打进构建产物 | 运行时拉海外资源 |
| 一次 workspace 接口 | 首屏十几个串行请求 |
| SSE + 轮询双通道 | 只靠长连接 |

### 正式上线前决策（切国内云触发条件）
大陆三网 **P95 首屏 > 3s**、**API P95 > 1.5s**、明显不可访问、或 **上传失败率 > 1%** → 启动腾讯云生产 + ICP 备案。

---

## 🔗 联调清单（真实环境，mock 无法替代）
1. ⬜ Supabase 注册/登录/退出/刷新 Session（生产禁 `AUTH_MODE=mock`）。
2. ⬜ PostgreSQL 迁移后重启仍恢复项目/版本/评论。
3. ⬜ COS 音频直传 / Head 校验 / 私有读 / 越权失败 / CORS。
4. ⬜ DeepSeek 结构化响应 / 超时 / 错误脱敏。
5. ⬜ MiniMax 真实生成 / URL 播放 / 转存 / 版权与内容审核。
6. ⬜ 微信内浏览器 + 真机：麦克风、播放、二维码、时间点评论。
7. ⬜ Vercel Node 22 `pnpm build`。
8. ⬜ 日志审计：Vercel Logs 不含 Secret / Token / 完整 Prompt / 歌词。

---

## 🧱 基建 / DevOps（🛠+🔗）
- ⬜ Dockerfile + CI（lint/typecheck/test/drizzle check/build 门禁；当前 `.github/workflows` 不存在）。
- ⬜ `/api/health` 健康检查（DB+存储+认证探活）。
- ⬜ 错误监控（Sentry）。
- ⬜ `drizzle:check` 改为可在无 DB 的 CI 运行（当前强依赖 `DATABASE_URL` 直接退出）。
- ⬜ 生产 migrate 执行脚本/文档（Vercel Build 不自动迁移）。

---

## 🧪 测试（🛠）
- ✅ 单元/组件测试：**45 个全过**（覆盖灵感快照去重、候选→版本、权限隔离、Brief 生成/编辑/确认、简报参数流入生成）。
- ⬜ E2E 全空：`tests/e2e/` 零用例（`playwright.config.ts` 已配）。补核心创作流 + 分享访问 + 评论。
- ⬜ 分享白名单单测/集成测（功能实现后）。
- ⬜ `workspace.test.tsx` 充实（候选→详情列、版本弹窗删除/应用）。
- ⬜ 跨 API 集成测：候选→保存版本→历史（含兄弟节点 parent 关系）。

---

## 建议执行顺序（已更新）
1. ✅ ~~P0-2 候选/版本拆分~~ → 地基已完成。
2. ✅ ~~P0-1 Brief 链路 + P0-3 参数透传~~ → 已完成（方案 A）。
3. ⬜ **P0-5 分享白名单**（安全硬伤，独立可并行）。
4. ⬜ **P0-4 灵感库**（前后端独立模块）。
5. ⬜ P1 前端接真实数据 + 版本树删除/应用接线 + 三栏详情。
6. ⬜ 部署/国内化（自有域名 + hkg1 + 同区 PG + COS 直传 + 本地化 + 聚合 API + SSE 降级）+ 基建/安全头/CI/健康检查 + 联调。

> 注：`docs/delivery-readiness.md` 已过期，建议同步重写。
