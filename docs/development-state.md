# SongDraft 开发续接快照

> 更新时间：2026-07-29  
> 用途：会话压缩后恢复开发上下文；以 Git 和实际文件为最终事实来源。

## 用户目标与约束

- 正式产品名：`SongDraft`。
- `inspire2-demo/` 仅是 v0 视觉参考，不得提交、导入或沿用其临时状态模型。
- 响应式 Web：桌面创作台 + 手机 H5 捕捉、分享、试听和评论。
- 24h Hackathon，但架构需要清楚、可维护，同时避免微服务、CQRS、Redis 队列等过度设计。
- Supabase 只负责邮箱密码认证和 Session。
- PostgreSQL + Drizzle 保存业务数据。
- 腾讯云 COS 保存图片、视频、录音、Demo 和头像；浏览器使用服务端签发的短时 URL 直传。
- 无真实 Provider/COS 配置时允许显式 Mock，不能冒充真实调用。
- 不提交 `.DS_Store`、`.env*`、构建产物、v0 稿或其他无关文件。
- Superpowers 插件已从 Codex 配置和缓存中删除，后续不要恢复或使用其流程。

## Git 状态

- 仓库根目录：`/Users/marongzhen/Desktop/hackthon`
- 当前分支：`feature/songdraft-foundation`
- 此工作区通过 `.git` 指向原仓库的 worktree 元数据；受限环境下 Git 元数据不可解析。继续只修改当前目录，不做提交操作。
- `main` 没有被直接开发。
- `.gitignore` 已覆盖 `.DS_Store`、`inspire2-demo/`、`.env*`、`node_modules/`、`.next/`、测试产物和 `*.tsbuildinfo`。
- 当前基础架构改动尚未提交；提交前必须重新检查 `git diff --cached --name-only`。

## 已完成且验证过

### 工程基线

- Next.js 16.2.6、React 19、TypeScript strict、Tailwind 4、Vitest、Playwright、ESLint、pnpm。
- 构建脚本使用 `next build --webpack`，原因是当前沙箱不允许 Turbopack CSS 处理阶段绑定端口。
- 首次提交前曾通过：根页面测试 1/1、Lint、TypeScript、生产构建。

### 共享领域

- `InputModality`、`CombinationKey`、`OutputType`、`ExecutionKind`。
- C1–C7 组合识别，空输入抛出 `input_required`。
- 项目输入 Zod Schema。
- 最近一次共享测试：10/10 通过。

### 数据库

- Schema：`src/infrastructure/db/schema.ts`
- 连接工厂：`src/infrastructure/db/client.ts`
- Drizzle 配置：`drizzle.config.ts`
- 首次迁移：`drizzle/0000_neat_surge.sql`
- 12 张表：profiles、projects、inspiration_assets、analysis_results、creative_briefs、provider_configs、generation_plans、generation_jobs、demo_versions、demo_assets、share_links、comments。
- `drizzle:check` 已通过。
- 尚未连接或创建真实数据库；`drizzle:generate/check` 使用虚拟 `DATABASE_URL` 只生成/检查文件。
- 真实建表需配置 `.env.local` 的 `DATABASE_URL` 后执行 `pnpm drizzle:migrate`。

### 认证与页面框架

- Supabase SSR server/client 封装。
- 登录、注册、退出 Server Actions。
- 非生产环境在未配置 Supabase 且未显式选择认证模式时自动使用 Mock，也可设置 `AUTH_MODE=mock`；生产环境始终关闭 Mock。
- 私有 App Layout、桌面 Sidebar、手机底部导航。
- Auth Layout、Public Share Layout。
- 首页、创作台占位、作品、设置。
- App 和分享页 Skeleton。

### 对象存储与上传

- `ObjectStorage` 接口隔离业务与厂商 SDK。
- `TencentCosStorage` 使用腾讯云官方 `cos-nodejs-sdk-v5` 3.0.0，支持 PUT/GET 预签名、`headObject` 和删除。
- COS Secret 仅由 server-only 模块从环境变量读取。
- 上传 Intent 同时校验项目归属、MIME、扩展名和大小，并生成用户/项目隔离对象键。
- Complete 接口使用 `headObject` 复核真实大小和 MIME 后才把素材标记为 ready。
- 非生产 Mock Storage 使用系统临时目录，Mock PUT/GET 仍要求登录并校验对象键归属。
- API：`POST /api/uploads/intents`、`POST /api/uploads/:id/complete`、非生产 `/api/uploads/mock`。

## 当前验证状态

- `pnpm test`：33/33 通过（2026-07-29），涵盖认证模式安全降级、v0 工作台渲染、工作台直接保存新项目、组合识别、上传/私有预览/软删除、项目、作品筛选、Profile、合成样例播放器、Mock 分析/生成、Provider 路由、分享评论与导出文件名安全。
- `pnpm lint`：通过。
- `pnpm build`：通过，包含 Auth、项目 API、应用页面和三个上传 API。
- `pnpm typecheck`：在构建完成后顺序执行并通过。
- 注意：不要并行运行 `pnpm build` 与 `pnpm typecheck`，两者会竞争 `.next/types`。
- Supabase JS 提示 Node 20 将在未来弃用；当前开发机是 Node 20.20.2。近期可运行，部署和最终 README 应声明 Node 22 推荐。

## v0 UI 复原与工作台行为

- `/`、`/create/new` 与 `/create/[projectId]` 统一使用接近 1:1 复原 `inspire2-demo` 的三栏创作工作台：240px 侧栏、56px 顶栏、360px 素材区、248px 生成操作列及自适应结果区。
- 作品库、作品详情与设置页沿用同一套 v0 设计令牌、侧栏、卡片、筛选器与弹窗组件；品牌统一替换为 SongDraft。
- 新工作台无需预先创建项目：首次点击保存创建 Project 并继续留在完整工作台；后续点击保存创建新的 Demo Version。
- 本地 Mock 项目仓库挂载到进程级共享对象，保证 API 创建、详情读取与 Generation API 在不同 Next.js 路由 bundle 间一致。

## 下一步顺序

1. 已实现 Project Repository/Service（PostgreSQL 与透明内存 Mock）及首页创建项目流程、项目列表。
2. 已实现工作台文字、录音、图片/视频上传 UI、Mock Analyzer、Brief/Plan/透明 Mock 交互，以及 Generation Job、版本历史/主版本、Share Token/撤回、公开 H5 和评论服务。
3. Mock Capability Router、评论回流/管理、分享列表/有效期、作品筛选、应用 Profile 和透明合成试听样例已实现；下一步接入真实音频生成/存储播放；项目 JSON 创作包导出已完成。
4. 新增 `docs/future-work.md`，涵盖 API 对接清单和 Vercel 发布手册。

## 文档基线

- `docs/SPEC.md`
- `docs/requirements.md`：P0-01–26、AC-01–15。
- `docs/technical-design.md`
- `docs/2026-07-29-songdraft-foundation-design.md`
- `docs/future-work.md`：待完成工作、COS/DeepSeek/音乐平台/Auth 对接清单及 Vercel 教程。
- `docs/delivery-readiness.md`：需求映射、透明 Mock 边界、自动化验证和上线前门槛。

## 常用验证命令

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
DATABASE_URL=postgresql://songdraft:songdraft@localhost:5432/songdraft pnpm drizzle:check
git status --short --branch
git diff --cached --name-only
```
