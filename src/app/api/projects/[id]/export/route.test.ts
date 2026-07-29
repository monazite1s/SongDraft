import { expect, test } from "vitest";

import { safeExportFilename } from "@/modules/projects/export-utils";

test("creates a safe export filename without path separators", () => {
  expect(safeExportFilename("雨后/旧车站: Demo")).toBe("雨后-旧车站-Demo");
  expect(safeExportFilename("///")).toBe("songdraft-project");
});
