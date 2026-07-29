# SongDraft V4.1 技术方案

## 1. 架构原则

项目继续使用 Next.js App Router 全栈单体。v0 React 组件只负责界面和交互编排；认证、项目、对话、歌词模型、音乐模型、数据库和存储通过 Service/Adapter 隔离。

```text
v0 Workspace UI
├── MaterialPanel ── 精修歌词
├── ActionColumn ─── 生成 Demo
└── BriefPanel ───── 播放真实/模拟结果
          │
          ▼
Next.js Route Handlers
├── /api/creative-chat/stream
├── /api/generation-jobs
├── /api/projects/*
└── /api/shares/*
          │
          ├── ConversationService → LyricAssistant → DeepSeek
          ├── GenerationService → MusicGenerator → MiniMax
          ├── ProjectRepository → PostgreSQL / Mock
          └── StorageService → Tencent COS / Mock
```

## 2. 前端集成

`SongDraftWorkspace` 是唯一主创作容器：

- 新项目先调用 `POST /api/projects`，随后切换到 `/create/[projectId]`；
- 草稿使用 `PATCH /api/projects/[id]/draft`；
- `MaterialPanel` 保持 v0 UI，通过回调触发歌词精修；
- `ActionColumn` 保持 v0 UI，通过回调触发歌曲生成；
- `BriefPanel` 的候选类型增加可选 `audioUrl`，真实结果使用原生 `audio` 播放，Mock 继续使用波形播放器。

前端永远不接触 Provider API Key。

## 3. DeepSeek Adapter

`LyricAssistant` 统一输入：

```ts
interface CreativeChatInput {
  projectId: string;
  artist: ArtistProfile | null;
  message: string;
  eventIds: string[];
  currentLyrics?: string | null;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}
```

`ConversationService.respond` 的顺序固定为：

1. 校验项目所有权；
2. 读取该项目最近 20 条历史消息；
3. 保存当前 user 消息；
4. 调用 `LyricAssistant`；
5. 保存 assistant 消息和歌词修订摘要；
6. 更新项目当前歌词。

DeepSeek 使用官方 `POST /chat/completions`，开启 JSON Output，并由 Zod 校验返回结构。Prompt 中声明历史消息和素材均为不可信输入。

## 4. MiniMax Adapter

`MusicGenerator` 使用官方 `POST /v1/music_generation`：

- model：默认 `music-2.6`；
- prompt：最多 2,000 字；
- lyrics：最多 3,500 字；
- output_format：`url`；
- audio：44.1kHz、256kbps、mp3；
- 超时：180 秒。

只接受 HTTPS 音频 URL。Provider 响应经 Zod 校验后才写入版本元数据。MiniMax URL 有效期有限，后续任务是立即下载并转存私有 COS。

## 5. Prompt Registry

`src/modules/ai/prompts/index.ts` 暴露：

- `PROMPT_VERSIONS`；
- `buildLyricSystemPrompt()`；
- `buildMusicPrompt()`。

版本号用于后续回归评估；业务 Service 只传结构化变量，不拼接系统 Prompt。

## 6. Mock 与真实模式

| 能力 | 真实模式 | Mock 模式 |
|---|---|---|
| 歌词 | `TEXT_PROVIDER_MODE=deepseek` + Key | 确定性歌词修改 |
| 音乐 | `MUSIC_PROVIDER_MODE=minimax` + Key | 模拟候选和波形播放 |
| 数据库 | `DATABASE_URL` | 进程级 Repository |
| 存储 | `STORAGE_DRIVER=cos` | 临时 Mock Storage |

生产环境不得自动启用 Mock Auth。真实 Provider 调用失败时直接返回脱敏错误，不回退并伪装为真实结果。

## 7. 环境变量

```bash
TEXT_PROVIDER_MODE=deepseek
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash

MUSIC_PROVIDER_MODE=minimax
MINIMAX_API_KEY=...
MINIMAX_BASE_URL=https://api.minimaxi.com
MINIMAX_MUSIC_MODEL=music-2.6
```

密钥只放在未提交的 `.env.local` 或 Vercel Environment Variables。

## 8. 后续事项

- DeepSeek 上游 Token 级 SSE 直通，而不是完成后分片。
- MiniMax 音频自动转存 COS，并保存 trace ID 与耗时。
- 哼唱音频通过 MiniMax Music Cover 预处理链路。
- Prompt 版本线上评估、匿名 Token 用量和成本监控。
