# SongDraft 技术设计

> 版本：V3.0  
> 日期：2026-07-29  
> 对应需求：`docs/requirements.md` V3.0

## 1. 技术目标

使用一个模块化 Next.js 全栈工程完成 SongDraft 的认证、多模态素材、分析编排、Demo 版本、分享评论和响应式体验。

架构追求清晰边界和可替换基础设施，但不引入微服务、Redis、独立消息队列、CQRS、通用工作流引擎或复杂领域事件。

关键约束：

- `inspire2-demo` 仅作为视觉参考；
- Supabase 仅负责 Auth；
- PostgreSQL 保存业务数据；
- 腾讯云 COS 保存媒体；
- Next.js Route Handlers 作为 BFF 和服务端安全边界；
- 无云密钥时可使用透明 Mock 完成演示；
- 正式代码、文案和 Metadata 统一使用 SongDraft。

## 2. 技术栈

| 范围 | 选择 | 说明 |
|---|---|---|
| 框架 | Next.js 16 App Router | 全栈单体、路由级加载边界 |
| 语言 | TypeScript strict | 共享领域类型 |
| UI | React 19、Tailwind CSS 4、shadcn/ui | 迁移 v0 视觉语言 |
| 表单 | React Hook Form + Zod | 客户端体验与服务端复验 |
| Auth | Supabase Auth SSR | 仅认证和 Session |
| 数据库 | PostgreSQL | 厂商无关，使用 `DATABASE_URL` |
| ORM | Drizzle ORM + drizzle-kit | 显式 Schema 和迁移 |
| 对象存储 | 腾讯云 COS | 私有 Bucket、预签名 URL |
| 日志 | 结构化 console/logger | request/job ID，可替换 |
| 测试 | Vitest + Testing Library + Playwright | 规则、集成、主路径 |
| 包管理 | pnpm | 与 v0 一致 |

## 3. 总体架构

```text
Browser / H5
├── Supabase Auth Session
├── Server/Client Components
├── MediaRecorder / Player
└── COS direct upload with signed URL
          │
          ▼
Next.js BFF
├── Auth boundary
├── Zod validation
├── Domain services
├── Job executor
├── Provider adapters
└── COS signing adapter
          │
          ├──────────────► Tencent COS
          │
          ▼
PostgreSQL
├── profiles/projects/assets
├── analyses/briefs/plans/jobs
├── versions/demo assets
└── shares/comments/provider configs
```

原则：页面只组合模块；Service 承载业务规则；Repository 隔离持久化；Infrastructure 实现 Auth、数据库、存储和 Provider 接口。简单 CRUD 不额外堆叠 UseCase/Controller 层。

## 4. 工程目录

```text
SongDraft/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx
│   │   │   ├── loading.tsx
│   │   │   ├── page.tsx
│   │   │   ├── create/[projectId]/page.tsx
│   │   │   ├── works/page.tsx
│   │   │   ├── works/[projectId]/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── (public)/s/[token]/page.tsx
│   │   ├── api/
│   │   ├── error.tsx
│   │   ├── not-found.tsx
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── modules/
│   │   ├── auth/
│   │   ├── projects/
│   │   ├── inspiration/
│   │   ├── analysis/
│   │   ├── generation/
│   │   ├── versions/
│   │   ├── sharing/
│   │   └── comments/
│   ├── components/
│   │   ├── app-shell/
│   │   ├── feedback/
│   │   └── ui/
│   ├── infrastructure/
│   │   ├── auth/
│   │   ├── db/
│   │   ├── storage/
│   │   └── providers/
│   ├── shared/
│   │   ├── contracts/
│   │   ├── errors/
│   │   ├── validation/
│   │   └── utils/
│   └── styles/
├── drizzle/
├── public/mock-audio/
├── tests/
├── .env.example
├── drizzle.config.ts
├── middleware.ts
└── package.json
```

每个业务模块最多包含 `domain.ts`、`schema.ts`、`repository.ts`、`service.ts`、`queries.ts`、`components/`。只有模块确实需要时才创建文件。

## 5. Layout 与渲染策略

### 5.1 Root Layout

- HTML 语言、字体、Metadata、Toast 和全局样式；
- 不读取用户业务数据；
- Metadata 产品名为 SongDraft。

### 5.2 Auth Layout

- 居中的轻量认证卡；
- 已登录用户重定向应用首页；
- 登录、注册各自提供提交中和字段错误状态。

### 5.3 App Layout

- 服务端读取 Session 和 Profile；
- 未登录重定向 `/login`；
- 桌面 Sidebar、Mobile Nav、主内容容器；
- 不在 Layout 加载具体项目，避免所有页面共享慢查询。

### 5.4 Public Share Layout

- 不复用后台 Sidebar；
- 只加载 Share View DTO；
- 无效、过期、撤回 Token 返回统一不可用状态，不披露是否曾存在。

### 5.5 Loading 和 Error

- 每个页面 `loading.tsx` 复用对应 Skeleton；
- Skeleton 保留 Sidebar、Toolbar、卡片和播放器高度；
- route-level `error.tsx` 提供重试；
- 领域错误由页面映射为空状态、无权限或 Not Found；
- mutation 错误在组件内展示，不触发整页崩溃。

## 6. 认证

Supabase 只负责邮箱密码和 Session；业务 Profile 在 PostgreSQL。

```typescript
interface AuthUser {
  id: string;
  email: string;
}

interface AuthGateway {
  getUser(): Promise<AuthUser | null>;
  requireUser(): Promise<AuthUser>;
}
```

注册流程：

```text
Supabase signUp
→ 邮箱确认策略按环境配置
→ 首次认证请求调用 ensureProfile(user)
→ 创建 profiles 行
→ 进入应用首页
```

不使用浏览器 `localStorage` 自行保存 Token。Server Component 和 Route Handler 使用 Supabase SSR Cookie；API 每次重新确认用户身份。

## 7. 领域模型

### 7.1 输入与组合

```typescript
type InputModality = "text" | "melody" | "visual";
type CombinationKey =
  | "text"
  | "melody"
  | "visual"
  | "melody+text"
  | "text+visual"
  | "melody+visual"
  | "melody+text+visual";

type OutputType = "song" | "soundtrack" | "melody_sketch";
type ExecutionKind = "real_local" | "real_external" | "simulated";
```

组合键由统一函数根据存在的有效素材计算，页面不得自行拼接。

### 7.2 素材

```typescript
interface InspirationAsset {
  id: string;
  projectId: string;
  ownerId: string;
  kind: "text" | "lyrics" | "audio" | "image" | "video";
  objectKey: string | null;
  originalName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  durationMs: number | null;
  content: string | null;
  included: boolean;
  status: "pending" | "uploading" | "ready" | "failed" | "deleted";
}
```

### 7.3 分析、简报和计划

```typescript
interface AnalysisResult<T> {
  data: T;
  executionKind: ExecutionKind;
  provider: string;
  limitations: string[];
  confidence?: number;
}

interface CreativeBrief {
  theme: string;
  moods: string[];
  genres: string[];
  bpm: number;
  instruments: string[];
  lyrics?: string;
  lyricSummary?: string;
  melodyFeatures?: string;
  visualDescription?: string;
  evidence: Array<{ assetId?: string; source: string; detail: string }>;
  conflicts: Array<{
    field: string;
    sources: string[];
    suggestion: string;
    resolution: string;
  }>;
}

interface GenerationStep {
  id: string;
  capability: string;
  provider: string;
  inputs: InputModality[];
  executionKind: ExecutionKind;
  limitations: string[];
}
```

## 8. 数据库

### 8.1 表

| 表 | 核心字段 |
|---|---|
| profiles | id、email、display_name、avatar_object_key、created_at |
| projects | id、owner_id、title、description、status、cover_asset_id、main_version_id、timestamps |
| inspiration_assets | id、project_id、owner_id、kind、content/object_key、metadata、included、status |
| analysis_results | id、project_id、asset_id、analyzer、execution_kind、payload、limitations |
| creative_briefs | id、project_id、version_no、payload、confirmed_at、created_by |
| provider_configs | id、owner_id、type、name、base_url、encrypted_secret、capabilities、enabled |
| generation_plans | id、project_id、brief_id、provider_ref、output_type、combination、steps、confirmed_at |
| generation_jobs | id、project_id、plan_id、status、progress、error_code、attempt、timestamps |
| demo_versions | id、project_id、parent_id、version_no、snapshot、is_main、created_by |
| demo_assets | id、version_id、job_id、object_key、duration_ms、metadata、execution_kind |
| share_links | id、project_id、version_id、token_hash、expires_at、allow_comments、revoked_at |
| comments | id、project_id、version_id、share_id、author_user_id、guest_name、content、at_ms、read_at |

### 8.2 约束与索引

- 所有 UUID 使用数据库默认生成；
- `profiles.id` 等于 Supabase User ID；
- 项目子表必须通过 `project_id` 关联；
- Share Token 使用 SHA-256 哈希唯一索引；
- `comments(version_id, created_at)`、`projects(owner_id, updated_at)`、`jobs(project_id, created_at)` 建索引；
- 主版本更新通过事务保证一个项目只有一个 `main_version_id`；
- JSONB 用于不可变快照，不用于高频筛选字段；
- 迁移前向执行，已部署迁移不可修改。

### 8.3 数据访问

Repository 方法必须显式接收 `ownerId` 或已授权的 Share Scope。禁止先按 ID 查询后在页面层判断所有权。

```typescript
interface ProjectRepository {
  findOwnedById(projectId: string, ownerId: string): Promise<Project | null>;
  listOwned(ownerId: string, query: ProjectListQuery): Promise<Page<ProjectSummary>>;
  create(ownerId: string, input: CreateProjectInput): Promise<Project>;
}
```

## 9. 腾讯云 COS

### 9.1 抽象

```typescript
interface ObjectStorage {
  createUpload(input: CreateUploadInput): Promise<SignedUpload>;
  createDownload(objectKey: string, expiresInSec: number): Promise<string>;
  head(objectKey: string): Promise<StoredObject | null>;
  delete(objectKey: string): Promise<void>;
}
```

实现：

- `TencentCosStorage`：使用腾讯云 COS Node.js SDK；
- `MockObjectStorage`：开发和测试使用，返回同契约结果；
- 业务模块只能依赖接口和工厂，不能直接 import COS SDK。

### 9.2 对象键

```text
{environment}/users/{userId}/projects/{projectId}/{assetKind}/{uuid}.{ext}
```

用户原始文件名仅作为元数据，不进入对象键，避免路径穿越、冲突和隐私泄露。

### 9.3 上传协议

1. `POST /api/uploads/intents` 校验用户、项目、类型、扩展名和大小；
2. 服务端生成对象键和 5–10 分钟有效的 PUT 预签名 URL；
3. 浏览器直接上传 COS 并显示进度；
4. `POST /api/uploads/{id}/complete` 调用 `head` 校验对象大小和 Content-Type；
5. 素材状态改为 ready；
6. 未完成 Intent 由清理任务或运营脚本清除。

COS Bucket 默认私有。SecretId、SecretKey、SessionToken 不返回浏览器。签名只允许单对象、指定方法和最短有效期。

## 10. 多模态分析

```typescript
interface Analyzer<TInput, TOutput> {
  analyze(input: TInput): Promise<AnalysisResult<TOutput>>;
}
```

- TextAnalyzer：主题、情绪、风格、歌词结构；
- MelodyAnalyzer：时长、BPM、轮廓、音域和记忆点；
- VisionAnalyzer：场景、色彩、运动、情绪、乐器和歌词意象；
- Analyzer Factory 根据环境和 Key 选择真实实现或 Mock；
- 每个结果写入 executionKind、provider 和 limitations；
- Mock 返回稳定的输入相关结构，不能随机产生无法复现的演示结果。

融合优先级由纯函数实现并覆盖 C1–C7。Creative Brief 保存分析证据和冲突，不只保存最终 Prompt。

## 11. Provider 和 Router

```typescript
interface ProviderRoute {
  combination: CombinationKey;
  outputTypes: OutputType[];
  native: boolean;
  notes: string[];
}

interface ProviderCapabilities {
  providerId: string;
  routes: ProviderRoute[];
  maxCandidates: number;
  maxDurationSec: number;
}
```

Router：

1. 检测组合和输出；
2. 读取选中 Provider 能力；
3. 能原生覆盖则生成直接步骤；
4. 不能覆盖则将不支持素材转换为结构化描述或旋律特征；
5. 无真实实现或密钥时替换为 Mock Step；
6. 生成 warnings、limitations 和降级路径；
7. 用户确认后创建 Job。

任何 Provider 不得仅因不支持某模态而删除素材。

## 12. 异步生成

P0 使用数据库 Job + 轻量 Executor，不引入外部队列。

```typescript
type JobStatus =
  | "queued"
  | "analyzing"
  | "generating"
  | "completed"
  | "failed"
  | "cancelled";
```

- 创建 Job 使用幂等键，重复请求返回同一活动 Job；
- Executor 每个阶段写入进度；
- 客户端 1–2 秒短轮询；
- 页面刷新后通过 Job ID 恢复；
- attempt 限制自动重试次数；
- 完成写版本和 Demo Asset 必须幂等；
- 赛后可将 Executor 替换为正式队列，API 与状态机不变。

## 13. 分享与评论

### 13.1 Token

- 使用 32 字节密码学随机值；
- URL 只出现原 Token，数据库仅保存 SHA-256；
- 查询时哈希后匹配；
- 过期、撤回和不存在均返回同一错误；
- 二维码编码完整 HTTPS 分享 URL。

### 13.2 Share View DTO

只返回：项目公开标题/简介/封面、指定版本、已分享 Demo 的短时播放 URL、允许展示的歌词、评论和评论权限。

### 13.3 评论权限

- Share 有效且允许评论；
- 登录用户使用 user ID，访客使用校验后的 nickname；
- 时间点 `atMs` 必须位于音频时长内；
- 项目所有者可管理，作者可删除自己的评论；
- 评论写入 share、project、version 三重归属。

## 14. API 契约

```text
POST   /api/auth/profile/ensure
PATCH  /api/profile

GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id
POST   /api/projects/:id/duplicate
DELETE /api/projects/:id

POST   /api/uploads/intents
POST   /api/uploads/:id/complete
DELETE /api/assets/:id

POST   /api/projects/:id/analyze
PUT    /api/projects/:id/brief
POST   /api/projects/:id/brief/confirm
POST   /api/projects/:id/plans
POST   /api/plans/:id/confirm
POST   /api/generation-jobs
GET    /api/generation-jobs/:id
POST   /api/generation-jobs/:id/retry

POST   /api/projects/:id/versions
POST   /api/projects/:id/versions/:versionId/main

GET    /api/projects/:id/shares
POST   /api/projects/:id/shares
PATCH  /api/shares/:id
DELETE /api/shares/:id

GET    /api/public/shares/:token
POST   /api/public/shares/:token/comments
DELETE /api/comments/:id

GET    /api/provider-configs
POST   /api/provider-configs
PATCH  /api/provider-configs/:id
DELETE /api/provider-configs/:id
POST   /api/provider-configs/:id/test
```

统一响应：

```typescript
type ApiResult<T> =
  | { ok: true; data: T; requestId: string }
  | { ok: false; error: { code: string; message: string; fields?: Record<string, string[]> }; requestId: string };
```

错误码至少包括：`UNAUTHENTICATED`、`FORBIDDEN`、`NOT_FOUND`、`VALIDATION_FAILED`、`UPLOAD_INVALID`、`SHARE_UNAVAILABLE`、`PLAN_NOT_CONFIRMED`、`PROVIDER_UNAVAILABLE`、`JOB_FAILED`。

## 15. 前端状态

- 服务端查询结果由 Server Component 获取；
- 表单草稿和播放器状态使用局部 Client State；
- 不建立全局 Redux Store；
- 跨组件确需共享的创作台草稿使用范围 Context；
- URL 保存列表查询、筛选和 Tab；
- mutation 成功后使用 `revalidatePath` 或精确刷新；
- 大文件上传进度独立于页面导航状态。

创作台状态机：

```text
draft → uploading → analyzing → brief_ready → plan_ready
→ generating → results_ready → version_saved
```

失败状态保留已有素材和上一步快照，禁止清空用户输入。

## 16. v0 视觉移植策略

### 16.1 可迁移

- 颜色、字体、间距、圆角和阴影 Token；
- Sidebar、Toolbar、素材面板、Brief、播放器、版本弹窗、分享弹窗的视觉结构；
- 封面资源和已确认图标；
- 响应式视觉意图。

### 16.2 不直接迁移

- `lib/inspire-data.ts` 的业务类型和虚构 Provider；
- 页面顶层大量 `useState`；
- `setTimeout` 模拟任务；
- 客户端内存版本、分享和评论；
- 将整个页面声明为 `use client` 的结构；
- 旧品牌名称和 Metadata。

### 16.3 移植顺序

1. Design Token 和通用 UI；
2. App Shell、响应式导航、Skeleton；
3. 认证页面；
4. 首页与作品列表；
5. 创作台三个素材区；
6. Brief、Plan、结果和版本；
7. 作品详情；
8. 独立分享页和评论；
9. 设置与 Provider。

每个阶段先接正式 DTO/Service，再移植视觉，不建立第二套临时数据模型。

## 17. 安全

- 所有输入服务端 Zod 复验；
- 文件同时校验 MIME、扩展名、大小和归属；
- SQL 只通过 Drizzle 参数化查询；
- Auth Cookie 由 Supabase SSR 管理；
- COS、Provider 和数据库密钥只存环境变量；
- Provider Secret 加密后入库，响应只返回掩码；
- Share Token 哈希入库；
- 用户文本使用 React 转义，不渲染任意 HTML；
- 日志脱敏 Authorization、Cookie、Token、Secret 和签名 URL Query；
- 公开接口增加基础限流接口，P0 可使用数据库/内存滑动窗口；
- 删除操作确认目标并优先软删除。

## 18. 环境变量

```dotenv
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=

STORAGE_DRIVER=mock
TENCENT_COS_SECRET_ID=
TENCENT_COS_SECRET_KEY=
TENCENT_COS_BUCKET=
TENCENT_COS_REGION=
TENCENT_COS_PUBLIC_BASE_URL=

PROVIDER_SECRET_ENCRYPTION_KEY=
MUSIC_PROVIDER_MODE=mock
```

`.env.example` 只写变量名和安全说明，不包含真实值。Service Role Key 仅在确有服务端管理需要时使用，业务认证不依赖它。

## 19. 测试

### 19.1 单元测试

- C1–C7 组合识别和空输入；
- 冲突优先级；
- Provider Router 直接、间接和 Mock 路由；
- Share Token 生成与哈希；
- COS 对象键和上传校验；
- Job 状态迁移；
- 评论时间点边界。

### 19.2 集成测试

- ensure Profile；
- 项目所有权查询；
- upload intent → complete；
- Brief 确认 → Plan → Job → Version；
- Share 创建、撤回、过期；
- 登录与匿名评论；
- 跨用户访问拒绝。

### 19.3 E2E

桌面主路径：注册 → 新建 → 三模态 → Brief → Plan → 两候选 → 三版本 → 分享。

手机主路径：打开分享 → 播放 → 时间点评论 → 创作者查看回流。

视口固定覆盖 390×844 和 1440×900。

## 20. 可观测性

- 每个 API 返回 requestId；
- 每个 Job 有 jobId、attempt、provider 和阶段；
- 日志事件：auth、upload、analysis、plan、job、version、share、comment；
- 记录耗时、状态和错误码，不记录媒体正文、歌词全文、密钥和完整签名 URL；
- UI 对用户显示稳定错误文案，对开发者保留 requestId。

## 21. 开发与部署

### 21.1 本地

- pnpm；
- PostgreSQL 可由 Docker Compose 启动；
- `STORAGE_DRIVER=mock`；
- Music/Analyzer 默认 Mock；
- Supabase Auth 可使用远程开发项目，测试中使用 Auth Gateway Stub。

### 21.2 线上

- Next.js 部署到支持 Node Runtime 的平台；
- PostgreSQL 可使用任意兼容托管服务；
- COS 配置 CORS，只允许正式域名和必要方法；
- 私有对象使用短时下载 URL；
- 生产环境禁用测试账号和调试响应。

## 22. 24 小时实施切片

| 阶段 | 交付 |
|---|---|
| 0–2h | 工程、质量门槛、Auth/DB/Storage 接口、迁移 |
| 2–5h | Layout、Skeleton、登录注册、Profile |
| 5–8h | 项目、首页、作品列表、COS/Mock 上传 |
| 8–12h | 创作台素材、Analyzer、Brief |
| 12–16h | Router、Plan、Job、候选、版本 |
| 16–19h | 分享、二维码、评论、作品详情 |
| 19–21h | Provider 设置、创作包、响应式 |
| 21–24h | E2E、真机、部署、数据、录屏和止损 |

AI Agent 按垂直模块工作，不允许多个 Agent 同时修改数据库 Schema、共享契约、根 Layout 或依赖文件；这些由主开发统一维护。

## 23. 需求追踪

| 技术模块 | P0 |
|---|---|
| Auth/Profile | P0-01、P0-02 |
| Project | P0-03、P0-18 |
| Inspiration/COS | P0-04、P0-05、P0-06、P0-07、P0-08 |
| Analysis/Brief | P0-09、P0-10 |
| Provider/Router | P0-11、P0-12、P0-13 |
| Job/Version | P0-14、P0-15、P0-16、P0-17 |
| Sharing/Comments | P0-19、P0-20、P0-21 |
| Export/UI/Security/Demo | P0-22、P0-23、P0-24、P0-25、P0-26 |

验收覆盖：AC-01、AC-02、AC-03、AC-04、AC-05、AC-06、AC-07、AC-08、AC-09、AC-10、AC-11、AC-12、AC-13、AC-14、AC-15 均由第 19 节测试或真机验收覆盖。

## 24. 完成定义

- SongDraft 工程可安装、类型检查、测试和生产构建；
- 数据库可从零执行迁移；
- Mock 模式无需 COS/音乐 Provider 密钥即可完成主路径；
- 配置 COS 后可真实直传和私有播放；
- 注册用户只能访问自己的项目；
- 分享访客只能访问指定版本；
- 真实与模拟步骤明确披露；
- v0 视觉已迁入正式数据和服务边界；
- 390px 与 1440px 核心页面可用；
- P0-01–26 和 AC-01–15 有验证记录。

## 25. 官方参考

- [腾讯云 COS Node.js SDK 预签名 URL](https://cloud.tencent.com/document/product/436/36121)
- [腾讯云 COS 使用预签名 URL](https://cloud.tencent.com/document/product/436/68284)
- [Supabase Next.js SSR Auth](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Drizzle ORM PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql)
