# SongDraft 后续工作与 Vercel 发布

## 0. P0 待办（上线前，待排期）

- **outputType 值统一**：将 `melody` 改为 `melody_sketch`（SPEC §7.5）。涉及 `src/lib/inspire-data.ts` 的 `OutputType` 与 `OUTPUT_TYPES`、`PROVIDERS.outputs`、版本/候选数据，以及 DB enum/迁移。当前 UI 标签均为「旋律草图」不受影响，故暂缓；上线前需统一并回归。
- **P0-3 生成参数走 Brief（已完成）**：`outputType`/`extraPrompt`/`quantity` 现存入 `creative_briefs.payload`，`POST /api/generation-jobs` 仅接收 `projectId + briefId + idempotencyKey`，`GenerationService.generate` 从该简报读取全部参数（含三参数），不再硬编码 outputType；前端点「生成」时先把当前参数 PATCH 进简报再据此生成。注：简报沿用别名 `melody`，生成计划内部归一化为 canonical `melody_sketch`，完整重命名见下条。
- **版本树删除/应用接线**：弹窗「删除/应用」按钮接现有 `/restore` + 新增版本删除 API；数据源换真实 `listVersions`（当前用静态 `VERSIONS`）。
- **P0-4 灵感库 `/inspirations`**：`InspirationRepository.listPage` + 6 个端点 + 桌面表格/H5 卡片页。
- **P0-5 分享白名单**：`share_members` 表 + 首次有效访问入白名单 + owner 列表/撤销（当前 token 即公开，安全硬伤）。

## 1. 当前已完成边界

- 对话式首页、热门虚构艺人、事件 Tag、SSE 思考/逐字输出和实时歌词预览。
- 一级“生成歌曲”导航，新建页和歌词/哼唱两栏创作台。
- DeepSeek V4 Flash 歌词适配器、MiniMax Music 2.6 歌曲适配器，以及无凭据时的透明 Mock。
- 线性版本和“恢复为新版本”。
- 项目分页、作品详情、私密分享、二维码、普通/时间点评论。
- Supabase Auth、PostgreSQL/Drizzle、腾讯云 COS/Mock Storage 边界。
- 无凭据开发模式；本地配置 Key 后自动启用真实外部 AI，数据库与 COS 仍可独立使用 Mock。

## 2. 外部 API 清单

| 集成 | 当前状态 | 环境变量 | 接入验收 |
|---|---|---|---|
| Supabase Auth | SSR 代码完成 | `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY` | 注册、登录、退出、刷新 Session；生产禁用 Mock Auth |
| PostgreSQL | Schema + 0000-0004 迁移完成 | `DATABASE_URL` | 迁移后重启仍能恢复项目、对话、版本和评论 |
| 腾讯云 COS | 签名/Mock Storage 完成 | `STORAGE_DRIVER=cos`、`TENCENT_COS_*` | 音频直传、Head 校验、私有读取、越权失败、CORS |
| DeepSeek | V4 Flash Adapter 已接入 | `DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL`、`TEXT_PROVIDER_MODE=deepseek` | 结构化响应、超时、错误脱敏已完成；Token 级 SSE 和成本记录待补 |
| MiniMax | Music 2.6 Adapter 已接入 | `MINIMAX_API_KEY`、`MINIMAX_BASE_URL`、`MINIMAX_MUSIC_MODEL`、`MUSIC_PROVIDER_MODE=minimax` | 歌词生成歌曲、真实 URL 播放/分享/导出已完成；COS 转存与哼唱 Cover 待补 |
| 艺人知识库 | Static Catalog | 数据库与后台配置 | 资料 CRUD、授权媒体、版本化、事件筛选和检索 |

## 3. DeepSeek 后续增强

1. 将 DeepSeek 原生流直接转换成现有 `CreativeStreamEvent`，而不是结果完成后分片。
2. 为 Prompt Registry 增加线上评估样例、匿名 Token 用量和版本效果对比。
3. 增加用户取消透传与仅针对可重试错误的退避重试。
5. 记录模型、耗时、Token 和 requestId，不记录完整歌词、会话正文或 Key。
6. 无 Key 时继续返回透明 Mock；有 Key 但调用失败时不得伪装成功。

## 4. MiniMax 与 COS 后续增强

1. 将 MiniMax 返回的 HTTPS 音频下载后转存 COS 私有对象，避免长期依赖 Provider URL。
2. 哼唱通过短时 COS GET URL 接入 MiniMax Music Cover 预处理与歌词保留流程，禁止公开 Bucket。
3. 保存 MiniMax trace ID、耗时和状态，但不保存请求密钥或完整日志。
4. 转存后写入 DemoAsset 对象键、时长和 `real_external`。
5. 播放/下载时签发短时 URL；不得把 Provider 原始长期 URL持久暴露给客户端。
6. 明确音乐版权、费用、超时和内容审核策略。

## 5. 艺人资料与背景动画 TODO

- 将 `StaticArtistCatalog` 替换为数据库 Repository，并增加只读缓存。
- 增加后台对艺人、应援色、头像、Hero、曲风、事件、粉丝名和口号的维护。
- 只使用授权图片和音频，记录来源与授权期限。
- 文档上传后再评估解析、Embedding 和 RAG；本轮不预建向量基础设施。
- 创作台背景动画使用统一 Canvas/CSS 接口，只读取主题色；尊重 reduced-motion，并控制移动端性能。

## 6. Vercel 发布教程

### 6.1 前置条件

1. 使用 Node.js 22 和 pnpm 锁文件。
2. 准备 Supabase Auth、托管 PostgreSQL 和私有 COS Bucket。
3. COS CORS 仅允许正式域名与受控 Preview 域名的 `PUT/GET/HEAD`。
4. 确认 Git 中不存在 `.env*`、`.DS_Store`、v0 原项目、录音、构建缓存和未授权媒体。

### 6.2 Vercel 配置

- Framework：Next.js。
- Install：`pnpm install --frozen-lockfile`。
- Build：`pnpm build`。
- Node.js：22.x。
- Production 与 Preview 使用独立数据库/存储前缀。

最低变量：

```text
NEXT_PUBLIC_APP_URL=https://your-domain.example
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
DATABASE_URL=postgresql://...
STORAGE_DRIVER=cos
TENCENT_COS_SECRET_ID=...
TENCENT_COS_SECRET_KEY=...
TENCENT_COS_BUCKET=...
TENCENT_COS_REGION=...
TEXT_PROVIDER_MODE=deepseek
DEEPSEEK_API_KEY=...
DEEPSEEK_MODEL=deepseek-v4-flash
MUSIC_PROVIDER_MODE=minimax
MINIMAX_API_KEY=...
MINIMAX_MUSIC_MODEL=music-2.6
```

Secret 不得使用 `NEXT_PUBLIC_` 前缀。生产环境不设置 `AUTH_MODE=mock`。

### 6.3 迁移和发布

在受控环境执行：

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm drizzle:check
pnpm drizzle:migrate
```

迁移 `0000` 和 `0001` 已发布后不可编辑。Vercel Build 不自动迁移，避免多实例竞争。

### 6.4 上线验收

1. 注册/登录/退出和刷新 Session。
2. 首页对话、事件 Tag、歌词生成及刷新恢复。
3. 手机麦克风拒绝、重新授权、上传失败和重试。
4. 歌曲生成、版本恢复、Mock/真实标签和音频下载。
5. 分享二维码、过期/撤回、普通/时间点评论。
6. 检查 Vercel Logs 不包含 Secret、Token、完整 Prompt 或歌词。
