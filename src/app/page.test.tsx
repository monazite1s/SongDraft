import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import HomePage from "./(app)/page";

test("renders the SongDraft inspiration entry", () => {
  render(<HomePage />);

  expect(screen.getByText("SongDraft")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "素材构建" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "创意简报" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "生成 Demo 将生成 3 条 歌曲 Demo 候选" })).toBeInTheDocument();
});
