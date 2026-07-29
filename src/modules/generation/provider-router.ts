import type { CombinationKey, ExecutionKind, OutputType } from "@/shared/contracts/domain";

export interface PlannedStep { title: string; executionKind: ExecutionKind; detail: string; inputs: string[]; }
export interface RoutedPlan { providerName: string; outputType: OutputType; combination: CombinationKey; steps: PlannedStep[]; warnings: string[]; }

const combinationInputs: Record<CombinationKey, string[]> = {
  text: ["文字/歌词"], melody: ["哼唱/音频"], visual: ["图片/视频"], "melody+text": ["文字/歌词", "哼唱/音频"], "text+visual": ["文字/歌词", "图片/视频"], "melody+visual": ["哼唱/音频", "图片/视频"], "melody+text+visual": ["文字/歌词", "哼唱/音频", "图片/视频"],
};

export function routeGeneration(input: { combination: CombinationKey; outputType: OutputType; brief: { theme: string; genre: string; tempo: string } }): RoutedPlan {
  const inputs = combinationInputs[input.combination];
  const usesMelody = input.combination.includes("melody") || input.combination === "melody";
  const usesVisual = input.combination.includes("visual") || input.combination === "visual";
  const outputLabel = input.outputType === "song" ? "歌曲 Demo" : input.outputType === "soundtrack" ? "配乐 Demo" : "旋律草稿";
  const steps: PlannedStep[] = [
    { title: "整理多模态输入", executionKind: "simulated", inputs, detail: `识别 ${input.combination} 组合，保留原始素材，并按用户确认优先级处理冲突。` },
    { title: "创作简报", executionKind: "simulated", inputs: ["Creative Brief"], detail: `主题「${input.brief.theme}」，曲风 ${input.brief.genre}，速度 ${input.brief.tempo}。` },
  ];
  if (usesMelody) steps.push({ title: "旋律参考", executionKind: "simulated", inputs: ["哼唱/音频"], detail: "当前 Mock 仅保留旋律参考；真实 Provider 接入后提取 BPM、音域和旋律轮廓。" });
  if (usesVisual) steps.push({ title: "视觉氛围映射", executionKind: "simulated", inputs: ["图片/视频"], detail: "当前 Mock 将视觉素材作为氛围证据；真实 Vision 接入后生成配器和歌词意象建议。" });
  steps.push({ title: `输出${outputLabel}`, executionKind: "simulated", inputs: input.outputType === "melody_sketch" ? ["旋律参考", "Creative Brief"] : ["Creative Brief", "歌词/旋律参考"], detail: "当前为透明 Mock，不会调用或冒充外部音乐生成 API。" });
  return { providerName: "SongDraft Mock Provider", outputType: input.outputType, combination: input.combination, steps, warnings: ["未配置真实音乐 Provider，候选不包含可播放音频。"] };
}
