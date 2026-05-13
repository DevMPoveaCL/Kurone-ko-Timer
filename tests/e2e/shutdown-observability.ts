import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";

const STARTUP_TIMEOUT_MS = Number.parseInt(process.env.KURONE_KO_E2E_STARTUP_TIMEOUT_MS ?? "120000", 10);
const SHUTDOWN_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 500;

export interface TauriDevProcessInfo {
  pid: number;
}

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

export const isCdpAvailable = async (cdpEndpoint: string): Promise<boolean> => {
  try {
    const response = await fetch(`${cdpEndpoint}/json/version`);
    return response.ok;
  } catch {
    return false;
  }
};

export const waitForCdp = async (processRef: ChildProcess, cdpEndpoint: string): Promise<void> => {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (processRef.exitCode !== null) {
      throw new Error(`tauri dev exited before CDP became available (code ${processRef.exitCode})`);
    }

    if (await isCdpAvailable(cdpEndpoint)) {
      return;
    }

    await delay(POLL_INTERVAL_MS);
  }

  throw new Error(`Timed out waiting for WebView2 CDP endpoint at ${cdpEndpoint}`);
};

const isProcessAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

export const waitForShutdown = async (pid: number, cdpEndpoint: string): Promise<void> => {
  const deadline = Date.now() + SHUTDOWN_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const alive = isProcessAlive(pid);
    const cdpAvailable = await isCdpAvailable(cdpEndpoint);

    if (!alive && !cdpAvailable) {
      return;
    }

    await delay(POLL_INTERVAL_MS);
  }

  throw new Error(`Expected Kurone-ko shutdown but process ${pid} and/or CDP ${cdpEndpoint} remained available`);
};

export const writeProcessInfo = async (pidFile: string, processInfo: TauriDevProcessInfo): Promise<void> => {
  await mkdir(dirname(pidFile), { recursive: true });
  await writeFile(pidFile, JSON.stringify(processInfo), "utf8");
};

export const readProcessInfo = async (pidFile: string): Promise<TauriDevProcessInfo | null> => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(await readFile(pidFile, "utf8"));
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const candidate = parsed as Record<string, unknown>;

  if (typeof candidate.pid !== "number" || !Number.isInteger(candidate.pid) || candidate.pid <= 0) {
    return null;
  }

  return { pid: candidate.pid };
};

export const stopProcessTree = async (pid: number): Promise<void> =>
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

export const cleanupProcessInfoFile = async (pidFile: string): Promise<void> => {
  await rm(pidFile, { force: true });
};
