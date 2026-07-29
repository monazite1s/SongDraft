# SongDraft 上线前交付审计

> 审计日期：2026-07-30（反映当前真实交付状态）。
> 核心原则：透明 Mock 不等于已调用外部 AI；不把 simulated 文案冒充真实模型。

## 当前真实交付状态

### 已完成的核心链路

| 核心链路 | 状态 | 证据 |
|---|---|---|
| 灵感记录首页 | ✅ 已实现 | 录音/图片/文本三 Tab、自动保存、版本快照去重、关联项目 |
| 制作台两栏布局 | ✅ 已实现 | 左侧素材构建、右侧 Brief+生成结果、DeepSeek 歌词精修、MiniMax music-2.6 |
| Brief 生成链路 | ✅ 已实现 | `BriefGenerator`（DeepSeek 结构化+Mock）+ `BriefService` + 三个端点 |
| 候选/版本拆分 | ✅ 已实现 | `generation_candidates` 表（迁移 0003）+ `saveCandidates` 事务 |
| 生成参数透传 | ✅ 已实现 | `creative_briefs.payload` 承载 `outputType`/`extraPrompt`/`quantity` |
| 灵感库 | ✅ 已实现 | `InspirationRepository.listPage` + 6 个端点 + 桌面表格/H5 卡片 |
| 版本树（git 式） | ✅ 已实现 | React Flow 版本树、`listVersions`、restore、删除（含子节点 parent 上移） |
| 分享白名单 | ✅ 已实现 | `share_access_grants` 表（迁移 0004）+ `ShareService` 白名单逻辑 |
| 评论 | ✅ 已实现 | 普通评论 + 时间点评论、软删除、权限隔离 |
| 艺术家列表 | ✅ 已实现 | `GET /api/artists` + 艺术家卡片、`ArtistRepository` |

### 当前外部 AI 集成

| 集成 | 真实状态 | 环境变量 | 验收状态 |
|---|---|---|---|
| DeepSeek V4 Flash | ✅ 真实 API 接入 | `DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL`、`TEXT_PROVIDER_MODE=deepseek` | 结构化响应、超时、错误脱敏已完成；SSE token 直通待补 |
| MiniMax Music 2.6 | ✅ 真实 API 接入 | `MINIMAX_API_KEY`、`MINIMAX_BASE_URL`、`MUSIC_PROVIDER_MODE=minimax` | 歌词生成歌曲、真实 URL 播放/分享/导出已完成；COS 转存待补 |
| Supabase Auth | ✅ 真实 API 接入 | `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY` | 注册、登录、退出、刷新 Session；生产禁用 Mock Auth |
| PostgreSQL | ✅ 真实数据库 | `DATABASE_URL` | Schema + 16 张表 + 迁移 0000-0004 |
| 腾讯云 COS | 🟡 部分接入 | `STORAGE_DRIVER=cos`、`TENCENT_COS_*` | 音频直传 Intent 已实现；MiniMax 结果转存 COS 待补 |

### Mock 边界（透明标识）

- 未配置 Key 时必须明确返回 `simulated`，不得标记为真实生成。
- Provider 调用失败时返回脱敏错误，不以 Mock 结果冒充成功。
- `executionKind` 区分 `real_external` / `simulated` / `transparent_mock`。

---

## 上线前必须完成的 P0 缺失

### 数据模型不一致与参数丢失
- ⬜ **Brief 字段未全部进 MiniMax prompt**：`instruments`/`melodyFeatures`/`visualReferences`/`priority`/`outputType` 已落库但 `buildMusicPrompt` 只取部分字段。
- ⬜ **theme/priority 未持久化**：`brief-panel.tsx` 局部 state，编辑后未 PATCH，生成时丢失。
- ⬜ **hummingAssetId 死字段**：generation-service 接收但 MiniMaxMusicGenerator.create 完全不使用。
- ⬜ **outputType 别名未统一**：`melody` vs `melody_sketch` 混用。

### 存储与安全
- ⬜ **MiniMax 音频未转存 COS**：依赖 Provider 临时 URL，无转存私有 COS + 短时签名。
- ⬜ **分享白名单未联调**：功能已实现，需真实环境验证完整链路。
- ⬜ **STORAGE_DRIVER 默认 mock**：无启动期 env 校验，生产误用风险。
- ⬜ **3 个 env 声明但未接线**：`SUPABASE_SERVICE_ROLE_KEY`/`TENCENT_COS_PUBLIC_BASE_URL`/`PROVIDER_SECRET_ENCRYPTION_KEY`。

### 前端缺失与假壳
- ⬜ **假按钮未接线**：复制为新项目/导出 PDF/分析旋律/分析画面。
- ⬜ **侧栏「最近项目」硬编码**：需接 `/api/projects`。
- ⬜ **GET /api/generation-jobs/[id] 缺失**：无法轮询恢复未完成任务。
- ⬜ **CI/健康检查/E2E 全空**：`.github/workflows` 不存在、无 `/api/health`、`tests/e2e/` 零用例。

---

## 上线前应完成的 P1

### 前端完整性
- ⬜ **H5 外壳**：顶部栏 + 底部导航（当前移动端无导航）。
- ⬜ **版本树弹窗接线**：删除/应用按钮接现有 API（API 已存在，前端未接线）。
- ⬜ **next.config.ts 安全头**：CSP/X-Frame-Options/HSTS/Referrer-Policy。

### 后端/API
- ⬜ **工作台首屏聚合 API**：避免 N+1 串行往返。
- ⬜ **启动期 env 校验**：缺配置时 fail-fast 而非静默降级。

---

## 已实现的安全边界

- ✅ API 校验 Zod 输入、认证和项目所有权。
- ✅ 上传校验 MIME、扩展名、大小和 COS 对象键归属。
- ✅ Supabase Session 使用服务端 Cookie，不在 localStorage 保存 Token。
- ✅ 分享数据库只保存 Token SHA-256 Hash。
- ✅ DeepSeek/MiniMax/COS/数据库凭据均来自服务端环境变量。
- ✅ 页面不渲染用户 HTML；错误响应不暴露 Stack、SQL 或 Secret。
- ✅ 生产环境不会自动启用 Mock Auth。

---

## 上线前外部条件（真实环境联调）

以下依赖真实凭据、授权或设备，不能由 Mock 验证替代：

1. ⬜ Supabase、PostgreSQL、COS、DeepSeek、MiniMax 生产配置。
2. ⬜ Preview 数据库应用 0000-0004 迁移并验证重启持久化。
3. ⬜ COS 私有 Bucket、CORS、短期签名和越权测试。
4. ⬜ MiniMax 音频转存 COS 与版权/内容审核策略确认。
5. ⬜ 微信内浏览器/真机：麦克风、播放、二维码、时间点评论。
6. ⬜ Node.js 22 Vercel 构建。
7. ⬜ 日志审计：Vercel Logs 不含 Secret、Token、完整 Prompt 或歌词。

---

## 禁止项

- ❌ 不提交 Secret、数据库 URL、Share Token、`.env.local` 或未授权媒体。
- ❌ 不编辑已发布迁移；后续变化必须新增迁移。
- ❌ 不把 simulated 文案替换为真实模型声明。
- ❌ 不把 Provider 临时 URL 作为长期播放资源。

---

## 部署与国内化（Vercel 仅作「快速验证架构」）

正式面向大量国内用户前需准备国内部署：**自有域名 + Vercel hkg1 + 同区 PG + COS 直传 + 依赖本地化 + API 聚合 + SSE 降级**。

### 当前阶段必做
- ⬜ 自有域名（不用 `*.vercel.app`）。
- ⬜ Function 固定 `hkg1`（香港）。
- ⬜ PostgreSQL 与 Function 同区/邻近亚太。
- ⬜ 字体、脚本、图标全部本地化（禁 Google Fonts / 海外 CDN）。
- ⬜ 登录不要只靠 Google（至少邮箱；正式版考虑手机/微信）。
- ⬜ SSE 必须有轮询降级。

### 正式上线前决策（切国内云触发条件）
大陆三网 **P95 首屏 > 3s**、**API P95 > 1.5s**、明显不可访问、或 **上传失败率 > 1%** → 启动腾讯云生产 + ICP 备案。

---

## 自动化门槛

必须全部通过后才视为可交付：

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
DATABASE_URL=postgresql://songdraft:songdraft@127.0.0.1:5432/songdraft pnpm drizzle:check
pnpm test:e2e
```

当前状态：✅ 45 个单元/组件测试全过；⬜ E2E 全空。

---

## 质量原则声明

1. **透明 Mock 不等于真实调用**：所有模拟结果必须明确标识 `simulated`，不得冒充真实 AI 输出。
2. **Provider 当前状态**：DeepSeek（文本/Brief）+ MiniMax music-2.6（音乐生成）。
3. **未来探索方向**：分轨/哼唱原创/Suno/Claude 歌词为未来质量提升方向，非当前实现。
