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
    note: '图片输入不会发送给音乐模型。',
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
    note: '用于流程演示。',
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

/**
 * 简报初始空态：所有创作字段（主题/风格/速度/情绪/乐器/歌词概要/旋律特征/视觉参考/证据/冲突/优先策略）
 * 一律留空，仅由 DeepSeek 生成后填充——不预置任何写死内容。
 */
export const DEFAULT_BRIEF: CreativeBrief = {
  theme: '',
  mood: [],
  genre: '',
  tempo: '',
  instruments: [],
  lyricSummary: '',
  melodyFeatures: '',
  visualReferences: '',
  evidence: [],
  conflicts: [],
  priority: '',
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
  /**
   * 封面图（可选）。MiniMax 不返回封面，真实候选不应携带假封面。
   * 仅当存在真实来源（用户上传/外部图床）时才填充；否则留空，用 coverFromTitle 占位。
   */
  cover?: string
  outputType: OutputType
  providerId: string
  mode: RunMode
  duration: string
  /**
   * BPM（可选）。MiniMax 不返回 BPM，真实候选不应携带假值。
   * 字段保留以兼容详情栏类型；无真实来源时留空，不再展示。
   */
  bpm?: number
  /**
   * 调性（可选）。MiniMax 不返回调性，真实候选不应携带假值。
   * 字段保留以兼容详情栏类型；无真实来源时留空，不再展示。
   */
  key?: string
  isMain?: boolean
  descriptor: string
  audioUrl?: string
}

/**
 * 封面配色（与 sidebar colorForId 同源，确保全站视觉一致）。
 */
const COVER_BG_CLASSES = ['bg-brand', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5']

/**
 * 由标题首字符 + id hash 确定性生成诚实占位封面。
 *
 * MiniMax 不返回封面图，DEMO_CANDIDATES 里的假封面不再使用。改用「首字母 + hash 色块」
 * 作为诚实的「无封面」占位（参考 sidebar colorForId 配色与歌曲详情页 coverLetter 做法）。
 *
 * @param title 候选标题（取首字符作为占位字母）
 * @param id    候选 id（hash 后决定背景色）
 * @returns letter 占位字母；colorClass 背景色 class（如 'bg-brand'）
 */
export function coverFromTitle(title: string, id: string): { letter: string; colorClass: string } {
  const letter = (title || '?').trim().charAt(0).toUpperCase() || '?'
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  const colorClass = COVER_BG_CLASSES[hash % COVER_BG_CLASSES.length]!
  return { letter, colorClass }
}

export const DEMO_CANDIDATES: DemoCandidate[] = [
  {
    id: 'c1',
    title: '雨夜街角 · 候选 A',
    outputType: 'song',
    providerId: 'aurora',
    mode: 'real',
    duration: '1:48',
    isMain: true,
    descriptor: '电钢开场，副歌加入 Pad 与拨弦，情绪更饱满。',
  },
  {
    id: 'c2',
    title: '雨夜街角 · 候选 B',
    outputType: 'song',
    providerId: 'aurora',
    mode: 'real',
    duration: '1:52',
    descriptor: '节奏更克制，保留更多留白，人声更靠前。',
  },
  {
    id: 'c3',
    title: '雨夜街角 · 旋律草图',
    outputType: 'melody',
    providerId: 'cadence',
    mode: 'simulated',
    duration: '0:42',
    descriptor: '仅主旋律与和声走向，用于确认副歌动机方向。',
  },
]

