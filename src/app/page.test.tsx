import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import HomePage from "./(app)/page";

test("renders the SongDraft inspiration record entry", () => {
  render(<HomePage />);

  expect(screen.getByText("灵感记录")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "先把这一刻留下来" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /录音/ })).toBeInTheDocument();
});
