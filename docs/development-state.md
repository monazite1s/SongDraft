# SongDraft 开发续接快照

> **当前实现覆盖说明（2026-07-30）**：`/` 已切换为“灵感记录”首页，不再渲染旧版三栏工作台；支持音频、图片、文本三类记录。音频/图片先创建私有灵感草稿取得上传归属，再走直传、校验、自动快照；文本在首次有效保存时创建记录。三类记录均可在保存面板中创建或选择项目，然后进入 `/create/[projectId]`。未关联项目的对象键使用 `users/{userId}/records/{recordId}` 前缀，关联后由后端事务归属项目。旧版三栏工作台仍暂时位于 `/create`，后续按最新 SPEC 改为左右分栏。


> 更新时间：2026-07-29  
> 正式目录：`/Users/marongzhen/code/hackthon`  
> 分支：`feature/songdraft-foundation`

## 当前唯一 UI 基线

当前产品已经回退到 Git 提交 `ec532ac` 的 v0 复现版本。后续开发必须保持：

```text
Sidebar
+ TopToolbar
+ 三栏工作台
  ├── 360px 素材构建
  ├── 248px 生成控制
  └── 自适应创意简报 / Demo 候选
```

不要恢复后来版本的首页对话、深紫半透明 AppShell、艺人卡片、艺人 Hero 或左右两栏创作页。当前 `/`、`/create`、`/create/[projectId]` 均使用 `SongDraftWorkspace`。

## 已接入 AI 能力

### DeepSeek

- v0“精修歌词”按钮调用 `POST /api/creative-chat/stream`。
- `ConversationService` 为每个项目保存 user/assistant 消息。
- 每次调用前读取最近 20 条历史消息并传入 DeepSeek。
- 当前歌词、创作提示和处理指令一并进入模型上下文。
- 返回歌词写回项目，并在 v0“精修版/原始版”区域展示。
- 无 Key 时使用透明 `MockLyricAssistant`。

### MiniMax

- v0“生成 Demo”按钮调用 `POST /api/generation-jobs`。
- 默认模型已按官方当前文档调整为 `music-2.6`。
- 真实 HTTPS 音频 URL 进入 v0 候选卡原生播放器。
- 生成结果保存为线性版本。
- 无 Key 时使用透明 `MockMusicGenerator`。

### Prompt

Prompt 位于 `src/modules/ai/prompts/`：

- `conversation.system.ts`
- `lyrics.system.ts`
- `music.system.ts`
- `index.ts`：版本号和 Prompt 构建函数

页面和 Route Handler 不得直接拼接系统 Prompt。

## 保留的基础设施

- Supabase Auth 与开发 Mock Auth。
- PostgreSQL/Drizzle 与进程级 Mock Repository。
- 腾讯云 COS/Mock Storage。
- 项目、版本、作品、导出、分享 Token、二维码和评论服务。
- 对话表 `creative_conversations`、`creative_messages`。

## 环境状态

正式目录的 `.env.local` 已配置 DeepSeek 和 MiniMax，并被 Git 忽略。不要把 Key 移入源码、文档、客户端配置或提交记录。

关键非敏感配置：

```bash
TEXT_PROVIDER_MODE=deepseek
DEEPSEEK_MODEL=deepseek-v4-flash
MUSIC_PROVIDER_MODE=minimax
MINIMAX_MUSIC_MODEL=music-2.6
```

## 后续工作

1. DeepSeek 上游 Token 级 SSE 直通。
2. MiniMax 临时 URL 自动下载并转存私有 COS。
3. MiniMax Music Cover 哼唱预处理。
4. Prompt 版本评估、匿名 Token 用量与成本统计。
5. PostgreSQL、Supabase、COS 和 Vercel 真实环境验收。

## 本轮说明

本轮按用户要求优先完成代码生成与正式目录同步，没有执行完整 test/lint/typecheck/build 验证。后续如需验证，以实际命令输出为准。

## 禁止提交

- `.env*` 和任何 API Key；
- `.DS_Store`；
- `inspire2-demo/` 原始项目；
- 录音、生成音频缓存、`.next/` 和测试产物。
