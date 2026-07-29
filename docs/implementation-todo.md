# SongDraft V5 细粒度实施 Todo

> ⚠️ 本文件为 V5 设计蓝图，大部分已落地；上线前事实清单以 docs/todo.md 为准。

> 依据：`docs/SPEC.md`（当前最新版本）与 2026-07-29 新增需求  
> 适用范围：桌面 Web 完整流程、移动 H5 灵感记录与分享流程  
> 当前技术栈：Next.js App Router、React 19、TypeScript、Tailwind CSS 4、Drizzle/PostgreSQL、Supabase Auth、腾讯 COS  
> 执行原则：沿用当前 v0 的冷静、专业、高信息密度 UI；优先使用 shadcn/ui；复杂交互优先采用成熟第三方库；不为 Hackathon 过度设计。

## 0. 本轮不可变更的产品决定

- [ ] 首页 `/` 定义为“灵感记录”，不再直接渲染创作台。
- [ ] 创作台保持桌面端能力，路由为 `/create` 与 `/create/[projectId]`。
- [ ] 创作台由三栏改为左右两栏：左侧“素材构建”，右侧“创意简报 + 生成结果”。
- [ ] 删除中间 `ActionColumn` 及其所有视觉内容，不保留空白占位。
- [ ] “生成 Demo”主按钮固定在左侧素材面板底部，不随素材 Tab 切换。
- [ ] 顶部工具栏删除歌曲 Demo、配乐 Demo、旋律草图下拉框；供应商选择器继续保留。
- [ ] 输出类型移动到创意简报，使用必选且互斥的 Tag Radio Group。
- [ ] 创意简报倒数第二项为“额外生成要求”，默认空，仅编辑态可编辑。
- [ ] 创意简报最后一项为“生成数量”，可选 `1 / 3 / 5 / 10`。
- [ ] 右侧删除可见的“生成计划”；后端 `generation_plans` 可继续作为任务编排记录存在。
- [ ] 右侧新增“生成结果”折叠模块；生成成功后自动收起创意简报并展开生成结果。
- [ ] 每个右侧模块标题栏最右侧只能放折叠箭头；编辑、确认、批量保存等操作统一放到模块内容末尾。
- [ ] 新增“灵感库”，与“创作库”并存：灵感库展示灵感记录，创作库展示歌曲项目。
- [ ] 自动保存只在内容发生变化时创建版本；相同内容不得产生重复快照。

## 1. UI/UX 基线与组件策略

### 1.1 视觉基线

- [ ] 继续使用 `src/app/globals.css` 中的语义色：`background`、`foreground`、`card`、`muted`、`border`、`primary`、`brand`、`warning`、`success`、`destructive`。
- [ ] 页面背景使用白色或微冷白，卡片使用白底与 1px 冷灰边框。
- [ ] 主操作使用深蓝黑 `primary`；品牌强调、选中态和焦点使用低饱和蓝 `brand`。
- [ ] 常规卡片圆角控制在 8–12px；禁止渐变发光、玻璃拟态、霓虹与超大圆角营销卡片。
- [ ] 标准文字层级：页面标题 `18–20px/600`，模块标题 `14px/600`，正文 `14px/400`，字段标签 `11–12px/500`，辅助文字 `11–12px/400`。
- [ ] 内容间距只使用 Tailwind 标准尺度；字段内间距 `6–8px`，字段间距 `12–16px`，模块间距 `16px`，页面内边距桌面 `20–24px`、H5 `16px`。
- [ ] hover 仅改变背景、边框或轻微阴影，不使用位移明显的浮动动画。
- [ ] focus 必须有可见 `ring`，键盘操作不可只依赖颜色变化。
- [ ] 所有加载态保持原布局尺寸，使用 Skeleton，避免页面跳动。
- [ ] 所有真实/模拟 AI 输出继续展示清晰标签，禁止把 Mock 结果伪装成真实 Provider 输出。

### 1.2 shadcn/ui 初始化与优先组件

- [ ] 初始化 shadcn/ui 配置，保持现有 Tailwind 4 与 CSS Variables，不覆盖现有 SongDraft token。
- [ ] 导入 `Button`，替换页面中重复的主按钮、次按钮和危险按钮样式。
- [ ] 导入 `Tabs`，统一首页与创作台素材切换的 ARIA 和键盘行为。
- [ ] 导入 `Card`，作为灵感表单、Brief、生成结果和查询区的基础容器。
- [ ] 导入 `Collapsible`，实现创意简报和生成结果展开/收起。
- [ ] 导入 `RadioGroup`，将输出类型和生成数量渲染成 Tag 样式，同时保证必选单选。
- [ ] 导入 `Dialog`，用于新建项目、选择已有项目、删除确认和保存成功询问。
- [ ] 导入 `Sheet`，用于 H5 筛选器与桌面歌曲详情侧栏。
- [ ] 导入 `Popover` + `Command`，实现项目搜索选择器和多选筛选器。
- [ ] 导入 `DropdownMenu`，承载单条记录和单个结果的次级操作。
- [ ] 导入 `Form`、`Input`、`Textarea`、`Checkbox`、`Switch`、`Label`，统一表单校验与错误提示。
- [ ] 导入 `Badge`、`Separator`、`Alert`、`Skeleton`、`Tooltip`、`Pagination`。
- [ ] 导入 `Sonner`，统一保存成功、上传失败、生成失败等轻量反馈。
- [ ] 保留已有 `ModeTag` 等有产品语义的组件；底层外观改为组合 shadcn/ui，而不是继续复制 className。

### 1.3 第三方库边界

- [ ] 使用 `wavesurfer.js` 统一录音预览、Demo 播放波形和评论时间点定位。
- [ ] 使用浏览器原生 `MediaRecorder` 完成录音；`wavesurfer.js` 只负责波形与播放，不负责上传协议。
- [ ] 使用 `@tanstack/react-table` 构建桌面灵感库结果表格、排序和列定义；分页与筛选由服务端完成。
- [ ] 使用 `@xyflow/react` 构建版本树；节点数据仍由 SongDraft API 提供。
- [ ] 使用现有 `react-hook-form + zod` 管理 Brief 编辑、文本灵感表单和复杂查询表单。
- [ ] 不引入全局状态库；页面级状态使用 reducer/custom hooks，服务端数据由 Server Component 首次加载后局部刷新。
- [ ] 不引入大型上传组件库；上传行为继续复用现有 COS Intent API。

## 2. 信息架构与路由

- [ ] `/`：灵感记录首页，桌面与 H5 均完整支持。
- [ ] `/inspirations`：灵感库，桌面表格、H5 卡片。
- [ ] `/create`：制作台入口；无项目时展示选择/新建项目空状态。
- [ ] `/create/[projectId]`：具体项目制作台。
- [ ] `/works`：创作库，保持项目维度展示。
- [ ] `/works/[id]`：歌曲全屏详情。
- [ ] `/s/[token]`：受控分享页。
- [ ] 左侧导航第一组按顺序显示“灵感记录、制作台、灵感库、创作库”。
- [ ] 左侧导航第二组显示最近项目，最多 5 条，按最近访问时间倒序。
- [ ] 当前路由必须有明确 active 状态；图标、文字和背景三者保持统一。
- [ ] H5 不显示桌面固定侧栏，改为顶部品牌栏与底部主导航；完整制作台入口标注“建议在桌面端使用”。

## 3. 全局 Shell 组件

### 3.1 `AppSidebar`

- [ ] 从当前 `Sidebar` 提取为全局 `AppSidebar`，避免首页、创作台、灵感库各自维护导航。
- [ ] 顶部区域：SongDraft Logo、折叠按钮；折叠后只保留图标和 Tooltip。
- [ ] 主导航区域：四个导航项，统一高度 36px、左右内边距 10px、图标 16px。
- [ ] 最近项目区域：灰色 `11px` 分组标题、最多 5 条项目名、超长省略、hover 展示全名。
- [ ] 点击最近项目进入 `/create/[projectId]`，同时更新 `lastAccessedAt`。
- [ ] 底部区域：用户头像、昵称、设置入口和退出登录。
- [ ] 加载最近项目时显示 3 条单行 Skeleton；失败时只隐藏最近项目，不影响主导航。

### 3.2 `MobileAppHeader` 与 `MobileBottomNav`

- [ ] Header 左侧 Logo，中间当前页标题，右侧账户菜单。
- [ ] Bottom Nav 只保留“记录、灵感库、创作库、我的”。
- [ ] 处理 iOS safe-area：底部 padding 使用 `env(safe-area-inset-bottom)`。
- [ ] 录音时离开页面必须弹出确认，避免浏览器直接终止未保存录音。

## 4. 灵感记录首页 `/`

### 4.1 页面总体布局

- [ ] 新建 `InspirationCapturePage` Server Component，读取最近项目和未完成草稿摘要。
- [ ] 新建 `InspirationRecorder` Client Component，持有当前灵感记录的编辑状态。
- [ ] 桌面主内容宽度 `minmax(720px, 960px)`，水平居中，顶部留白 32px。
- [ ] 页面标题使用“记录此刻的灵感”，副标题使用“先留下它，之后再决定要把它发展成什么”。
- [ ] 标题下方放置三项顶部 Tabs，顺序固定为“录音/音频、图片、文本”。
- [ ] Tab 使用创作台素材构建区域相同的 Lucide 图标、选中样式和蓝色内容指示点。
- [ ] Tab Content 桌面最小高度 520px、H5 最小高度为可视区减去 Header/Bottom Nav。
- [ ] 切换 Tab 不卸载已有内容、不清空未保存输入、不打断已完成的音频播放。
- [ ] 录音进行中禁止切换 Tab；点击其他 Tab 时提示“请先结束或取消当前录音”。
- [ ] 内容区底部固定 `InspirationSaveBar`，滚动表单时保持可见。

### 4.2 录音/音频 Tab

#### `AudioCapturePanel`

- [ ] 顶部提示文字：“哼一段旋律、唱一句歌词，或上传刚录下的音频”。
- [ ] 主录音卡居中展示圆形录音按钮、录音时长、权限状态和简短说明。
- [ ] 未授权状态提供“允许麦克风”按钮；拒绝后展示浏览器设置引导，不反复请求权限。
- [ ] 录音开始后按钮切换为停止，显示红色状态点、`mm:ss` 时长和实时波形。
- [ ] 单段录音默认上限 10 分钟；接近上限时提示，达到上限自动停止。
- [ ] 停止后生成本地 Blob 预览，状态标记为“待上传”。
- [ ] 提供“试听、暂停、重录、删除、保存此录音”操作。
- [ ] 重录前弹出确认；已经上传的旧文件只做软删除，不直接清理 COS。
- [ ] 录音文件名采用 `灵感录音-YYYYMMDD-HHmmss.webm/m4a`，实际 MIME 以浏览器支持为准。
- [ ] 上传前验证 MIME、大小和时长；沿用音频最大 20MB 的后端限制并在前端预先提示。

#### `AudioUploadDropzone`

- [ ] 支持点击选择与桌面拖拽上传。
- [ ] 显示支持格式、20MB 限制和上传进度。
- [ ] 多文件按队列依次获取 Intent，最多同时上传 2 个，避免移动网络拥塞。
- [ ] 每个文件显示文件名、时长、大小、上传状态、重试和删除。
- [ ] 文件上传完成后才允许关联项目；上传中离开页面弹出确认。

#### `AudioNoteField`

- [ ] 每条录音/音频下方支持一段可选文字附件，不要求用户懂乐理。
- [ ] Label 使用“这段声音想表达什么？”，placeholder 示例：“副歌开头的旋律，情绪从压抑慢慢变得释然”。
- [ ] 提供可选快捷标签：“主歌想法、预副歌、副歌 Hook、节奏、和声、环境声音、其他”。
- [ ] 标签允许单选或不选；备注最多 1000 字并显示字数。
- [ ] 文本附件与对应音频 Asset ID 一起写入自动保存快照。

### 4.3 图片 Tab

#### `ImageCapturePanel`

- [ ] 顶部提示：“保存一个画面、色彩或场景，让它以后变成音乐的一部分”。
- [ ] 桌面显示上传 Dropzone；H5 同时显示“拍照”和“从相册选择”。
- [ ] 拍照 input 使用 `accept="image/*" capture="environment"`，但保留相册选择入口。
- [ ] 单次最多选择 9 张；单图最大 10MB；支持 JPEG、PNG、WebP、HEIC 时先检测浏览器预览能力。
- [ ] 图片进入上传队列后立即生成本地缩略图，上传完成后替换为受控预览 URL。
- [ ] 图片网格桌面 3 列、H5 2 列；缩略图比例 4:3，使用 `object-cover`。
- [ ] 每张图片 hover/focus 时显示“预览、设为封面、替换、删除”。
- [ ] 点击预览打开 shadcn `Dialog`；支持上一张/下一张与键盘方向键。
- [ ] 只能有一张封面；删除当前封面后自动选择第一张有效图片或清空。
- [ ] 图片集合下方提供“画面给你的感觉”可选备注，最多 1000 字。
- [ ] 提供快捷氛围标签：“温暖、冷冽、孤独、热烈、梦幻、克制、复古、未来”。

### 4.4 文本 Tab

#### `TextInspirationForm`

- [ ] 使用 `react-hook-form + zod`，输入变化进入统一自动保存队列。
- [ ] 第一项“暂定标题”：可选，最多 60 字；为空时自动从正文前 20 字生成摘要标题。
- [ ] 第二项“这是什么灵感”：Tag Radio，可选“歌词片段、歌曲概念、故事/画面、旋律文字备注、编曲想法、其他”。
- [ ] 第三项“大段记录”：主要 Textarea，最小高度 240px，最多 5000 字，自动增长到 480px 后内部滚动。
- [ ] placeholder 使用非乐理化引导：“写下一句歌词、一个故事、一种感觉，或描述脑海里那段旋律如何起伏”。
- [ ] 第四项“情绪”：多选 Tags，预设“开心、忧郁、平静、愤怒、浪漫、孤独、释然、紧张”，允许自定义最多 3 个。
- [ ] 第五项“速度感觉”：单选“慢、适中、快、不确定”，不要求用户填写 BPM。
- [ ] 第六项“声音/乐器线索”：可选文本，示例“木吉他、轻鼓、女声，或者像雨点一样的合成器”。
- [ ] 第七项“参考作品”：可选文本，明确提示仅用于风格沟通，不复制具体作品。
- [ ] 高级字段放入 `Collapsible`：“调性/BPM/和弦/段落结构”，默认收起，熟悉音乐的用户可填写。
- [ ] 切换灵感类型时不清空正文，只调整 placeholder 和建议字段。

### 4.5 自动保存与版本状态

#### `useInspirationAutosave`

- [ ] 用户首次输入有效文字、完成录音或选择图片时创建 `inspiration_record`，空白页不创建数据库记录。
- [ ] 文本输入停止 800ms 后触发自动保存；blur 时立即 flush。
- [ ] 文件上传完成、删除、替换、排序、封面变化时立即触发自动保存。
- [ ] 客户端为每次请求生成 idempotency key，避免网络重试重复创建版本。
- [ ] 服务端对规范化后的快照计算 SHA-256 `contentHash`；客户端 Hash 只用于 UI 优化，不能作为唯一可信来源。
- [ ] 规范化规则：对象 key 排序、字符串保留正文空格但统一换行符、Asset ID 排序按界面顺序固定、排除 `updatedAt` 等瞬时字段。
- [ ] 若新 Hash 等于当前最新版本 Hash，返回 `unchanged`，不新增版本号、不更新时间线。
- [ ] 数据库使用 `(record_id, content_hash)` 唯一索引兜底并发重复保存。
- [ ] 保存状态仅有：`未开始、保存中、已自动保存、保存失败、离线待同步`。
- [ ] 保存中显示 spinner 与“正在保存”；成功显示云朵勾选和保存时间；失败展示“重试”。
- [ ] 离线时保留最近一次待保存 JSON 到 IndexedDB；网络恢复后按最新状态补交一次，不回放所有按键级变化。
- [ ] 页面关闭前若存在未上传文件或失败快照，使用 `beforeunload` 提醒。

### 4.6 保存到项目

#### `InspirationSaveBar`

- [ ] 左侧显示自动保存状态与当前素材摘要，例如“2 段音频 · 1 条文字说明”。
- [ ] 主按钮“保存到项目”只有至少存在一个有效内容时可用。
- [ ] 次按钮“继续记录”仅在已经关联项目后出现，用于创建新的空白灵感记录。
- [ ] 点击主按钮打开 `ProjectDestinationDialog`。

#### `ProjectDestinationDialog`

- [ ] 提供两个互斥选项：“新建项目”和“保存到已有项目”。
- [ ] 新建项目默认标题取灵感标题；允许修改，必填，最多 80 字。
- [ ] 已有项目使用可搜索 Combobox，显示项目名、最近更新时间和状态。
- [ ] 保存时禁用关闭与重复提交；事务完成后显示成功状态。
- [ ] 新建项目事务：创建项目 → 关联灵感记录 → 批量更新相关 Assets 的 `projectId` → 更新最近项目。
- [ ] 已有项目事务：校验所有权 → 关联记录与 Assets → 更新项目 `updatedAt`。
- [ ] 关联成功后弹出“已保存到《项目名》，是否立即进入制作台？”；主按钮“进入制作台”，次按钮“留在这里”。
- [ ] 进入制作台跳转 `/create/[projectId]`；留下则清空当前编辑器并保留成功提示。

## 5. 灵感库 `/inspirations`

### 5.1 页面结构

- [ ] Header 左侧显示“灵感库”和记录总数，右侧主按钮“记录新灵感”。
- [ ] Header 下方放置经典表单式 `InspirationSearchForm`，不使用聊天式自然语言查询。
- [ ] 查询区下方显示当前生效条件 Chips，可单独移除某个条件。
- [ ] 结果区桌面使用 Table，H5 使用 Card List。
- [ ] 查询条件、页码和排序同步到 URL query，刷新与分享链接后可恢复。

### 5.2 `InspirationSearchForm`

- [ ] 第一行：关键词、所属项目、素材类型、关联状态。
- [ ] 关键词搜索标题、正文摘要、音频备注和图片备注；输入后不自动查询，点击“查询”统一提交。
- [ ] 所属项目使用可搜索多选 Combobox，支持“未关联项目”。
- [ ] 素材类型支持多选“录音/音频、图片、文本”。
- [ ] 关联状态单选“全部、未归档到项目、已归档到项目”。
- [ ] “更多条件”展开第二行：创建日期范围、最后更新日期范围、情绪标签、灵感类型、是否有附件、版本数范围。
- [ ] 日期范围使用 shadcn Calendar + Popover；提交时转为 ISO 日期边界。
- [ ] 查询按钮使用 primary；重置按钮恢复默认值并清空 URL；收起更多条件不清除已填值。
- [ ] 每个条件必须有 Label，不能只依赖 placeholder。
- [ ] 查询中保留旧结果并在表格上方显示细进度条，避免整页闪白。

### 5.3 `InspirationTable`

- [ ] 列固定为：选择、灵感、类型、所属项目、内容摘要、版本数、更新时间、操作。
- [ ] “灵感”列展示标题与小缩略图/音频图标；无标题时显示自动摘要。
- [ ] “类型”列使用低饱和 Badge；多模态记录可显示多个 Badge。
- [ ] “所属项目”可点击进入制作台；未关联显示“未归档”。
- [ ] “内容摘要”最多两行，音频优先展示备注，图片优先展示画面备注。
- [ ] 表头“更新时间”支持升降序；默认更新时间倒序。
- [ ] 行点击打开 `InspirationDetailSheet`，行内链接和菜单必须阻止冒泡。
- [ ] 行操作菜单：查看详情、保存到项目、复制为新灵感、删除。
- [ ] 批量选择后底部出现操作条：批量保存到项目、批量删除；不同所有者数据永远不会出现在同一列表。
- [ ] 空库状态显示“还没有灵感记录”与“记录第一条”；无查询结果显示“没有匹配结果”与“清除筛选”。
- [ ] 分页默认 20 条，可选 20/50；服务端返回总数和总页数。
- [ ] H5 卡片依次展示标题、类型、摘要、项目、时间；筛选器放入底部 Sheet。

### 5.4 `InspirationDetailSheet`

- [ ] 桌面从右侧滑出，宽度 480px；H5 全屏。
- [ ] 顶部显示标题、保存状态、所属项目和更多菜单。
- [ ] 内容按类型渲染统一预览：音频播放器、图片轮播、文本字段。
- [ ] “版本记录”以时间线展示，只显示真正发生变化的快照。
- [ ] 点击历史快照先预览差异，不立即覆盖当前记录。
- [ ] “恢复此版本”二次确认后创建一个新的恢复快照，不删除后续历史。
- [ ] 底部固定“保存到项目/打开制作台”主操作。

## 6. 创作台左右两栏改造

### 6.1 `SongDraftWorkspace` 布局

- [ ] 删除 `ActionColumn` import、渲染和相关布局宽度。
- [ ] 桌面内容区使用 `grid-cols-[360px_minmax(0,1fr)]`；屏宽 ≥1440px 时左栏可增至 400px。
- [ ] 左栏独立滚动，右栏独立滚动；TopToolbar 固定在两栏之上。
- [ ] 屏宽 <1024px 时不提供完整创作台编辑，显示桌面端引导与“只查看项目素材”降级页。
- [ ] TopToolbar 保留项目标题、保存状态、Provider、历史、分享和更多菜单。
- [ ] TopToolbar 删除 Output Type 下拉框及相关 `outputType` props/callback。
- [ ] `SongDraftWorkspace` 用 `useReducer` 管理 `draft / brief / generation / collapse / save` 状态，避免继续增加零散 `useState`。
- [ ] 页面状态至少区分：`empty`、`material_dirty`、`brief_generating`、`brief_review`、`brief_confirmed`、`demo_generating`、`results_ready`、`error`。

### 6.2 左侧 `MaterialPanel`

- [ ] 保留顶部“素材构建”标题和 3 个 Tab，文案统一为“文本、歌曲/音频、图片”。
- [ ] Tab 区和内容区继续使用当前 v0 视觉，不改为大块营销卡片。
- [ ] 每个 Tab 独立保留滚动位置；切换后字段、上传队列和分析结果不丢失。
- [ ] “纳入本次生成”Switch 保留；至少一个有效且启用的素材才允许生成 Brief。
- [ ] 内容区底部增加空间，避免最后一个字段被固定操作栏遮挡。

#### `WorkspacePrimaryAction`

- [ ] 固定在 MaterialPanel 底部，位于所有 Tab Content 外部；背景为 `card/95 + backdrop-blur`、顶部 1px border。
- [ ] 操作栏高度约 72px，左右 16px padding；按钮占满宽度。
- [ ] 无项目或无有效素材：按钮禁用，文案“请先添加素材”。
- [ ] 素材已变化且无 Brief：文案“生成创意简报”。
- [ ] Brief 生成中：文案“正在整理素材…”，显示 spinner，不允许切 Tab 修改关键字段。
- [ ] Brief 未确认：按钮禁用，文案“请先确认创意简报”。
- [ ] Brief 已确认：文案“生成 Demo”。
- [ ] Demo 生成中：文案“正在生成 3 个 Demo…”，显示数量与进度。
- [ ] 已有结果且素材/Brief 未变化：文案“再次生成 Demo”。
- [ ] 已有结果但素材已变化：先要求重新生成 Brief，不能用过期 Brief 直接生成。
- [ ] 按钮上方可显示一行错误或限制提示；不得用 Tooltip 承载唯一错误信息。

### 6.3 右侧 `OutcomePanel`

- [ ] 右侧始终包含两个独立模块：`CreativeBriefSection`、`GenerationResultsSection`。
- [ ] 空状态下 Brief 展示引导，结果模块展示“生成 Demo 后将在这里出现”。
- [ ] 两个模块之间间距 16px，页面 padding 20px。
- [ ] 模块统一使用 `OutcomeCollapsibleCard`，保证 Header、Chevron、动画和 ARIA 一致。

#### `OutcomeCollapsibleCard`

- [ ] Header 左侧为图标、标题和可选状态 Badge。
- [ ] Header 最右侧只显示 Chevron；展开时向下，收起时向右。
- [ ] 整个 Header 可点击，使用 button 语义并支持 Enter/Space。
- [ ] 展开/收起动画只作用于高度和透明度，时长 160–200ms。
- [ ] 收起状态显示一行摘要，例如“歌曲 Demo · 3 个候选 · 已确认”。
- [ ] 用户手动折叠状态在当前项目会话内保留；刷新后默认按业务状态计算。

### 6.4 `CreativeBriefSection`

- [ ] 生成 Brief 后默认展开；生成结果成功后自动收起。
- [ ] Header 右侧不再放“编辑/完成”，编辑操作移到内容末尾 Footer。
- [ ] 查看态字段顺序固定：主题、输出类型、风格、情绪、速度、演唱方式、乐器、歌词概要、旋律特征、视觉参考、证据来源、冲突与取舍、额外生成要求、生成数量。
- [ ] 输出类型使用 `OutputTypeRadioTags`，选项为“歌曲 Demo、配乐 Demo、旋律草图”。
- [ ] 输出类型值统一为 `song | soundtrack | melody_sketch`；清理当前 `melody` 等不一致别名。
- [ ] Radio Tags 必须始终有一个值；默认由 Brief 推断，无法推断时默认“歌曲 Demo”。
- [ ] 查看态 Output Type 显示选中 Tag；编辑态显示全部 Tags。
- [ ] “额外生成要求”默认空；查看态空值显示灰色“无额外要求”，编辑态使用 3 行 Textarea，最多 1000 字。
- [ ] 额外 Prompt 只作为本次生成补充条件，不覆盖原始素材 Prompt，也不写回歌词。
- [ ] “生成数量”放在最后，使用 Radio Tags `1 / 3 / 5 / 10`，默认 3。
- [ ] 修改任意 Brief 字段、输出类型、额外 Prompt 或数量后，将 Brief 状态设为未确认。
- [ ] 编辑态必须能编辑全部产品要求字段，不只编辑主题与优先策略。
- [ ] 数组字段（情绪、乐器）使用可新增/可删除 Tags；Enter 新增，Backspace 删除空输入前一项。
- [ ] Footer 查看态：左侧显示“最后确认时间”，右侧按钮“编辑 Brief”和主按钮“确认并用于生成”。
- [ ] Footer 编辑态：按钮“取消”和“保存修改”；取消恢复进入编辑前的完整快照。
- [ ] 保存修改只保存草稿，不等同于确认；用户仍需显式点击“确认并用于生成”。
- [ ] 确认成功后固定左侧生成按钮切换为可用“生成 Demo”。

### 6.5 `GenerationResultsSection`

- [ ] 始终渲染模块 Header；生成前内容为克制空状态。
- [ ] 任务开始后自动展开，展示与生成数量相同的 Skeleton 卡片，上限 5 个可见 Skeleton，10 个时显示“其余候选正在排队”。
- [ ] 使用轮询或 SSE 更新任务 `queued/analyzing/generating/completed/failed` 状态；页面刷新后可恢复未完成任务。
- [ ] 生成成功：展开结果、收起 Brief、焦点移动到结果标题并通过 `aria-live` 宣布完成数量。
- [ ] 部分成功：显示成功数量与失败数量，保留成功结果，失败项提供重试。
- [ ] 全部失败：结果模块保持展开，显示脱敏错误、重试按钮和 Provider 状态。

#### `GenerationCandidateCard`

- [ ] 卡片顶部为批量选择 Checkbox、封面、标题、输出类型 Badge、真实/模拟标签、时长。
- [ ] 中部使用统一 `SongDraftAudioPlayer`，提供播放、暂停、进度、当前时间/总时长和音量。
- [ ] 底部行内操作只保留“查看详情”和更多菜单；设为主版本、保存等批量操作放到模块 Footer。
- [ ] 更多菜单包括“从此结果重新生成、下载、删除未保存结果”。
- [ ] 点击卡片非交互区域打开歌曲详情 Sheet，不自动切换播放状态。
- [ ] 每张卡必须明确 `未保存 / 已保存为 vN / 保存失败` 状态。
- [ ] A/B 对比作为次级功能：最多选择 2 条进入对比模式，复用同一播放器控制器，播放一个时暂停另一个。

#### `GenerationResultsFooter`

- [ ] 位于全部结果之后，不悬浮遮挡内容。
- [ ] 左侧显示“已选择 N 条”；右侧提供“清空选择”和主按钮“保存为版本”。
- [ ] 未选择结果时主按钮禁用。
- [ ] 保存 1 条创建 1 个正式版本；批量选择 N 条创建 N 个同一父节点下的版本。
- [ ] 保存成功更新历史入口与卡片状态，但不重复调用音乐生成 API。
- [ ] 已经保存的 Candidate 再次选择时禁用或明确提示其版本号，避免重复版本。

### 6.6 删除与保留清单

- [ ] 删除 `src/components/inspire/action-column.tsx`，前提是所有引用与测试均完成迁移。
- [ ] 删除 TopToolbar 的输出类型 Dropdown、props、状态和测试。
- [ ] 删除 `brief-panel.tsx` 中可见 `PlanCard` 与“生成计划”文案。
- [ ] 保留 `generationPlans` 表与 `routeGeneration()`，改为后端内部可解释编排，不再直接展示。
- [ ] 保留 Provider 能力警告；移动到 Brief Footer 上方或固定主按钮上方。
- [ ] 保留真实/模拟标识、版本、分享、评论和 COS 存储能力。

## 7. 数据模型与迁移

### 7.1 新增 `inspiration_records`

- [ ] 字段：`id UUID PK`。
- [ ] 字段：`owner_id UUID NOT NULL FK profiles`。
- [ ] 字段：`project_id UUID NULL FK projects`，未归档时为空。
- [ ] 字段：`title TEXT NULL`。
- [ ] 字段：`primary_kind`，枚举 `audio | image | text`。
- [ ] 字段：`summary TEXT NULL`，供列表轻量查询，禁止每行解析大 JSON。
- [ ] 字段：`tags JSONB NOT NULL DEFAULT []`。
- [ ] 字段：`current_snapshot JSONB NOT NULL DEFAULT {}`。
- [ ] 字段：`current_content_hash TEXT NOT NULL`。
- [ ] 字段：`version_count INTEGER NOT NULL DEFAULT 1`。
- [ ] 字段：`deleted_at TIMESTAMPTZ NULL`。
- [ ] 字段：`created_at / updated_at`。
- [ ] 索引：`owner_id, updated_at DESC`。
- [ ] 索引：`owner_id, project_id, updated_at DESC`。
- [ ] 索引：`owner_id, primary_kind, updated_at DESC`。

### 7.2 新增 `inspiration_record_versions`

- [ ] 字段：`id UUID PK`、`record_id FK CASCADE`、`version_no INTEGER`。
- [ ] 字段：`snapshot JSONB NOT NULL`、`content_hash TEXT NOT NULL`。
- [ ] 字段：`reason TEXT`，取值约束为 `autosave | manual | restore | attach`。
- [ ] 字段：`created_by UUID FK profiles`、`created_at`。
- [ ] 唯一索引：`record_id, version_no`。
- [ ] 唯一索引：`record_id, content_hash`，保证相同内容只能有一个快照。
- [ ] 恢复旧版本时复制为新快照，`reason=restore`，不移动或删除历史记录。

### 7.3 调整 `inspiration_assets`

- [ ] 新增 `record_id UUID NULL FK inspiration_records ON DELETE SET NULL`。
- [ ] `project_id` 改为可空，支持素材先持久化、后归档项目。
- [ ] 增加数据库 CHECK：`record_id IS NOT NULL OR project_id IS NOT NULL`。
- [ ] 新增索引 `record_id, created_at`。
- [ ] 素材归档项目时只更新 FK，不复制 COS 对象，避免大文件重复与额外流量。
- [ ] Object Key 支持 `drafts/{recordId}` 与 `projects/{projectId}` 两种 scope；已经上传的 draft key 归档后保持不变。
- [ ] 所有下载与删除继续同时校验 `owner_id`，不能仅凭 record/project ID。

### 7.4 新增 `generation_candidates`

- [ ] 当前“生成即创建正式版本”不符合最新 SPEC，需要拆分候选和版本。
- [ ] 字段：`id UUID PK`、`job_id FK`、`project_id FK`、`brief_id FK`。
- [ ] 字段：`title`、`object_key/audio_url`、`duration_ms`、`execution_kind`、`metadata JSONB`。
- [ ] 字段：`saved_version_id UUID NULL FK demo_versions`、`deleted_at`、`created_at`。
- [ ] 生成完成只创建 Candidate；点击“保存为版本”后才创建 `demo_versions + demo_assets` 并回填 `saved_version_id`。
- [ ] Candidate 临时 URL 必须异步转存 COS；转存前 UI 可播放 Provider URL，过期后不可作为正式版本资源。

### 7.5 Brief Payload 类型化

- [ ] 新建共享 `CreativeBriefSchema`，字段覆盖主题、歌词、情绪、风格、演唱方式、参考说明、输出类型、额外 Prompt、数量。
- [ ] `outputType` 枚举统一为 `song | soundtrack | melody_sketch`。
- [ ] `quantity` 限定为 `1 | 3 | 5 | 10`。
- [ ] `extraPrompt` 默认空字符串，最大 1000 字。
- [ ] Brief 每次保存增加 revision；确认写入 `confirmedAt`。
- [ ] Brief 编辑后清空当前 revision 的 `confirmedAt` 或创建新 revision，确保生成只读取已确认内容。

## 8. API 与服务层 Todo

### 8.1 灵感记录 API

- [ ] `POST /api/inspirations`：首次有效输入创建记录，返回 record ID 与初始版本。
- [ ] `GET /api/inspirations`：支持分页、排序和完整筛选；只返回当前用户记录。
- [ ] `GET /api/inspirations/[id]`：返回详情、Assets 与最近版本摘要。
- [ ] `PATCH /api/inspirations/[id]`：更新标题或非版本化元信息。
- [ ] `DELETE /api/inspirations/[id]`：软删除记录；已关联项目的素材不立即删除。
- [ ] `POST /api/inspirations/[id]/autosave`：接收 snapshot + idempotency key，服务端 Hash 去重。
- [ ] `GET /api/inspirations/[id]/versions`：分页读取真实快照历史。
- [ ] `POST /api/inspirations/[id]/versions/[versionId]/restore`：恢复为新快照。
- [ ] `POST /api/inspirations/[id]/attach`：事务关联新建或已有项目。
- [ ] 所有输入使用 Zod，统一 `ApiEnvelope`，错误码区分 `VALIDATION_ERROR / CONFLICT / NOT_FOUND / FORBIDDEN / UPLOAD_PENDING`。

### 8.2 上传 API 扩展

- [ ] `POST /api/uploads/intents` 接受 `scopeType=record|project` 与 `scopeId`。
- [ ] 校验 record/project 所有权后再签发 COS URL。
- [ ] complete 时验证实际 MIME、大小和对象存在性，沿用当前安全检查。
- [ ] 录音 Blob 的 MIME 不能信任扩展名；服务端白名单按 MIME 判定并生成安全扩展名。
- [ ] 为 H5 弱网支持可重试 Intent；同一 Asset 重试不得创建多条数据库记录。

### 8.3 Brief API

- [ ] `POST /api/projects/[id]/brief`：读取所有 ready 且 included 的素材，生成并保存 Brief 草稿。
- [ ] `PATCH /api/projects/[id]/brief/[briefId]`：保存用户编辑，创建 revision 或更新未确认 revision。
- [ ] `POST /api/projects/[id]/brief/[briefId]/confirm`：校验必填 Output Type 与数量，写入确认时间。
- [ ] 返回 Provider 能力限制，但不返回或展示内部 Generation Plan 全量步骤。
- [ ] 素材在 Brief 生成后发生变化时，旧 Brief 标记为 stale，前端必须重新生成或明确重新确认。

### 8.4 生成 API

- [ ] `POST /api/generation-jobs` 只接收 `projectId + confirmedBriefId + idempotencyKey`。
- [ ] 服务端从已确认 Brief 读取 output type、extra prompt、quantity，不能信任客户端重复字段。
- [ ] 服务端校验项目所有权、Brief 归属和 stale 状态。
- [ ] `GenerationService` 按 quantity 请求 1/3/5/10 个结果；Provider 不支持批量时受控并发，最多 2。
- [ ] `GET /api/generation-jobs/[id]` 返回进度、成功 Candidate、失败项和脱敏错误。
- [ ] `POST /api/generation-candidates/save` 接收 Candidate IDs，事务创建正式版本。
- [ ] 保存版本快照必须包含原始素材 IDs、素材 Hash、Brief revision、extra prompt、output type、quantity、Provider 与 Prompt version。
- [ ] Candidate IDs 全部校验同一用户与同一项目，防止越权批量保存。

### 8.5 灵感库查询服务

- [ ] 新建 `InspirationRepository.listPage(ownerId, filters)`，Route 不直接拼 Drizzle 查询。
- [ ] 支持 `query, projectIds, kinds, attached, createdFrom, createdTo, updatedFrom, updatedTo, tags, inspirationType, hasAttachments, minVersions, maxVersions, sort, page, pageSize`。
- [ ] 查询只 select 列表需要字段，不加载完整 snapshot 和所有 Assets。
- [ ] 项目名通过一次 JOIN/批量查询返回，禁止每行查一次项目。
- [ ] 关键词先使用参数化 `ILIKE`；数据量增长后再评估 pg_trgm，不在 Hackathon 阶段引入全文搜索系统。
- [ ] 所有分页参数设上限，`pageSize <= 50`。

## 9. 前端目录与组件拆分建议

```text
src/components/
├── app-shell/
│   ├── app-sidebar.tsx
│   ├── mobile-app-header.tsx
│   └── mobile-bottom-nav.tsx
├── inspiration/
│   ├── recorder.tsx
│   ├── recorder-tabs.tsx
│   ├── audio-capture-panel.tsx
│   ├── audio-recorder.tsx
│   ├── audio-upload-dropzone.tsx
│   ├── audio-note-field.tsx
│   ├── image-capture-panel.tsx
│   ├── image-preview-grid.tsx
│   ├── text-inspiration-form.tsx
│   ├── inspiration-save-bar.tsx
│   ├── project-destination-dialog.tsx
│   ├── autosave-status.tsx
│   ├── inspiration-search-form.tsx
│   ├── inspiration-table.tsx
│   └── inspiration-detail-sheet.tsx
├── workspace/
│   ├── workspace.tsx
│   ├── material-panel.tsx
│   ├── workspace-primary-action.tsx
│   ├── outcome-panel.tsx
│   ├── outcome-collapsible-card.tsx
│   ├── creative-brief-section.tsx
│   ├── creative-brief-form.tsx
│   ├── output-type-radio-tags.tsx
│   ├── generation-results-section.tsx
│   ├── generation-candidate-card.tsx
│   └── generation-results-footer.tsx
└── audio/
    ├── songdraft-audio-player.tsx
    └── waveform.tsx
```

- [ ] 页面组件只负责数据装配，不把数据库 DTO 直接散落到展示组件。
- [ ] 表单组件接收领域类型与回调；API 调用集中在 page controller/custom hook。
- [ ] 公共视觉组件放 `components/ui`，产品领域组件放对应业务目录。
- [ ] 组件 props 不传整页状态对象；按功能传最小字段，避免任意子组件修改全部 workspace state。
- [ ] 删除旧组件前先迁移测试，避免同时保留两套创作台造成行为漂移。

## 10. 状态、错误与可访问性

- [ ] 所有上传项都有 `idle/uploading/ready/failed/deleted` 可视状态。
- [ ] 所有自动保存请求使用最后写入胜出策略，但服务端 revision/hash 防止旧请求覆盖新内容。
- [ ] 生成、保存版本和归档项目使用幂等键，按钮禁用只是 UI 防护，不替代服务端幂等。
- [ ] Dialog 打开后锁定焦点，关闭后焦点返回触发按钮。
- [ ] Tabs、Radio Tags、Collapsible、Menu 全部支持键盘与正确 ARIA。
- [ ] 图标按钮必须有 `aria-label` 与 Tooltip。
- [ ] 文字与背景达到 WCAG AA；状态不能只通过红/绿颜色表达。
- [ ] `prefers-reduced-motion` 下关闭折叠高度动画与波形装饰动画。
- [ ] Provider 错误只显示可理解的用户文案；trace ID 可复制但不暴露密钥和原始上游响应。
- [ ] H5 麦克风不可用、相机不可用、COS 上传超时分别提供明确恢复动作。

## 11. 测试 Todo

### 11.1 单元测试

- [ ] 快照规范化与 SHA-256：字段顺序不同但内容相同应得到相同 Hash。
- [ ] 自动保存去重：相同 Hash 不增加版本，内容变化增加一次。
- [ ] 并发自动保存：同一 Hash 两次请求最终只保留一条版本。
- [ ] Output Type Radio 永远保持一项选中，不能点击已选项清空。
- [ ] Brief 任意编辑都会撤销确认状态。
- [ ] 生成成功触发 `briefCollapsed=true`、`resultsCollapsed=false`。
- [ ] 生成按钮状态机覆盖空素材、Brief 生成、未确认、已确认、生成中、结果完成和失败。
- [ ] 查询参数 Schema 覆盖非法日期、超大 pageSize、非法排序字段。
- [ ] Candidate 保存校验跨项目和非本人 Candidate。

### 11.2 组件测试

- [ ] 首页默认选中录音/音频 Tab。
- [ ] Tab 切换后文本和上传列表不丢失。
- [ ] 录音权限拒绝时显示恢复说明。
- [ ] 上传失败项可重试并保持备注。
- [ ] Text Form 高级字段默认折叠。
- [ ] 自动保存状态从 saving 正确进入 saved/failed。
- [ ] Brief Header 最右只存在 Chevron；Footer 包含编辑/确认操作。
- [ ] 结果为空、生成中、部分成功、全部成功、失败五种 UI。
- [ ] 灵感库 Reset 清除表单和 URL 条件。
- [ ] H5 灵感卡与筛选 Sheet 可键盘/触屏操作。

### 11.3 API/集成测试

- [ ] 未登录访问灵感 API 返回 401。
- [ ] 用户 A 不可读取、修改、归档或删除用户 B 的灵感。
- [ ] 素材上传完成前不能归档项目或生成 Brief。
- [ ] 新建项目并归档灵感在同一事务完成；中途失败不产生半关联数据。
- [ ] 生成 API 拒绝未确认或 stale Brief。
- [ ] quantity=10 时 Provider 受控并发且最终状态可恢复。
- [ ] 保存 Candidate 后创建正式版本并回填 Candidate，重复请求不重复创建。
- [ ] 灵感库多条件组合查询的 total、分页和排序正确。

### 11.4 Playwright E2E

- [ ] 桌面：文本灵感 → 自动保存 → 新建项目 → 进入制作台。
- [ ] 桌面：上传图片 → 预览 → 设封面 → 保存到已有项目。
- [ ] Chromium：录音权限 Mock → 录音 → 停止 → 上传 → 添加备注。
- [ ] 制作台：修改素材 → 生成 Brief → 选择输出类型 → 添加额外 Prompt → 选数量 3 → 确认 → 生成。
- [ ] 生成完成后断言 Brief 自动折叠、结果自动展开、数量为 3。
- [ ] 选择两个 Candidate → 保存版本 → 历史入口显示两个新节点。
- [ ] 灵感库：组合筛选、清空条件、打开详情、恢复历史快照。
- [ ] H5：文本记录、拍照 input 存在、保存项目、分享页播放与评论。

## 12. 24 小时执行顺序与检查点

### Phase A：基础组件与数据闭环（0–5h）

- [ ] 0–1h：安装/配置 shadcn/ui 与必要第三方库，建立公共 Card、Tabs、Collapsible、Radio Tags。
- [ ] 1–3h：新增灵感记录、快照、候选表与 Drizzle migration；完成 Hash 去重 Service 测试。
- [ ] 3–5h：扩展上传 scope、灵感自动保存 API、项目关联事务。
- [ ] 检查点：文本记录可自动保存，重复内容不新增版本；上传素材可在无项目状态持久化。

### Phase B：首页灵感记录（5–10h）

- [ ] 5–7h：完成页面 Shell、三 Tabs、文本表单和固定保存栏。
- [ ] 7–9h：完成录音/音频上传、文字附件和图片上传/拍照/预览。
- [ ] 9–10h：完成选择项目、新建项目、保存成功询问与 H5 适配。
- [ ] 检查点：音频、图片、文本三条路径都能保存并进入制作台。

### Phase C：创作台重构（10–15h）

- [ ] 10–11h：删除中栏与顶部输出下拉，完成左右两栏和固定主按钮。
- [ ] 11–13h：完成 Brief Collapsible、完整编辑、输出类型 Tags、额外 Prompt、数量、确认状态。
- [ ] 13–15h：完成结果 Collapsible、生成状态、自动折叠、Candidate 选择和保存 Footer。
- [ ] 检查点：生成计划不再可见；Brief 确认和生成状态机完整；生成结果不自动进入正式版本历史。

### Phase D：灵感库（15–19h）

- [ ] 15–16h：完成服务端筛选、分页、索引与 URL Query Schema。
- [ ] 16–18h：完成查询表单、桌面 Table、H5 Cards、空状态。
- [ ] 18–19h：完成详情 Sheet、版本时间线、恢复和归档项目。
- [ ] 检查点：可按项目、类型、时间、关键词和关联状态组合查询。

### Phase E：验证与演示收口（19–24h）

- [ ] 19–21h：补齐 Service/Component 测试，修复 lint/typecheck。
- [ ] 21–22.5h：完成三条核心 E2E：灵感记录、创作生成、灵感库查询。
- [ ] 22.5–23.5h：桌面/H5 手工走查、权限/失败/弱网状态走查。
- [ ] 23.5–24h：构建验证、演示数据、README 与开发状态更新。
- [ ] 最终检查：`pnpm test`、`pnpm lint`、`pnpm typecheck`、`pnpm build` 依次通过。

## 13. 24 小时内的取舍边界

- [ ] P0 必做：三类灵感记录、自动保存去重、保存项目、创作台两栏、Brief 新字段与确认、结果模块、灵感库组合查询。
- [ ] P0 必做：真实/模拟标识、权限校验、COS 上传、生成失败反馈、桌面/H5 灵感记录适配。
- [ ] P1 可延后：IndexedDB 离线补交、图片 HEIC 转码、A/B 高级同步播放、灵感历史文本 Diff。
- [ ] P1 可延后：版本树自动布局精调、批量跨记录归档、保存的查询条件。
- [ ] 不做：自研波形库、自研表格库、自研流程图引擎、移动端完整制作台、全文搜索集群。

## 14. Definition of Done

- [ ] 每个新增组件有明确 loading、empty、error、disabled、success 状态。
- [ ] 页面在 1440px 桌面、1024px 小桌面、390px H5 三个视口完成走查。
- [ ] 首页三类灵感均能先持久化、再关联项目；上传未完成时不能进入生成链路。
- [ ] 自动保存连续输入不会制造冗余版本，相同快照由服务与数据库双重去重。
- [ ] 创作台没有中间栏、没有输出类型下拉、没有可见生成计划。
- [ ] Output Type 必选单选，额外 Prompt 默认空，生成数量位于 Brief 最后一项。
- [ ] Brief 与生成结果均可折叠；生成成功自动收起 Brief 并展开结果。
- [ ] 操作按钮位于模块末尾，Header 最右侧为折叠箭头。
- [ ] 灵感库支持按项目与复杂条件组合查询，分页和排序在服务端执行。
- [ ] shadcn/ui 被作为基础组件来源，领域组件保持 SongDraft 视觉与业务语义。
- [ ] 版本树、波形和复杂表格使用选定第三方库，不重复造轮子。
- [ ] 所有 API 绑定当前用户，批量操作逐项校验所有权。
- [ ] `.env*`、API Key、`.DS_Store`、v0 原始稿、音频缓存和测试产物未进入 Git。

