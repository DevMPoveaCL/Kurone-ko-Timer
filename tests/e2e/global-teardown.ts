import { cleanupProcessInfoFile, readProcessInfo, stopProcessTree } from "./shutdown-observability";

const PID_FILE = "test-results/kurone-ko-tauri-dev.json";

export default async function globalTeardown() {
  const processInfo = await readProcessInfo(PID_FILE);

  if (processInfo === null) {
    return;
  }

  await stopProcessTree(processInfo.pid);

  await cleanupProcessInfoFile(PID_FILE);
}
