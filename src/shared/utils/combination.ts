import type { CombinationKey, ModalityPresence } from "@/shared/contracts/domain";
import { DomainError } from "@/shared/errors/domain-error";

export function detectCombination(input: ModalityPresence): CombinationKey {
  if (input.hasText && input.hasMelody && input.hasVisual) return "melody+text+visual";
  if (input.hasText && input.hasMelody) return "melody+text";
  if (input.hasText && input.hasVisual) return "text+visual";
  if (input.hasMelody && input.hasVisual) return "melody+visual";
  if (input.hasText) return "text";
  if (input.hasMelody) return "melody";
  if (input.hasVisual) return "visual";
  throw new DomainError("input_required", 422);
}

/** 制作台允许先建空项目：无模态素材时回落默认 combination，不抛 input_required。 */
export function resolveCombination(input: ModalityPresence, fallback: CombinationKey = "text"): CombinationKey {
  if (!input.hasText && !input.hasMelody && !input.hasVisual) return fallback;
  return detectCombination(input);
}
