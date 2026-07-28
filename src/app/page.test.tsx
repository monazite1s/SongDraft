import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import HomePage from "./page";

test("renders the SongDraft application name", () => {
  render(<HomePage />);

  expect(screen.getByRole("heading", { name: "SongDraft" })).toBeInTheDocument();
});
