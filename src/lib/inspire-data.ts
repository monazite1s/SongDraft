export type InputKind = 'text' | 'audio' | 'image' | 'video'

export type OutputType = 'song' | 'soundtrack' | 'melody'

export const OUTPUT_TYPES: { id: OutputType; label: string; hint: string }[] = [
  { id: 'song', label: '歌曲 Demo', hint: '含人声与结构的完整小样' },
  { id: 'soundtrack', label: '配乐 Demo', hint: '氛围化的器乐配乐草稿' },
  { id: 'melody', label: '旋律草图', hint: '仅主旋律与和声走向' },
]

export type RunMode = 'real' | 'simulated'

export interface Provider {
  id: string
  name: string
  vendor: string
  supports: InputKind[]
  outputs: OutputType[]
  mode: RunMode
  status: 'ready' | 'limited' | 'offline'
  note: string
  latency: string
}

export const PROVIDERS: Provider[] = [
  {
    id: 'minimax',
    name: 'MiniMax Music 2.6',
    vendor: 'MiniMax',
    supports: ['text', 'audio'],
    outputs: ['song'],
    mode: 'real',
    status: 'ready',
    note: '当前真实歌曲生成通道；图片输入不会发送给音乐模型。',
    latency: '通常约 40–180s / 首条',
  },
  {
    id: 'aurora',
    name: 'Aurora Compose v2',
    vendor: 'Aurora Audio',
    supports: ['text', 'audio', 'image'],
    outputs: ['song', 'soundtrack', 'melody'],
    mode: 'real',
    status: 'ready',
    note: '支持歌词、哼唱与图像输入，视频需先抽帧。',
    latency: '约 40–70s / 候选',
  },
  {
    id: 'cadence',
    name: 'Cadence Sketch',
    vendor: 'Cadence Labs',
    supports: ['text', 'audio'],
    outputs: ['melody', 'song'],
    mode: 'real',
    status: 'ready',
    note: '擅长旋律草图与人声小样，暂不支持图像/视频。',
    latency: '约 25–45s / 候选',
  },
  {
    id: 'atlas',
    name: 'Atlas Score (模拟)',
    vendor: '内部占位',
    supports: ['text', 'audio', 'image', 'video'],
    outputs: ['soundtrack', 'song', 'melody'],
    mode: 'simulated',
    status: 'limited',
    note: '当前为本地模拟输出，用于流程演示，结果不代表真实生成质量。',
    latency: '即时（模拟）',
  },
]

export interface CreativeBrief {
  theme: string
  mood: string[]
  genre: string
  tempo: string
  instruments: string[]
  lyricSummary: string
  melodyFeatures: string
  visualReferences: string
  evidence: { source: string; detail: string }[]
  conflicts: string[]
  priority: string
}

export const DEFAULT_BRIEF: CreativeBrief = {
  theme: '深夜城市里的独处与释然',
  mood: ['忧郁', '克制', '温暖尾声'],
  genre: 'Indie Pop / Dream Pop',
  tempo: '84 BPM · 4/4',
  instruments: ['电钢琴', '合成 Pad', '轻拨弦', '低频贝斯', '细碎打击乐'],
  lyricSummary:
    '以第一人称叙述雨夜独自走过街道的片段，副歌收束到「与自己和解」的情绪。',
  melodyFeatures:
    '主歌音域较窄、以级进为主；副歌出现一次八度跳进，句尾有明显重复动机。',
  visualReferences: '湿润路面反光、暖色店招、冷色调夜景，画面安静克制。',
  evidence: [
    { source: '歌词', detail: '「路灯把影子拉得很长」→ 夜晚、独处意象' },
    { source: '哼唱', detail: '副歌八度跳进 → 情绪抬升点' },
    { source: '图像', detail: '主色冷调 + 暖点光源 → Dream Pop 质感' },
  ],
  conflicts: [
    '歌词偏民谣叙事，但哼唱律动更接近流行，需要在编曲上折中。',
  ],
  priority: '优先保留哼唱的副歌动机，其次匹配图像的冷暖对比配色。',
}

export interface PlanStep {
  label: string
  detail: string
  mode: RunMode
  inputs: InputKind[]
}

export const DEFAULT_PLAN: PlanStep[] = [
  {
    label: '素材解析',
    detail: '解析歌词语义、哼唱旋律轮廓与图像情绪标签',
    mode: 'real',
    inputs: ['text', 'audio', 'image'],
  },
  {
    label: '创意简报合成',
    detail: '融合各模态证据，生成主题 / 情绪 / 风格结构化简报',
    mode: 'real',
    inputs: ['text', 'audio', 'image'],
  },
  {
    label: 'Demo 生成',
    detail: '基于简报生成候选小样，保留哼唱动机作为主旋律种子',
    mode: 'simulated',
    inputs: ['text', 'audio'],
  },
]

export interface DemoCandidate {
  id: string
  title: string
  cover: string
  outputType: OutputType
  providerId: string
  mode: RunMode
  duration: string
  bpm: number
  key: string
  isMain?: boolean
  descriptor: string
  audioUrl?: string
}

export const DEMO_CANDIDATES: DemoCandidate[] = [
  {
    id: 'c1',
    title: '雨夜街角 · 候选 A',
    cover: '/covers/cover-dusk.png',
    outputType: 'song',
    providerId: 'aurora',
    mode: 'real',
    duration: '1:48',
    bpm: 84,
    key: 'A minor',
    isMain: true,
    descriptor: '电钢开场，副歌加入 Pad 与拨弦，情绪更饱满。',
  },
  {
    id: 'c2',
    title: '雨夜街角 · 候选 B',
    cover: '/covers/cover-neon-rain.png',
    outputType: 'song',
    providerId: 'aurora',
    mode: 'real',
    duration: '1:52',
    bpm: 86,
    key: 'A minor',
    descriptor: '节奏更克制，保留更多留白，人声更靠前。',
  },
  {
    id: 'c3',
    title: '雨夜街角 · 旋律草图',
    cover: '/covers/cover-paper.png',
    outputType: 'melody',
    providerId: 'cadence',
    mode: 'simulated',
    duration: '0:42',
    bpm: 84,
    key: 'A minor',
    descriptor: '仅主旋律与和声走向，用于确认副歌动机方向。',
  },
]

export interface DemoVersion {
  id: string
  label: string
  author: string
  time: string
  note: string
  parent?: string
  current?: boolean
  outputType: OutputType
}

export const VERSIONS: DemoVersion[] = [
  {
    id: 'v4',
    label: 'v4',
    author: '林 · 你',
    time: '今天 15:24',
    note: '采用候选 A，微调副歌拨弦力度',
    parent: 'v3',
    current: true,
    outputType: 'song',
  },
  {
    id: 'v3',
    label: 'v3',
    author: '林 · 你',
    time: '今天 14:10',
    note: '基于图像分析补充冷暖配色，重生成两条候选',
    parent: 'v2',
    outputType: 'song',
  },
  {
    id: 'v2',
    label: 'v2',
    author: '阿哲',
    time: '昨天 21:38',
    note: '加入哼唱副歌动机，切换为 Aurora',
    parent: 'v1',
    outputType: 'melody',
  },
  {
    id: 'v1',
    label: 'v1',
    author: '林 · 你',
    time: '昨天 20:02',
    note: '仅歌词，首次生成旋律草图',
    outputType: 'melody',
  },
]

export interface TimedComment {
  id: string
  author: string
  initials: string
  at: number
  atLabel: string
  text: string
  resolved?: boolean
}

export const COMMENTS: TimedComment[] = [
  {
    id: 'cm1',
    author: '阿哲',
    initials: '哲',
    at: 12,
    atLabel: '0:12',
    text: '前奏电钢的空间感很好，能不能再干一点、少一点混响？',
  },
  {
    id: 'cm2',
    author: 'Mia',
    initials: 'M',
    at: 47,
    atLabel: '0:47',
    text: '副歌这句八度跳进是亮点，建议主版本保留。',
    resolved: true,
  },
  {
    id: 'cm3',
    author: '阿哲',
    initials: '哲',
    at: 78,
    atLabel: '1:18',
    text: '1:18 之后的留白有点久，可以早两拍进鼓。',
  },
]

export interface Work {
  id: string
  title: string
  description: string
  author: string
  cover: string
  created: string
  updated: string
  status: 'Draft' | 'Ready' | 'Collaboration'
  inputTypes: string[]
  demos: DemoCandidate[]
}

export const works: Work[] = [
  {
    id: 'rainy-corner-v4',
    title: '雨夜街角',
    description: '受雨夜街景启发的沉思爵士曲。融合了城市的冷漠与人物内心的温暖。',
    author: 'Demo 创作者',
    cover: '/covers/cover-dusk.png',
    created: '2024-01-10',
    updated: '2024-01-15',
    status: 'Ready',
    inputTypes: ['text', 'image', 'audio'],
    demos: DEMO_CANDIDATES,
  },
  {
    id: 'morning-run',
    title: '晨跑节奏',
    description: '高能动感的电子舞曲，用于晨间跑步编程和锻炼。',
    author: 'Demo 创作者',
    cover: '/covers/cover-neon-rain.png',
    created: '2024-01-08',
    updated: '2024-01-12',
    status: 'Draft',
    inputTypes: ['text', 'image'],
    demos: DEMO_CANDIDATES.slice(0, 2),
  },
  {
    id: 'homecoming-short',
    title: '短片 · 归乡',
    description: '为独立短片《归乡》创作的配乐。新鲜而有张力的弦乐组合。',
    author: '李创意',
    cover: '/covers/cover-paper.png',
    created: '2024-01-05',
    updated: '2024-01-09',
    status: 'Collaboration',
    inputTypes: ['video'],
    demos: DEMO_CANDIDATES.slice(0, 3),
  },
]
