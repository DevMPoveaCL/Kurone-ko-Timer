import { spawn } from "node:child_process";
import { isCdpAvailable, waitForCdp, writeProcessInfo } from "./shutdown-observability";

const CDP_ENDPOINT = process.env.KURONE_KO_CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const PID_FILE = "test-results/kurone-ko-tauri-dev.json";
export default async function globalSetup() {
  if (await isCdpAvailable(CDP_ENDPOINT)) {
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

  await writeProcessInfo(PID_FILE, { pid: childProcess.pid });

  await waitForCdp(childProcess, CDP_ENDPOINT);
}
