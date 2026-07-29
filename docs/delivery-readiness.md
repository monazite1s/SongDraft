# SongDraft V4.0 交付审计

> 审计日期：2026-07-29。透明 Mock 不等于已调用外部 AI。

## 需求证据

| 交付项 | 状态 | 证据 |
|---|---|---|
| 对话式首页 | 已实现 | 艺人选择、卡片轮播、事件 Tag、SSE、实时歌词和创作台跳转 |
| 一级生成入口 | 已实现 | `/create` 与首页、作品、知识库同级 |
| 新创作台 | 已实现 | 艺人 Hero、歌词/哼唱、固定生成按钮、右侧 SongDetail |
| 线性版本 | 已实现 | 单次单版本；Restore 复制快照为 N+1 |
| 作品/详情 | 已实现 | Project Repository 分页、卡片、`/works/[id]` |
| 私密分享 | 已实现 | Hash Token、二维码、H5 歌词、普通/时间点评论 |
| 艺人主题 | 已实现 | CSS 变量、约 280ms 过渡、默认品牌兜底、reduced-motion |
| 只读知识库 | 已实现 | `ArtistCatalog` 共享虚构资料 |
| 数据与 API | 已实现 | 0001 迁移、项目草稿、对话消息、SSE、版本恢复 |
| 外部接口清单/部署 | 已完成文档 | `technical-design.md`、`future-work.md` |

## 安全边界

- API 校验 Zod 输入、认证和项目所有权。
- 上传校验 MIME、扩展名、大小和 COS 对象键归属。
- Supabase Session 使用服务端 Cookie，不在 localStorage 保存 Token。
- 分享数据库只保存 Token SHA-256 Hash。
- DeepSeek、Mureka、COS 和数据库凭据均来自服务端环境变量。
- 页面不渲染用户 HTML；错误响应不暴露 Stack、SQL 或 Secret。
- 生产环境不会自动启用 Mock Auth。

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

测试覆盖首页、歌词助手、艺人事件引用、项目分页、单版本生成、线性恢复、分享评论、上传和 Mock 播放。

## 上线前外部条件

以下依赖真实凭据、授权或设备，不能由 Mock 验证替代：

1. Supabase、PostgreSQL、COS、DeepSeek 和 Mureka 生产配置。
2. Preview 数据库应用 0000/0001 迁移并验证重启持久化。
3. COS 私有 Bucket、CORS、短期签名和越权测试。
4. Mureka 回调验签、音频转存和音乐版权确认。
5. 微信内浏览器/真机麦克风、播放、二维码和评论测试。
6. Node.js 22 Vercel 构建。

## 禁止项

- 不提交 Secret、数据库 URL、Share Token、`.env.local` 或未授权媒体。
- 不编辑已发布迁移；后续变化必须新增迁移。
- 不把 simulated 文案替换为真实模型声明。
- 不重新启用旧图片/视频、Provider、Brief/Plan 或版本树 UI。
