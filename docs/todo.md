# SongDraft 上线前总 TODO

> 更新记录：
> - 2026-07-30 初版：基于 SPEC + 代码级深挖的分级 TODO。
> - 2026-07-30 二次：P0-1/P0-2/P0-3 已完成，标注完成状态；新增「部署与国内生产化」整节。
> - 2026-07-30 三次：更正 4 处过期 todo 项（分享白名单已实现、DELETE 端点已存在、版本树已接真实数据、PROMPT_VERSIONS 已落库）；重写为上线前唯一事实清单。
>
> **重要说明**：本文件是上线前唯一事实清单，其余 todo 文档（implementation-todo.md / implementation-todo-spec-coverage.md / future-work.md）为历史设计蓝图，所有未完成且有效的项已合并至此。

核心判断：服务层（鉴权/所有权/事务/快照去重/迁移）质量高、骨架是生产级；SPEC 的四条核心链路中 **Brief 生成 / 候选/版本拆分 / 生成参数透传 / 灵感库 四条已端到端打通**，剩余 **分享白名单验证 / 大量前端细节 / 部署/安全/测试** 待完成。标签：🛠开发 / 🔌接入API / 🔗联调。状态：✅已完成 / 🟡部分 / ⬜未开始。

---

## 🔴 P0 阻塞上线（核心功能缺失与安全硬伤）

### 数据模型不一致与参数丢失
- ⬜ **Brief 字段未全部进 MiniMax prompt**：`instruments`/`melodyFeatures`/`visualReferences`/`priority`/`outputType` 已落库 `creative_briefs.payload`，但 `buildMusicPrompt`（`src/modules/generation/music-generator.ts`）只取 `theme`/`genre`/`tempo`/`mood`/`extraPrompt`/`lyrics`。决定：补进 prompt 或从 Brief 删除。
- ⬜ **theme/priority 是局部 state**：`brief-panel.tsx` 的 `theme`/`priority` 为局部 state，编辑后未 PATCH 持久化，生成时读取不到用户输入。
- ⬜ **hummingAssetId 死字段**：`generation-service.ts` 接收 `hummingAssetId` 但 `MiniMaxMusicGenerator.create` 完全不使用，无 Cover 适配器。
- ⬜ **outputType 别名未统一**：代码中 `melody` vs `melody_sketch` 混用（`inspire-data.ts` vs `generation-service.ts` 临时归一化），需统一为 `melody_sketch`。

### 存储与安全
- ⬜ **MiniMax 音频未转存 COS**：`music-generator.ts` 只返回 Provider 临时 URL 直接存 `generation_candidates.audio_url`，无转存私有 COS + 短时签名播放（长期依赖 Provider URL）。
- ⬜ **分享白名单未联调验证**：✅ `share_access_grants` 表已建（迁移 0004）+ `ShareService` 白名单逻辑（owner 放行/首次访问建授权/撤销/lastAccessedAt）已实现；⬜ **需真实环境联调验证**（当前开发环境无法验证完整链路）。
- ⬜ **STORAGE_DRIVER 默认 mock**：环境变量未配置时静默降级到 mock 存储，无启动期 fail-fast 校验，生产误用风险。
- ✅ **3 个 env 声明但未接线**：已复核确认 `SUPABASE_SERVICE_ROLE_KEY`/`TENCENT_COS_PUBLIC_BASE_URL`/`PROVIDER_SECRET_ENCRYPTION_KEY` 在 `src/` 全量零引用（仅本文档/`delivery-readiness.md` 提及）。`.env.example` 在仓库中实际不存在（未被 git 追踪、磁盘无此文件，快照里的 `M .env.example` 已过期），因此无需删改 env 文件。结论：已确认未使用，暂不接入；未来如需服务端特权操作（service role）/ COS 公开读基址 / Provider 密钥加密，再按需新增并在 `.env.example` 声明。

### 前端缺失与假壳
- ⬜ **假按钮未接线**：复制为新项目/导出 PDF/分析旋律/分析画面 → 接真实或 disabled+tooltip 或删除。
- ⬜ **侧栏「最近项目」仍硬编码**：曾为 mock 3 条，需接 `/api/projects`（`src/components/inspire/sidebar.tsx`）。

### 后端缺失
- ⬜ **GET /api/generation-jobs/[id] 不存在**：只有 POST，无法轮询恢复未完成任务（页面刷新后任务丢失）。
- ⬜ **CI/健康检查/E2E 全空**：`.github/workflows` 不存在；无 `/api/health`；`tests/e2e/` 零用例。

---

## 🟠 P1 上线前应完成（完整性 / 用户体验 / 安全）

### 前端完整性
- ⬜ **H5 外壳**：顶部栏 + 底部导航（当前移动端无导航，`sidebar.tsx` `hidden lg:flex`）。
- ⬜ **版本树数据仍是 mock VERSIONS**：✅ mock 常量已清除，版本树已接真实 `listVersions`（`src/lib/inspire-data.ts`）；⬜ **需验证节点渲染/删除/应用接线**。
- ⬜ **DELETE 端点接线**：✅ `DELETE /api/projects/[id]/versions/[versionId]` 已存在，`GenerationService.delete` 已实现（子节点 parent 上移、主版本迁移）；⬜ **前端版本弹窗「删除」按钮需接线**。
- ✅ **next.config.ts 安全头**：已在 `next.config.ts` 加 `headers()`（应用于 `/:path*`）：X-Frame-Options(SAMEORIGIN)/X-Content-Type-Options/Referrer-Policy/Permissions-Policy(camera+mic self)/HSTS，并加了保守 CSP（保留 `unsafe-inline` 兼容 Next 内联脚本与 Tailwind 内联样式，`connect-src 'self' https:` 覆盖同源 SSE，`media-src ... blob: https:` 兼容录音 blob 与 MiniMax 外链音频）。`pnpm build` 通过。
- ⬜ **启动期 env 校验**：缺配置时 fail-fast 而非静默降级（避免生产误用 mock）。

### 后端/API
- ⬜ **工作台首屏聚合 API**：避免 N+1 串行往返（当前首屏多次独立请求）。

---

## 🟡 P2 增强 / 上线后迭代

- ⬜ **DeepSeek 真 SSE token 直通**：当前伪流式（先全量返回再切片，`creative-chat/stream/route.ts:36`）。
- ⬜ **波形/播放器接 wavesurfer.js**：库已装，`AudioPlayer` 仍伪波形。
- ⬜ **IndexedDB 离线补交、HEIC 转码、A/B 同步播放**。
- ⬜ **分轨(mute/solo)/词曲双通道**：无 `demo_stems` 表、无 Web Audio 多轨播放。

---

## 🚀 部署与国内生产化（Vercel 仅作「快速验证架构」）

> 结论：Vercel 不能当国内稳定性保障。正式面向大量国内用户前，要准备国内部署。落地组合：**自有域名 + Vercel hkg1 + 同区 PG + COS 直传 + 依赖本地化 + API 聚合 + SSE 降级**。现在就买可备案域名、预留 `cn` 环境。

### 当前阶段必做
- ⬜ **自有域名**，不用 `*.vercel.app`。
- ⬜ **Function 固定 `hkg1`（香港）**。
- ⬜ **PostgreSQL 与 Function 同区/邻近亚太**（别香港 Function + 美国库）。
- ⬜ **音频/图片走腾讯 COS 直传 + 短时签名播放**，不经 Vercel 中转（直传 Intent 已实现；⬜ MiniMax 结果转存 COS + 短时签名播放未做）。
- ⬜ **字体、脚本、图标全部本地化**（禁 Google Fonts / 海外 CDN）。
- ⬜ **登录不要只靠 Google**（至少邮箱；正式版考虑手机/微信）。
- ⬜ **SSE 必须有轮询降级**，断线不等于生成失败。
- ⬜ **国内三网 + 微信内实测**，设阈值再决定是否切国内云。

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
6. ⬜ 微信内浏览器/真机：麦克风、播放、二维码、时间点评论。
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
3. ✅ ~~P0-4 灵感库~~ → 已完成（Track A）。
4. ⬜ **P0 数据模型一致性**（Brief 字段补 prompt / theme 持久化 / hummingAssetId 接线 / outputType 统一）。
5. ⬜ **P0 存储/安全**（MiniMax 音频转存 COS / 分享白名单联调 / env 校验 / 环境变量清理）。
6. ⬜ **P0 前端假壳清理**（假按钮接线 / 侧栏真实数据 / 版本树删除应用接线）。
7. ⬜ **P0 后端缺失**（GET /api/generation-jobs/[id] / CI/健康检查/E2E）。
8. ⬜ **P1 前端完整性**（H5 外壳 / next.config.ts 安全头 / 首屏聚合 API）。
9. ⬜ **部署/国内化 + 联调**（自有域名 + hkg1 + 同区 PG + COS 直传 + 本地化 + 聚合 API + SSE 降级）。

---

## 📊 统计

- **P0 条目**：4 大类（数据模型/存储安全/前端缺失/后端缺失），共 **14** 条。
- **P1 条目**：2 大类（前端完整性/后端API），共 **5** 条。
- **P2 条目**：共 **4** 条。
- **已完成 P0**：Brief 生成链路 / 候选版本拆分 / 生成参数透传 / 灵感库 / 分享白名单实现（待联调）。
