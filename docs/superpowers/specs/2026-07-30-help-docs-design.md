# 帮助与文档页设计（应用内 VitePress 式）

> 状态：设计草案（部分未落地）。provider 现状为 MiniMax/DeepSeek；Suno/Claude/分轨为未来探索方向，非当前实现。

> 日期：2026-07-30 · 路由：`/help` · 方案 A（已确认）

## 目标

在产品内提供 VitePress 风格的帮助页：左侧二级目录 + 右侧正文，介绍 SongDraft、给出教程，并提供「不眠之夜」完整 Demo 生成示例供复制测试。

## 布局

- 外层复用 `Sidebar`（与其它 app 页一致）。
- 主区：`docs-nav (≈220px) | article`；窄屏目录改为顶部 `<select>` / 折叠列表。
- 正文：克制排版（标题层级、列表、代码块、复制按钮），符合 `docs/UI-design.md`。

## 信息架构

1. 开始：简介、核心概念  
2. 快速上手：灵感 → 项目 → 制作台 → 简报 → Demo → 创作库  
3. 完整示例「不眠之夜」：歌词 / 主题情绪 / 节奏乐器 / Prompt / 演唱技巧 / 操作路径  
4. 参考：页面地图、FAQ  

## 实现

- `src/app/(app)/help/page.tsx` + `src/components/help/help-docs-client.tsx`
- 内容以 TS 模块结构化（章节 / 块 / 可复制字段），不引入 VitePress 构建
- 侧栏「帮助与文档」→ `/help`

## 非目标

独立静态文档站、全文搜索、多语言、版本化文档。
