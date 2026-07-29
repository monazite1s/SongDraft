import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { MockDemoPlayer } from "./mock-demo-player";

test("labels the browser-synthesized sample transparently", () => {
  render(<MockDemoPlayer />);
  expect(screen.getByText("试听合成样例")).toBeInTheDocument();
  expect(screen.getByText(/不是外部音乐模型输出/)).toBeInTheDocument();
});
