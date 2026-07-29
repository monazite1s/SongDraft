import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/" }));

import HomePage from "./(app)/page";

test("renders the SongDraft inspiration record entry", () => {
  render(<HomePage />);

  // “灵感记录”同时出现在侧栏导航与页头，断言至少存在一处。
  expect(screen.getAllByText("灵感记录").length).toBeGreaterThan(0);
  expect(screen.getByRole("heading", { name: "先把这一刻留下来" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /录音/ })).toBeInTheDocument();
});
