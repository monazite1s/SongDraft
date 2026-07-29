import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { MaterialPanel, type MaterialDraft } from "./material-panel";

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

test("refined result shows only refined lyrics, not the editable original", () => {
  const { onDraftChange } = renderPanel({
    draft: { ...emptyDraft, lyrics: "原始一行" },
    originalLyrics: "原始一行",
    refinedLyrics: "精修一行",
  });

  expect(screen.getByText("精修一行")).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText("输入歌词或文本"), {
    target: { value: "用户改动原始" },
  });
  expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ lyrics: "用户改动原始" }));
  // 精修结果区仍展示精修稿，不随原始输入框同步
  expect(screen.getByText("精修一行")).toBeInTheDocument();
});

test("shows empty refined result panel before refinement", () => {
  renderPanel();
  expect(screen.getByText("精修结果")).toBeInTheDocument();
  expect(screen.getByText("尚未精修，可直接生成简报，或先精修歌词")).toBeInTheDocument();
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
