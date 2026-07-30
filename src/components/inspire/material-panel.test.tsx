import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { MaterialPanel, type MaterialAsset, type MaterialDraft } from "./material-panel";

afterEach(() => cleanup());

const emptyDraft: MaterialDraft = {
  creativePrompt: "",
  lyrics: "",
  instruction: "",
};

function renderPanel(overrides?: {
  draft?: MaterialDraft;
  originalLyrics?: string;
  refinedLyrics?: string | null;
  onDraftChange?: (next: MaterialDraft) => void;
}) {
  const onDraftChange = overrides?.onDraftChange ?? vi.fn();
  const onUploadAsset = vi.fn<(file: File, kind: "audio" | "image") => Promise<MaterialAsset>>();
  render(
    <MaterialPanel
      selectedInputs={["text"]}
      onToggleInput={vi.fn()}
      coverSet={false}
      onSetCover={vi.fn()}
      draft={overrides?.draft ?? emptyDraft}
      onDraftChange={onDraftChange}
      originalLyrics={overrides?.originalLyrics ?? ""}
      refinedLyrics={overrides?.refinedLyrics ?? null}
      isRefining={false}
      refinementMessage=""
      refinementError=""
      onRefine={vi.fn()}
      onRefinedChange={vi.fn()}
      hummingAsset={null}
      referenceImage={null}
      onUploadAsset={onUploadAsset}
      onHummingChange={vi.fn()}
      onImageChange={vi.fn()}
    />,
  );
  return { onDraftChange };
}

test("text fields start empty and expose placeholders instead of seeded values", () => {
  renderPanel();
  expect(screen.getByPlaceholderText("输入创作提示")).toHaveValue("");
  expect(screen.getByPlaceholderText("输入歌词或文本")).toHaveValue("");
  expect(screen.getByPlaceholderText("输入处理指令")).toHaveValue("");
});

test("refined result is an editable textarea and stays independent from original lyrics", () => {
  const onRefinedChange = vi.fn();
  const onDraftChange = vi.fn();
  const onUploadAsset = vi.fn<(file: File, kind: "audio" | "image") => Promise<MaterialAsset>>();
  render(
    <MaterialPanel
      selectedInputs={["text"]}
      onToggleInput={vi.fn()}
      coverSet={false}
      onSetCover={vi.fn()}
      draft={{ ...emptyDraft, lyrics: "原始一行" }}
      onDraftChange={onDraftChange}
      originalLyrics="原始一行"
      refinedLyrics="精修一行"
      isRefining={false}
      refinementMessage=""
      refinementError=""
      onRefine={vi.fn()}
      onRefinedChange={onRefinedChange}
      hummingAsset={null}
      referenceImage={null}
      onUploadAsset={onUploadAsset}
      onHummingChange={vi.fn()}
      onImageChange={vi.fn()}
    />,
  );

  const refinedBox = screen.getByDisplayValue("精修一行");
  expect(refinedBox.tagName).toBe("TEXTAREA");
  fireEvent.change(screen.getByPlaceholderText("输入歌词或文本"), {
    target: { value: "用户改动原始" },
  });
  expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ lyrics: "用户改动原始" }));
  // 改原始歌词不会自动改精修结果
  expect(screen.getByDisplayValue("精修一行")).toBeInTheDocument();

  fireEvent.change(refinedBox, { target: { value: "人工改精修" } });
  expect(onRefinedChange).toHaveBeenCalledWith("人工改精修");
});

test("shows editable empty refined result panel before refinement", () => {
  renderPanel();
  expect(screen.getByText("精修结果")).toBeInTheDocument();
  expect(
    screen.getByPlaceholderText("尚未精修：可先点「精修歌词」，或在此直接编写将用于生成的歌词"),
  ).toBeInTheDocument();
});

test("does not show fake audio or image content when nothing is uploaded", () => {
  renderPanel();
  fireEvent.click(screen.getByRole("button", { name: "哼唱 / 音频" }));
  expect(screen.queryByText(/humming_v2/)).not.toBeInTheDocument();
  expect(screen.queryByText("旋律分析结果")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "图像 / 视频" }));
  expect(screen.queryByAltText(/参考图像/)).not.toBeInTheDocument();
  expect(screen.queryByText("画面分析结果")).not.toBeInTheDocument();
});
