export type InputModality = "text" | "melody" | "visual";

export type CombinationKey =
  | "text"
  | "melody"
  | "visual"
  | "melody+text"
  | "text+visual"
  | "melody+visual"
  | "melody+text+visual";

export type OutputType = "song" | "soundtrack" | "melody_sketch";
export type ExecutionKind = "real_local" | "real_external" | "simulated";

export interface ModalityPresence {
  hasText: boolean;
  hasMelody: boolean;
  hasVisual: boolean;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  requestId: string;
}

export interface ApiFailure {
  ok: false;
  error: { code: string; message: string; fields?: Record<string, string[]> };
  requestId: string;
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;
