/**
 * 帮助文档结构化内容（应用内 VitePress 式正文数据源）。
 */
export type HelpNavItem = {
  id: string
  title: string
  children?: { id: string; title: string }[]
}

export type CopyBlock = {
  label: string
  value: string
}

export const HELP_NAV: HelpNavItem[] = [
  {
    id: 'start',
    title: '开始',
    children: [
      { id: 'intro', title: '产品简介' },
      { id: 'concepts', title: '核心概念' },
    ],
  },
  {
    id: 'guide',
    title: '快速上手',
    children: [
      { id: 'flow-inspire', title: '记录灵感并归档' },
      { id: 'flow-studio', title: '制作台出 Demo' },
      { id: 'flow-library', title: '歌曲库与版本' },
    ],
  },
  {
    id: 'demo',
    title: '完整示例',
    children: [
      { id: 'demo-goal', title: '不眠之夜 · 目标' },
      { id: 'demo-lyrics', title: '歌词' },
      { id: 'demo-brief', title: '主题与编曲设定' },
      { id: 'demo-prompt', title: 'Prompt 与演唱' },
      { id: 'demo-steps', title: '建议操作路径' },
    ],
  },
  {
    id: 'ref',
    title: '参考',
    children: [
      { id: 'sitemap', title: '页面地图' },
      { id: 'faq', title: '常见问题' },
    ],
  },
]

/**
 * 「不眠之夜」可复制素材：奋斗主题、激情向。
 * 用于制作台联调：歌词 → 简报 → Demo。
 */
export const SLEEPLESS_NIGHT = {
  title: '不眠之夜',
  creativePrompt:
    '奋斗者的不眠之夜。节奏要有推进感，副歌爆发、朗朗上口；情绪从咬牙坚持到燃起，不要苦情、不要软萌情歌。中文口语，押韵干脆，适合大声唱。',
  instruction:
    '强化副歌钩子与动力感；短句、强拍落字；主歌蓄力、副歌释放；可保留呼喊式重复句。',
  lyrics: `[主歌 1]
键盘还亮着 窗外没天亮
咖啡见底了 信念还在烫
别人睡得香 我还在上场
一步不肯让 夜色当奖章

[预副歌]
心跳打着拍 脚步更响亮
失败算什么 再来又怎样
把汗水拧干 把怀疑埋葬
黎明前最黑 我先把路闯

[副歌]
不眠之夜 我还在燃烧
把每一次跌倒 踩成更高的桥
不眠之夜 梦想在咆哮
今夜不睡觉 也要把山峰敲

[主歌 2]
日历翻过页 目标不退让
朋友问够了吗 我说再一仗
镜子里的人 眼神更明亮
不是不怕累 是不想投降

[桥段]
累就对了 说明还在拼命
痛就对了 说明还在前进
若世界沉默 我就唱得更狠
用一整夜证明 我不认命

[副歌]
不眠之夜 我还在燃烧
把每一次跌倒 踩成更高的桥
不眠之夜 梦想在咆哮
今夜不睡觉 也要把山峰敲

[结尾副歌]
不眠之夜 —— 燃起来！
不眠之夜 —— 冲起来！
把明天喊醒 从这一秒开始嗨`,
  theme: '奋斗者的深夜冲刺：不眠不是失眠，是主动燃烧',
  moods: ['激昂', '坚定', '热血', '不服输'],
  genre: '流行摇滚 / 励志动力流行（anthem）',
  tempo: '118–128 BPM，4/4，中快板，强劲律动',
  instruments: [
    '失真电吉他节奏型',
    '驱动贝斯',
    '底鼓+军鼓四拍推进',
    '合成器升调垫底',
    '副歌叠加人声合唱',
  ],
  lyricSummary:
    '主歌写深夜还在战斗的画面，预副歌蓄力，副歌直给「燃烧/不睡/敲山峰」；桥段把累与痛写成前进证据，结尾口号式再爆发。',
  melodyFeatures:
    '主歌偏中音区叙述；预副歌级进上行；副歌大跳开口音、强拍落重字，便于合唱呐喊；结尾短促呼喊句可叠唱。',
  visualReferences:
    '凌晨写字楼灯火、跑步机夜跑、黑板目标清单被划掉、雨夜街头大步向前的剪影。',
  singingTips: `演唱提示（激情向）：
- 主歌：语气坚定、咬字利落，像咬着牙说话；气要足，不要软绵。
- 预副歌：音量与张力抬升，句尾顶住，为副歌蓄势。
- 副歌：胸腔打开，大声唱；「不眠之夜」四个字砸在强拍，可带一点喊唱感但保持音准。
- 桥段：先压一点再爆发，最后一句「我不认命」全力推出。
- 结尾呼喊句可更短、更狠，留气口给合唱层。
- 整体：节奏感优先于细腻颤音；允许沙哑与力量感，拒绝气声情歌处理。`,
  extraPrompt:
    '生成完整可唱 Demo：鼓点清晰有踢感，副歌能量明显高于主歌；人声有力量、中文咬字干脆；可加一层副歌合唱；结尾渐强后短收或 crowd 式尾音。不要慢板情歌编曲。',
  outputType: 'song' as const,
  quantity: 3,
}

export function sleeplessCopyBlocks(): CopyBlock[] {
  const d = SLEEPLESS_NIGHT
  return [
    { label: '项目名称', value: d.title },
    { label: '创作提示', value: d.creativePrompt },
    { label: '处理指令', value: d.instruction },
    { label: '原始歌词', value: d.lyrics },
    { label: '主题', value: d.theme },
    { label: '情绪标签', value: d.moods.join('、') },
    { label: '风格', value: d.genre },
    { label: '速度', value: d.tempo },
    { label: '乐器', value: d.instruments.join('、') },
    { label: '歌词概要', value: d.lyricSummary },
    { label: '旋律特征', value: d.melodyFeatures },
    { label: '视觉参考', value: d.visualReferences },
    { label: '演唱技巧', value: d.singingTips },
    { label: '额外生成要求', value: d.extraPrompt },
  ]
}
