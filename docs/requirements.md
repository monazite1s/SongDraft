# SongDraft V4.1 需求清单

> ⚠️ 本文件为 V4.1 历史需求清单，已被 docs/SPEC.md（V5）与 docs/todo.md 取代，仅作历史参考。

> 本清单覆盖 V4.0 的“首页对话/艺人 Hero”需求。当前 UI 基线为 `ec532ac` 的 v0 三栏工作台。

## P0

- P0-01：恢复 v0 Sidebar、TopToolbar 与三栏创作工作台，不改变原布局和配色。
- P0-02：首页 `/`、新建页 `/create` 和项目页 `/create/[projectId]` 使用同一 `SongDraftWorkspace`。
- P0-03：歌词、哼唱和图像素材 Tab 保持 v0 交互结构。
- P0-04：“精修歌词”调用 DeepSeek；无凭据时使用透明 Mock。
- P0-05：DeepSeek 接收当前歌词、创作提示、处理指令和最近 20 条历史消息。
- P0-06：模型返回的完整歌词进入“精修版”，调用前歌词保留为“原始版”。
- P0-07：对话和歌词修订按项目持久化，所有查询绑定当前用户。
- P0-08：“生成 Demo”调用 MiniMax `music-2.6`；无凭据时使用透明 Mock。
- P0-09：真实音频 URL 在 v0 候选卡中直接播放，并保存为线性版本。
- P0-10：Prompt 集中管理、带版本号，页面不得内嵌系统 Prompt。
- P0-11：作品、版本、分享、二维码、普通评论和时间点评论基础设施继续保留。
- P0-12：认证、PostgreSQL/Mock Repository、腾讯云 COS/Mock Storage 边界继续保留。
- P0-13：API Key 只存在服务端环境变量，不写入源码、响应、日志或 Git。
- P0-14：更新 SPEC、技术方案、开发状态和后续 API 清单。

## 当前真实 Provider

- 文本与歌词：DeepSeek V4 Flash，`POST /chat/completions`。
- 图像（图生文）：智谱 GLM-4V（`GLM_VISION_MODEL`，默认免费 `glm-4v-flash`，`ZHIPU_API_KEY`），`POST /api/paas/v4/chat/completions`；参考图经 COS 预签名 URL 作为 `image_url` 传入，输出 ≤120 字音乐意象，生成时注入音乐 prompt「视觉意象」槽（三模态汇聚）。
- 音乐：MiniMax `/v1/music_generation`，按素材自动路由：
  - 纯文本（无参考音频）→ `music-2.6`（`MINIMAX_MUSIC_MODEL`，默认 `music-2.6`）。
  - 文本 + 音频双通道（带哼唱/参考音频）→ `music-cover`（`MINIMAX_MUSIC_COVER_MODEL`，默认付费 `music-cover`；免费账号可设 `music-cover-free`，但 Token Plan 账号不支持 `-free` 系列），
    参考音频经 COS 预签名 URL 作为 `audio_url` 传入；歌词 ≥10 字时直传，否则由 MiniMax ASR 从参考音频提取。

## Mock 边界

- 未配置 Key 时必须明确返回 `simulated`，不得标记为真实生成。
- Provider 调用失败时返回脱敏错误，不以 Mock 结果冒充成功。
- 未配置数据库时对话历史仅保存在当前进程，重启丢失。

## 后续范围

- DeepSeek Token 级 SSE 直通与匿名成本统计。
- MiniMax 音频自动转存私有 COS。
- music-cover 参考音频格式兼容（浏览器录制为 webm/opus，MiniMax 列举 mp3/wav/flac；webm 可能被拒收，需服务端转码）。
- 真实 Provider 的限流、告警和调用追踪。
