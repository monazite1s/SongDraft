# SongDraft V4.1 需求清单

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
- 音乐：MiniMax Music 2.6，`POST /v1/music_generation`。

## Mock 边界

- 未配置 Key 时必须明确返回 `simulated`，不得标记为真实生成。
- Provider 调用失败时返回脱敏错误，不以 Mock 结果冒充成功。
- 未配置数据库时对话历史仅保存在当前进程，重启丢失。

## 后续范围

- DeepSeek Token 级 SSE 直通与匿名成本统计。
- MiniMax 音频自动转存私有 COS。
- MiniMax Music Cover 哼唱预处理。
- Prompt 版本线上评估和回归数据集。
- 真实 Provider 的限流、告警和调用追踪。
