import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import HomePage from "./(app)/page";

test("renders the SongDraft inspiration entry", () => {
  render(<HomePage />);

  expect(screen.getByRole("heading", { name: "今天想记录什么灵感？" })).toBeInTheDocument();
  expect(screen.getByText("SongDraft 创作台")).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "灵感描述" })).toBeInTheDocument();
});
