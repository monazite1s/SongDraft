# SongDraft 质量优先路线图

> 状态：设计草案（部分未落地）。provider 现状为 MiniMax/DeepSeek；Suno/Claude/分轨为未来探索方向，非当前实现。

> 2026-07-30。基于 4 视角调研（架构师 / 技术主管 / 产品分析师 / 音乐人）+ 主链路质量深度分析。
> **原则：质量优先，成本次要。** 每个新 AI 能力上线前必须过 PoC + 评测。

## 调研核心结论

- **主链路瓶颈**：旋律/编曲/演唱/词曲咬合 4 个质量维度全压进一个 2000 字 `prompt` 字符串；`hummingAssetId` 是死字段（从未传给 MiniMax）；`PROMPT_VERSIONS` 声明但未落库；`AudioPlayer` 单轨伪波形；`provider-router` 的 melody/visual 全 Mock。
- **质量最优栈**：Suno v5（原创生成）+ Claude Sonnet（歌词文学性）+ DeepSeek（Brief/结构）+ LALAL.AI Perseus（分轨）+ Qwen3-VL（图生文）。
- **a 哼唱原创**：质量最优解 = **Suno Inspo**（音频作创意参考→原创编曲），**不是 MiniMax music-cover**（那是翻唱改词，非原创）。
- **b 分轨**：最大杠杆 = **优先模型原始 stems**（Suno v5 支持），其次 LALAL.AI Perseus；AI 合成音轨事后分离质量天然差。

---

## 一、Prompt 治理 + Tag 封装（问题 1）

### Tag 封装设计（单一事实源）
新建 `src/modules/ai/prompts/tags.ts`，定义领域 tag，让 prompt 构建器 / Zod / UI 三处共用：

```ts
// 素材构建三 tab
INPUT_TAGS = {
  text:  { label:"歌词/文本", promptRole:"歌词与创作描述",   field:"lyrics+creativePrompt", icon:FileText },
  audio: { label:"哼唱/音频", promptRole:"旋律动机/哼唱参考", field:"hummingAsset",          icon:AudioLines },
  image: { label:"图像/视频", promptRole:"视觉意象/氛围参考", field:"visualAsset",           icon:Image },
}
// 简报字段（每 tag: promptHint + zod + uiMeta）
BRIEF_TAGS = {
  theme:{promptHint:"创作主题", zod:z.string().min(1), ui:{label:"主题"}},
  lyrics:{promptHint:"完整歌词", zod:z.string(), ui:{label:"歌词",multiline:true}},
  mood:{promptHint:"情绪", zod:z.array(z.string()), ui:{label:"情绪",chips:true}},
  genre:{promptHint:"风格", zod:z.string(), ui:{label:"风格"}},
  tempo:{promptHint:"速度/BPM", zod:z.string(), ui:{label:"速度"}},
  vocalStyle:{promptHint:"演唱方式", zod:z.string(), ui:{label:"演唱方式"}},
  reference:{promptHint:"参考素材说明", zod:z.string(), ui:{label:"参考"}},
}
```

收益：`buildBriefSystemPrompt` 从 `BRIEF_TAGS` 自动生成 JSON schema 描述 + Zod（消除双份漂移，修 melody 遗留）；简报编辑 UI 从同一组 tag 渲染（label/placeholder/校验统一）。

### 步骤
1. **P0** 建 `tags.ts`（INPUT_TAGS + BRIEF_TAGS + 灵感字段 tags）。
2. **P0** `buildBrief/Lyric/EnrichSystemPrompt` 从 tags 生成 JSON 描述 + 导出 Zod。
3. **P0** schema 加 `promptVersion` + 模型元数据（model/modelVersion/params_hash）落库（SPEC 合规 + A/B 地基）。
4. **P1** `PROMPT_REGISTRY`：prompt + 参数（temperature/max_tokens）+ provider + version 绑定，service 从 registry 取参。
5. **P1** 简报编辑 UI（brief-panel 修改部分）从 `BRIEF_TAGS` 渲染。
6. **P1** prompts 测试（输出含必要片段 + 抗注入）。

---

## 二、主链路质量优先（问题 2）

### 模型选型（质量维度）
| 环节 | 首选 | 备选 | 理由 |
|---|---|---|---|
| 音乐生成（原创） | **Suno v5**（Inspo 哼唱原创 / 原生纯文本） | MiniMax music-3.0（国内合规） | 业内整体质量与 vocoder 人声最强；Inspo 贴近"哼唱→原创" |
| 歌词文学性 | **Claude Sonnet** | DeepSeek（结构/Brief） | 中文文学性横评第一；DeepSeek 留做结构化 JSON |
| 分轨 | **模型原始 stems**（Suno v5）→ LALAL.AI Perseus | Demucs htdemucs_ft（离线） | 原始 stems 质量远超事后分离；Perseus 是事后分离质量第一 |
| 图生文 | **Qwen3-VL** | 豆包 Vision | 中文音乐意象最强 |

### 任务 a：文本+音频→原创高质量 demo
- **核心纠偏**：哼唱原创走 **Suno Inspo**，不走 MiniMax cover（cover=翻唱）。
- 复活 `hummingAssetId`：新建 `CoverGenerationInput`（含 `referenceAudioUrl`/`feature_id`）+ 独立适配器（不复用现有 `MiniMaxMusicGenerator`）。
- 编排：哼唱→[旋律特征提取 BPM/调性/pitch contour]→[歌词模型按旋律节奏断句，保证词曲咬合]→[Suno Inspo 原创生成]。
- 质量门槛：哼唱 ≥15s、底噪 <-40dB。

### 任务 b：音轨拆分 mute/solo
- **优先用模型原始 stems**（Suno v5）—— 质量最大杠杆。
- 否则 LALAL.AI Perseus API（4-stem: vocal/drums/bass/other）。
- 新增 `demo_stems` 表 + 异步任务端点。
- 前端：Web Audio API 单共享 `AudioContext` + 多 `AudioBufferSourceNode` 同步 + `GainNode` 做 mute/solo（参考 waveform-playlist）。wav 无损。

### 质量保障体系（核心）
- **PoC 闸门**：每新能力（a/b/Suno 迁移/Claude 歌词）上线前，测试集 + 双盲 A/B + 自动指标 + 音乐人 5 维盲评。
- **评测**：自动（SDR/ISR/SAR via museval；词曲对齐 DTW；保真 PESQ）+ 人工（旋律/编曲/人声/贴合/整体，≥3 评分者，Cohen's κ）。
- **A/B 回滚**：`promptVersion`+模型元数据落库 → 坏案例定位 → 流量 A/B → 人工评分驱动全量。
- **护栏**：低质量（SDR/对齐分低）进人工复核队列；失败不冒充（现有 `executionKind` 扩展）。

### 端到端质量链路（4 卡点）
灵感(图/文/音) →①素材质量门控→ [Qwen3-VL 图意 + 哼唱旋律特征] → [DeepSeek Brief] →②Brief 完整性→ [Claude 歌词+DeepSeek 结构] → [Suno Inspo 原创生成] →③自动指标+盲评→ [原始 stems 或 Perseus 分轨] →④低 SDR 复核→ [Web Audio 多轨播放/导出]

### 步骤
1. **P0** 修复 `hummingAssetId` 死字段 + 独立 Cover 适配器（a 前提）。
2. **P0** `promptVersion`+模型元数据落库（A/B 地基，与问题 1 共建）。
3. **P0** 评测体系搭建（自动 + 人工）。
4. **P1** 任务 a PoC：Suno Inspo vs MiniMax cover 质量对比（决定主生成模型）。
5. **P1** 歌词切 Claude Sonnet（DeepSeek 留 Brief/结构）。
6. **P1** 任务 b：优先原始 stems，其次 Perseus + `demo_stems` 表。
7. **P2** Web Audio 多轨播放器重构。
8. **P2** Qwen3-VL 图片灵感接入。

---

## 三、条件不合理修复（问题 3）

### P0（核心错误路径，立即修）
1. **生成简报**：`disabled = busy || !hasAnyContent`（`hasAnyContent = lyrics.trim() || audioUploaded || imageUploaded`）。不能只看 `selectedInputs.length`（默认全选，永非 0）。
2. **生成 Demo**：`disabled = busy || !briefId || !effectiveLyrics.trim()`（必须有真实简报 + 歌词）。

### P1
- 无 onClick 按钮（复制为新项目/导出 PDF/删除项目/分析旋律/分析画面/从此版本重生成）→ 接真实 或 disabled+tooltip 或 移除。
- 分享：项目详情/歌曲详情接 `ShareModal`（不要 disabled/console.log）。
- 版本树「应用」：选中 isMain 时 disabled。
- 灵感页保存/补全/AI 补全加 `!snapshot` 前置校验。

### P2
帮助死链、VersionModal 显示项目名（非 UUID）、空状态文案。

---

## 四、音乐人能力（问题 4）

分水岭 = "能进 DAW 的工作流" + "专业控制"。按价值：
1. **分轨 + 导出 STEM/WAV**（= 任务 b）—— DAW 衔接，音乐人工具 vs 玩具的核心。
2. **哼唱→原创编曲**（= 任务 a）—— 音乐人核心输入。
3. **专业参数**：BPM/调性/拍号/曲式（前奏-主歌-副歌-桥段）精确指定 → 进 `BRIEF_TAGS`（复用问题 1 tag 系统）。
4. 人声音色/唱法选择、基于反馈局部微调（非全量重生成）、版权商用说明、H5 捕捉强化。

---

## 统一实施计划（3 波）

### 第一波：基础治理 + 立即修复（无外部依赖，立即可做）
- 问题 3 P0 三连（生成简报/Demo 禁用条件）。
- 问题 1 tag 封装（INPUT_TAGS + BRIEF_TAGS）+ `promptVersion` 落库 + `PROMPT_REGISTRY`。
- 问题 3 P1（无 onClick 按钮、分享接线、版本应用、校验）。

### 第二波：主链路质量优先（需 PoC + 外部模型决策）
- 评测体系搭建（自动 + 音乐人盲评）。
- 任务 a PoC：Suno Inspo vs MiniMax cover（决定主生成模型）。
- 打通 `hummingAssetId`（独立 Cover 适配器）。
- 歌词双模型（Claude + DeepSeek）。
- Qwen3-VL 图生文。

### 第三波：分轨与专业控制（音乐人分水岭）
- 任务 b：优先原始 stems，其次 Perseus + `demo_stems` 表 + 异步任务。
- Web Audio 多轨播放器（mute/solo）。
- 专业参数 tag（BPM/调性/曲式）进 Brief。
- 导出 STEM/WAV（DAW 衔接）。

质量保障（PoC + 评测 + A/B + 护栏）贯穿第二、三波。

---

## 关键不确定性（必须 PoC 验证）
1. **Suno Inspo 的"原创度 vs 还原度"可控性**——最高风险，决定 a 能否用 Suno。
2. **Suno v5 API 商用授权**——法务确认；不行降级 MiniMax。
3. **AI 合成音轨的分轨 SDR**——Perseus/htdemucs 在 music 输出上的实测质量未知。
4. **MiniMax cover 对业余哼唱（走音/带噪）的鲁棒性**。
5. **Claude 中文歌词结构标签遵循率**。
6. **模型原始 stems 对 API 的可用性**（Suno v5 stems 是否开放、MiniMax 是否提供）——决定 b 杠杆是否成立。
