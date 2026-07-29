# SongDraft

**把零散歌词和灵感，快速变成一首可试听的歌曲 Demo。**

SongDraft 是响应式词曲 Demo 创作工具。当前 UI 恢复为最初 v0 三栏工作台，在保持原素材构建、创意简报和候选结果布局的基础上，接入 DeepSeek 歌词精修与 MiniMax 音乐生成。

## 当前能力

- v0 Sidebar、TopToolbar 和素材/生成/结果三栏创作台。
- DeepSeek 歌词生成与精修，自动传递项目最近 20 条历史消息。
- MiniMax Music 2.6 歌曲生成，真实音频回写候选卡播放器。
- 歌词、哼唱、图像素材入口与腾讯云 COS 兼容上传基础设施。
- 线性 Demo 版本与历史恢复。
- 作品分页、歌曲详情、歌词折叠、评论、导出、链接和二维码分享。
- 普通评论与时间点评论。
- Supabase Auth、PostgreSQL/Drizzle、COS 和外部 AI 的可替换边界。

没有外部凭据时，开发环境使用明确标注的 Mock 歌词、Web Audio 和合成 WAV，不冒充 DeepSeek 或 MiniMax。

## 本地运行

推荐 Node.js 22 和 pnpm：

```bash
pnpm install --frozen-lockfile
pnpm dev
```

开发环境未配置 Supabase 时可使用安全的 Mock Auth。若需要显式配置，复制 `.env.example` 为 `.env.local`；不要提交该文件。

## 验证

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
DATABASE_URL=postgresql://songdraft:songdraft@127.0.0.1:5432/songdraft pnpm drizzle:check
pnpm test:e2e
```

## 文档

- [产品 SPEC](docs/SPEC.md)
- [需求清单](docs/requirements.md)
- [技术方案](docs/technical-design.md)
- [交付审计](docs/delivery-readiness.md)
- [外部 API 与 Vercel 发布](docs/future-work.md)
- `docs/v0.md`：v0 视觉与组件参考

DeepSeek、MiniMax、腾讯云 COS 和 Vercel 的配置及后续工作见 `docs/future-work.md`。
