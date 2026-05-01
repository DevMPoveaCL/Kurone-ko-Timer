import { describe, expect, it } from "vitest";
import { minimizeCurrentWindow } from "./minimize";

describe("minimizeCurrentWindow", () => {
  it("returns true when the window is minimized", async () => {
    await expect(minimizeCurrentWindow({ minimize: async () => undefined })).resolves.toBe(true);
  });

  it("returns false when the Tauri window API rejects", async () => {
    await expect(
      minimizeCurrentWindow({
        minimize: async () => {
          throw new Error("window API unavailable");
        },
      }),
    ).resolves.toBe(false);
  });
});
