# SongDraft 交付状态审计

> 审计日期：2026-07-29。此文件以当前代码与自动化验证为依据；“透明 Mock”不等同于外部 AI 服务已调用。

## 1. 用户要求与证据

| 交付项 | 状态 | 当前证据 |
|---|---|---|
| 完整前后端架构 | 已完成 | Next.js App Router、模块化 `modules/`、Drizzle Schema/Migration、认证/存储/生成/分享服务层 |
| 产品、需求与技术文档 | 已完成 | `SPEC.md`、`requirements.md`、`technical-design.md`、`future-work.md` |
| 响应式 Web/H5 交互 | 已完成主路径 | Desktop Sidebar、移动底部导航、首页、工作台、作品库、设置 Profile、公开分享 H5 |
| 多模态灵感输入 | 已完成 | 文字/歌词、浏览器录音、音频、图片、视频 Upload Intent 与预览 |
| Demo 生成 | 已完成透明 Mock | Capability Router、Plan、Job、候选、Version；无配置时明确无真实音频 |
| 私密分享协作 | 已完成 | Hash Token、二维码、有效期、撤回、公开 H5、评论、创作者回流 |
| 后续 API/部署教程 | 已完成 | `future-work.md` 的 COS/DeepSeek/Music/Supabase/Vercel 章节 |

## 2. 核心闭环状态

```text
文字 / 录音 / 图片视频
        ↓
项目 + 私有素材上传 + 透明分析
        ↓
可编辑 Creative Brief + Capability Router + 确认 Plan
        ↓
Mock Job → 两个候选 → Version / 主版本
        ↓
Token / QR 分享 → 公开 H5 → 时间点评论
        ↓
工作台反馈回流、已读、软删除、导出创作包
```

## 3. 透明降级边界

以下功能已具备接口、数据模型和 UI，但因未提供云端密钥而以透明 Mock 运行：

- Supabase：`AUTH_MODE=mock` 时提供开发演示用户；真实邮箱密码登录代码已存在。
- PostgreSQL：未配置 `DATABASE_URL` 时项目、版本、分享、评论保存在进程内存，重启后丢失。
- COS：`STORAGE_DRIVER=mock` 时写入系统临时目录；生产可切至腾讯云 COS 预签名直传。
- Analyzer：返回明确标注的 simulated 结果，不声称真实 BPM、音域或视觉识别。
- 音乐 Provider：生成计划、Job、版本完整运行。未配置 Provider 时，页面可播放明确标注的浏览器本地合成样例；它不写入存储，也不声称调用 Mureka、MiniMax 或其他服务。

## 4. 自动化验收证据

截至本审计，以下命令已在当前 workspace 成功执行：

```bash
pnpm test       # 26/26
pnpm lint
pnpm build
pnpm typecheck
```

单元测试覆盖：C1–C7 组合、项目创建、上传归属/校验/完成、私有读取和软删除、Mock 分析、Capability Router、生成版本主版本、分享/有效期/撤回、评论回流/已读/软删除、作品筛选、导出文件名安全。

## 5. 上线前强制项

这些不是代码缺失的模糊描述，而是需要真实外部授权或真实设备验证的上线门槛：

1. 提供 Supabase、PostgreSQL、腾讯云 COS、DeepSeek 与音乐 Provider 的生产凭据；配置步骤见 `future-work.md`。
2. 为 Mock 或真实 Provider 准备至少六条明确授权的可播放 Demo 音频，完成移动端播放测试。
3. 真机验证麦克风权限、录音、微信打开二维码分享页、COS CORS 和断网重试。
4. 在独立 Preview 环境运行迁移，验证重启后的项目/版本/分享/评论持久化。
5. 使用 Node.js 22 在 Vercel 进行生产构建；当前开发 Node 20 会触发 Supabase 弃用提示。

## 6. 不应做的操作

- 不得将 `.env.local`、COS Secret、数据库 URL、Provider Key、JWT、Share Token 或未授权音频提交到 Git。
- 不得删除或改写已发布的 Drizzle Migration；新 Schema 变更必须创建新的迁移。
- 不得把 `simulated` 结果改成“已由某模型生成”的文案。
