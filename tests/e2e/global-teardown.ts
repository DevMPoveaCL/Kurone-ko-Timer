import { readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";

const PID_FILE = "test-results/kurone-ko-tauri-dev.json";

interface TauriDevProcessInfo {
  pid: number;
}

const isTauriDevProcessInfo = (value: unknown): value is TauriDevProcessInfo => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.pid === "number" && Number.isInteger(candidate.pid) && candidate.pid > 0;
};

const stopProcessTree = async (pid: number): Promise<void> =>
  new Promise((resolve) => {
    if (process.platform !== "win32") {
      try {
        process.kill(pid);
      } catch {
        // Already stopped.
      }
      resolve();
      return;
    }

    const taskkill = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    taskkill.on("close", () => resolve());
    taskkill.on("error", () => resolve());
  });

export default async function globalTeardown() {
  let processInfo: unknown;

  try {
    processInfo = JSON.parse(await readFile(PID_FILE, "utf8"));
  } catch {
    return;
  }

  if (isTauriDevProcessInfo(processInfo)) {
    await stopProcessTree(processInfo.pid);
  }

  await rm(PID_FILE, { force: true });
}
