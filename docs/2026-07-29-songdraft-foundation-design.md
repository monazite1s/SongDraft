# SongDraft 工程基础设计

> 注：代码中以 docs/technical-design.md 引用的技术设计即本文件。

> 状态：已由用户确认  
> 日期：2026-07-29

## 背景

项目已有更新后的产品 Spec 和一套位于 `inspire2-demo` 的 v0 视觉稿。v0 当前由客户端状态、本地常量和定时器驱动，适合作为视觉参考，但不适合作为正式业务、持久化或安全边界。

正式项目命名为 SongDraft，并新建独立工程。所有页面文案、Metadata 和交付文档统一使用 SongDraft。

## 已确认的方案

采用模块化 Next.js 单体：

- Next.js App Router 同时承载页面与 BFF；
- Supabase 只负责邮箱密码认证与 Session；
- PostgreSQL + Drizzle 保存业务数据；
- 腾讯云 COS 保存图片、视频、录音、Demo 和头像；
- 浏览器使用服务端签发的短时 URL 直传 COS；
- Analyzer、Music Provider 和 Object Storage 均通过窄接口适配；
- 无外部密钥时使用明确标识的 Mock；
- v0 只迁移 Design Token、布局和展示组件，状态与假数据不迁移。

## 模块边界

业务按 Auth、Projects、Inspiration、Analysis、Generation、Versions、Sharing、Comments 垂直拆分。页面负责组合；Service 负责规则；Repository 负责持久化；Infrastructure 负责外部实现。

不为简单 CRUD 创建多余的 Controller、UseCase 和领域事件层。跨模块共享只允许稳定 ID、DTO 和接口，禁止直接访问其他模块的内部表查询。

## 页面框架

- Root Layout：品牌、字体、全局样式和反馈组件；
- Auth Layout：登录与注册；
- App Layout：Session、Profile、桌面 Sidebar 和手机导航；
- Public Share Layout：不加载后台框架，只呈现分享范围数据；
- 核心路由均有同构 Skeleton、错误、空状态和必要的 Not Found；
- Server Component 负责初始读取，Client Component 只承担录音、上传、播放器和编辑交互。

## 数据流

```text
注册/登录 → Supabase Session → PostgreSQL Profile

创建项目 → 请求 Upload Intent → COS 预签名直传
→ Complete 校验 → 素材元数据入库
→ Analyzer → Creative Brief → 用户确认
→ Capability Router → Generation Plan → 用户确认
→ Generation Job → Demo Assets → Version
→ Share Token → Public Share DTO → Comment → 创作端回流
```

## 数据和安全

- 所有业务记录归属 Supabase User ID；
- Repository 查询从入口携带 ownerId；
- Share Token 只保存哈希；
- 评论绑定 share、project 和 version；
- COS Bucket 私有，对象键按环境、用户和项目隔离；
- COS 和 Provider 密钥只存在服务端；
- 文件在签名前和完成后分别校验；
- Provider Secret 加密入库并在响应中掩码；
- 公开分享页不返回原始私有素材和内部 Provider 信息。

## 异步策略

Hackathon 使用数据库 Job、幂等状态机和前端短轮询，不引入 Redis 或独立消息队列。Executor 保持接口化，未来可以替换为正式任务系统而不改变页面和 API 契约。

## v0 移植策略

先创建并验证正式架构，再按 Design Token → App Shell → 认证 → 首页/作品 → 创作台素材 → Brief/Plan/结果 → 版本 → 分享评论 → 设置的顺序移植。

每次移植直接消费正式 DTO 和 Service，不建立过渡性的第二套假数据模型。v0 中虚构 Provider、页面级大对象状态、`setTimeout` Job 和旧品牌文案不进入正式工程。

## 明确不做

- 微服务；
- Redis 和分布式队列；
- CQRS 或事件溯源；
- WebSocket 实时协作；
- 通用工作流引擎；
- 复杂版本分支合并；
- 浏览器保存 API Key 或 COS 永久密钥。

## 质量门槛

- TypeScript strict、Lint、单元测试和生产构建通过；
- 数据库可从零执行迁移；
- Mock 模式可完整演示；
- COS 配置后可真实直传和私有播放；
- 390px 与 1440px 主路径可用；
- 登录、项目归属、分享与评论权限有集成测试；
- 真实与模拟步骤在 UI 和数据中保持一致。
