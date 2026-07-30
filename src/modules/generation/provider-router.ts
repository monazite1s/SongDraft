/**
 * 多模态生成计划路由（docs/technical-design.md）
 *
 * 只产出**由输入派生的事实性结构**（素材组合、输出类型、Provider 是否就绪），
 * 不再包含写死的「氛围/意象」散文或假 Mock 文案。step 内容均来自入参，executionKind/warnings
 * 反映真实 Provider 配置（MiniMax 是否配置）。
 */
import type { CombinationKey, ExecutionKind, OutputType } from "@/shared/contracts/domain";

export interface PlannedStep { title: string; executionKind: ExecutionKind; detail: string; inputs: string[]; }
export interface RoutedPlan { providerName: string; outputType: OutputType; combination: CombinationKey; steps: PlannedStep[]; warnings: string[]; }

const combinationInputs: Record<CombinationKey, string[]> = {
  text: ["文字/歌词"], melody: ["哼唱/音频"], visual: ["图片/视频"], "melody+text": ["文字/歌词", "哼唱/音频"], "text+visual": ["文字/歌词", "图片/视频"], "melody+visual": ["哼唱/音频", "图片/视频"], "melody+text+visual": ["文字/歌词", "哼唱/音频", "图片/视频"],
};

/** MiniMax 是否真实可用（凭据齐全且非 mock 模式）。决定计划步骤的 executionKind 与告警。 */
function musicConfigured(): boolean {
  return Boolean(process.env.MINIMAX_API_KEY && process.env.MUSIC_PROVIDER_MODE !== "mock");
}

export function routeGeneration(input: { combination: CombinationKey; outputType: OutputType; brief: { theme: string; genre: string; tempo: string } }): RoutedPlan {
  const inputs = combinationInputs[input.combination];
  const usesMelody = input.combination.includes("melody");
  const usesVisual = input.combination.includes("visual");
  const outputLabel = input.outputType === "song" ? "歌曲 Demo" : input.outputType === "soundtrack" ? "配乐 Demo" : "旋律草稿";
  const kind: ExecutionKind = musicConfigured() ? "real_external" : "simulated";
  const steps: PlannedStep[] = [
    { title: "整理多模态输入", executionKind: kind, inputs, detail: `素材组合：${input.combination}` },
    { title: "创作简报", executionKind: kind, inputs: ["Creative Brief"], detail: `主题「${input.brief.theme}」· 曲风 ${input.brief.genre} · ${input.brief.tempo}` },
  ];
  if (usesMelody) steps.push({ title: "旋律参考", executionKind: kind, inputs: ["哼唱/音频"], detail: "参考音频经 COS 预签名 URL 作为 music-cover 的 audio_url" });
  if (usesVisual) steps.push({ title: "视觉氛围映射", executionKind: kind, inputs: ["图片/视频"], detail: "参考图经 GLM 图生文注入音乐 prompt 视觉意象" });
  steps.push({ title: `输出${outputLabel}`, executionKind: kind, inputs: ["Creative Brief", "歌词/旋律参考"], detail: kind === "real_external" ? "调用 MiniMax 生成真实音频" : "未配置 MiniMax，无法生成真实音频" });
  return {
    providerName: kind === "real_external" ? "MiniMax" : "未配置",
    outputType: input.outputType,
    combination: input.combination,
    steps,
    warnings: kind === "real_external" ? [] : ["未配置 MINIMAX_API_KEY，候选不含可播放音频"],
  };
}
