# SongDraft 后续工作、外部对接与 Vercel 发布手册

> 本文把 Hackathon 原型中“已实现的透明降级”与“上线前必须完成的真实对接”分开列出。不要将 Mock 标识删除后直接当作生产能力发布。

## 1. 当前交付边界

已具备：Next.js 全栈骨架、响应式桌面/H5 Layout、Supabase Auth 封装、Drizzle Schema 与首次迁移、项目创建 API、COS/Mock Storage 抽象与受保护上传 Intent、浏览器哼唱录音/音视频文件选择、创作工作台的 Brief/Plan/Mock 交互、持久化 Generation Job/Version/Share/Comment 服务与公开 H5 分享页。

当前 Mock 的边界：没有 `DATABASE_URL` 时项目、版本、分享和评论仅在进程内存保存；音乐候选展示为明确标注的无音频模拟结果。真实生产使用时，数据库持久化路径已实现，但仍需完成外部音频 Provider、COS 播放地址与完整素材 UI 对接。

## 2. 后续待完成工作

### P0 闭环

- [ ] 录音：已用 `MediaRecorder` 录制并走 Upload Intent 直传；仍需增加时长读取、重录确认与录音试听。
- [ ] 素材：已接入文字、音频、图片/视频的选择、私有预览、软删除和上传状态；仍需增加“参与下一次生成”开关与媒体元数据（时长、封面）。
- [ ] 分析：已实现 Text / Melody / Vision 的透明 Mock 分析及结果保存；仍需接入真实模型、置信度、结构化字段与失败重试。
- [ ] Brief：保存可编辑快照、冲突来源与确认时间；未确认不得创建生成任务。
- [ ] Job：已保存幂等键、Plan、完成状态和版本；仍需增加短轮询、取消、失败重试和外部回调恢复。
- [ ] 版本：已保存 Brief/Plan/Provider/候选快照，支持历史读取与设置主版本；仍需增加父版本链、参数对比和从历史再次生成。
- [ ] 授权音频：当前提供明确标注的浏览器本地合成样例，便于试玩播放/评论链路；上线前仍需准备至少 6 条可公开演示的授权样例音频，或接入真实 Provider 结果。
- [ ] 分享：已生成随机 Token、数据库仅存 SHA-256 Hash，支持二维码、公开 H5、撤回、项目内列表与有效期选择；仍需支持编辑已有链接的评论权限与有效期。
- [ ] 评论：已支持普通/时间点评论、版本三重绑定、访客昵称校验、创作者回流、已读及项目所有者软删除；匿名作者删除需在后续增加一次性 comment token。
- [ ] 作品库：已支持搜索、输入组合/状态筛选和空状态；仍需分页、复制、归档与软删除。
- [ ] 创作包：已支持 JSON 导出（项目、素材元数据、分析、版本、分享）；仍需加入 Markdown、纯文本歌词与受权媒体下载清单。

### 上线质量

- [ ] 增加项目/分享/评论的单元测试和 Playwright 主路径：登录→创建→上传→确认→生成→分享→访客评论。
- [ ] 对 390px、768px、1440px 进行真机/浏览器视觉回归。
- [ ] 为 API 加入基础限流（登录、上传 Intent、评论、生成）；记录 requestId、耗时和 Provider 错误码，禁止记录正文、Token 或 Secret。
- [ ] 设定对象存储清理任务：业务软删除后延迟删除对象，禁止请求路径直接批量删除。
- [ ] 最后检查 `.env*`、`.DS_Store`、`inspire2-demo/`、音频原始文件和构建产物均未进入 Git。

## 3. 外部 API 对接清单

| 集成 | 当前状态 | 需要的环境变量/配置 | 上线前验证 |
|---|---|---|---|
| PostgreSQL | Schema 与迁移已就绪，尚未建库 | `DATABASE_URL` | `pnpm drizzle:migrate` 后创建项目、重启后仍可读取 |
| Supabase Auth | 邮箱密码代码已封装，未配置真实项目 | `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、可选 `SUPABASE_SERVICE_ROLE_KEY` | 注册、邮件确认策略、登录、退出、刷新 Session、Profile upsert |
| 腾讯云 COS | SDK + 预签名 + Mock 已实现 | `STORAGE_DRIVER=cos`、`TENCENT_COS_SECRET_ID`、`TENCENT_COS_SECRET_KEY`、`TENCENT_COS_BUCKET`、`TENCENT_COS_REGION` | 私有 Bucket、浏览器 CORS、20MB 音频/100MB 视频、签名到期、越权读取失败 |
| DeepSeek | 未接入 | `DEEPSEEK_API_KEY`、可选 `DEEPSEEK_BASE_URL`、`TEXT_PROVIDER_MODE=deepseek` | 结构化 JSON、超时/重试、敏感词策略、原始歌词不被覆盖 |
| 音乐生成平台（Mureka / MiniMax 等） | 未接入 | 独立 `MUSIC_PROVIDER_*` Key/URL/Callback Secret；不要复用 COS Key | Provider 能力表、异步回调验签、轮询、下载到私有 COS、版权/费用披露 |
| 二维码 | 本地依赖已安装 | `NEXT_PUBLIC_APP_URL` | 二维码链接可在手机打开，撤回后 404/410 |

### 腾讯云 COS 配置要点

1. 建立私有 Bucket，应用只持有最小权限子账号；生产环境不要使用根账号 Secret。
2. 配置 CORS，只允许正式站点与 Preview 域名的 `PUT`、`GET`、`HEAD`；允许 `content-type` 请求头。
3. 应用只签发 `dev/prod/users/{userId}/projects/{projectId}/...` 前缀的短期地址。浏览器绝不保存 COS Secret。
4. 回调/complete 时以 `headObject` 返回的大小和 MIME 为准；文件名、客户端 MIME 与扩展名都不能单独信任。

### DeepSeek 接入建议

将请求收敛在 `src/modules/analyzers/` 中，输入/输出使用 Zod Schema。建议先只做“文本/歌词 → Brief + 歌词草稿”，使用低温度、固定 JSON Schema；保留 `executionKind=real_external`、模型名、耗时与限制说明。不要把用户原始歌词作为可覆盖字段写回 `inspiration_assets`。

### 音乐 Provider 接入建议

不同平台对“文本、哼唱、图片/视频”支持不同，不能假设一个 API 同时接收三者。Capability Router 要拆成：文字/视觉→提示词或歌词、哼唱→旋律参考、音乐 API→歌曲/配乐/旋律草稿。每个 Generation Plan 必须记录真实调用、间接使用、未使用或模拟使用的素材。外部回调仅接受签名验证后的请求；下载结果后转存私有 COS，再向前端签短时播放地址。

当前工程已内置 Mock Capability Router，能区分文字、哼唱、视觉及其组合，并生成歌曲 Demo、配乐 Demo、旋律草稿三种可解释计划。接入真实 Provider 时只替换 Router 的 Provider capability 与 Executor，不改变工作台输入模型。

## 4. Vercel 发布教程

### 4.1 发布前准备

1. 将代码推送到私有 Git 仓库；确认 `.gitignore` 生效，禁止提交 `.env.local`、COS Secret、Provider Key、数据库导出和未授权音频。
2. 在托管 PostgreSQL 创建数据库（可使用 Supabase Postgres、Neon 或自有 PostgreSQL），取得 TLS `DATABASE_URL`。
3. 在 Supabase Authentication 配置站点 URL 为生产域名，并将 Vercel Preview 域名加入 Redirect URLs。
4. 在 COS 配置生产域名 CORS 和最小权限子账号。

### 4.2 创建 Vercel 项目

1. 在 Vercel 导入 Git 仓库，Framework Preset 选择 Next.js，Root Directory 选择仓库根目录。
2. Node.js 使用 22.x；Install Command 保持 `pnpm install --frozen-lockfile`，Build Command 使用 `pnpm build`。
3. 将下列变量分别添加到 Production、Preview 和 Development，Preview 使用独立数据库/存储前缀：

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
MUSIC_PROVIDER_MODE=mock
```

`SUPABASE_SERVICE_ROLE_KEY`、DeepSeek Key、音乐平台 Key 只在确有对应服务端操作时添加，绝不能使用 `NEXT_PUBLIC_` 前缀。

### 4.3 执行迁移与验收

在本地或受控 CI 环境配置生产 `DATABASE_URL` 后执行一次：

```bash
pnpm drizzle:check
pnpm drizzle:migrate
pnpm test
pnpm lint
pnpm build
```

迁移是版本化 SQL；已发布的迁移文件不可修改。Vercel Build 阶段不建议自动执行迁移，以免多实例并发发布造成竞争。

部署后按此顺序检查：登录、刷新 Session、创建项目、受保护上传、生成透明 Mock、手机分享页面、撤回链接。随后在 Vercel Logs 检查是否存在 Secret、Token、SQL 或完整用户文本；若有立即移除日志并轮换相关密钥。

## 5. 演示模式说明

本地可用 `.env.local` 设置 `AUTH_MODE=mock`、`STORAGE_DRIVER=mock`、`MUSIC_PROVIDER_MODE=mock`。Mock 只用于开发/评审，生产环境不得启用 `AUTH_MODE=mock`，也不得把无音频候选显示为“已生成歌曲”。
