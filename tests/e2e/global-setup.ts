import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const CDP_ENDPOINT = process.env.KURONE_KO_CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const PID_FILE = "test-results/kurone-ko-tauri-dev.json";
const STARTUP_TIMEOUT_MS = 45_000;
const POLL_INTERVAL_MS = 500;

interface TauriDevProcessInfo {
  pid: number;
}

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const isCdpAvailable = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${CDP_ENDPOINT}/json/version`);

    return response.ok;
  } catch {
    return false;
  }
};

const waitForCdp = async (processRef: ChildProcess): Promise<void> => {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (processRef.exitCode !== null) {
      throw new Error(`tauri dev exited before CDP became available (code ${processRef.exitCode})`);
    }

    if (await isCdpAvailable()) {
      return;
    }

    await delay(POLL_INTERVAL_MS);
  }

  throw new Error(`Timed out waiting for WebView2 CDP endpoint at ${CDP_ENDPOINT}`);
};

export default async function globalSetup() {
  if (await isCdpAvailable()) {
    return;
  }

  const childProcess = spawn("npm", ["run", "tauri", "dev"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      KURONE_KO_E2E: "1",
      VITE_KURONE_KO_E2E: "1",
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: "--remote-debugging-port=9222",
    },
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (childProcess.pid === undefined) {
    throw new Error("Failed to start tauri dev for E2E tests");
  }

  const processInfo: TauriDevProcessInfo = { pid: childProcess.pid };
  await mkdir(dirname(PID_FILE), { recursive: true });
  await writeFile(PID_FILE, JSON.stringify(processInfo), "utf8");

  await waitForCdp(childProcess);
}
