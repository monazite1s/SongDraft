import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { WorksClient } from "./works-client";

test("filters projects by text query", () => {
  render(<WorksClient projects={[{ id: "a", ownerId: "u", title: "雨后列车", description: "告别", status: "draft", combination: "text", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }, { id: "b", ownerId: "u", title: "海边日落", description: "配乐", status: "ready", combination: "visual", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }]} />);
  fireEvent.change(screen.getByRole("textbox", { name: "搜索项目" }), { target: { value: "海边" } });
  expect(screen.getByText("海边日落")).toBeInTheDocument();
  expect(screen.queryByText("雨后列车")).not.toBeInTheDocument();
});
