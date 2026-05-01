import { describe, expect, it } from "vitest";
import { waitForKuroneKoAppPage } from "./appPage";

interface FakePage {
  id: string;
  driverReady: boolean;
  label?: string;
  runtimeLabel?: string;
  url: () => string;
  evaluate: <Result>(callback: () => Result | Promise<Result>) => Promise<Result>;
}

interface FakeContext {
  pages: () => FakePage[];
}

interface FakeBrowser {
  contexts: () => FakeContext[];
}

const createPage = (id: string, driverReady: boolean, url = "about:blank", label?: string, runtimeLabel?: string): FakePage => ({
  id,
  driverReady,
  label,
  runtimeLabel,
  url: () => url,
  evaluate: async <Result,>(callback: () => Result | Promise<Result>): Promise<Result> => {
    let result: boolean | string | null;

    if (String(callback).includes("getWindowLabel")) {
      result = runtimeLabel ?? null;
    } else {
      result = driverReady;
    }

    return result as Result;
  },
});

const createBrowser = (pages: FakePage[]): FakeBrowser => ({
  contexts: () => [{ pages: () => pages }],
});

describe("waitForKuroneKoAppPage", () => {
  it("selects the CDP page that exposes the KURONE-KO E2E driver instead of the first blank page", async () => {
    const blankPage = createPage("blank", false);
    const appPage = createPage("app", true, "http://localhost:1420/");

    const selectedPage = await waitForKuroneKoAppPage(createBrowser([blankPage, appPage]), {
      pollIntervalMs: 1,
      timeoutMs: 20,
    });

    expect(selectedPage).toBe(appPage);
  });

  it("fails clearly when CDP exposes pages but none is the initialized KURONE-KO app", async () => {
    const stalePage = createPage("stale", false, "http://localhost:1420/");

    await expect(
      waitForKuroneKoAppPage(createBrowser([stalePage]), {
        pollIntervalMs: 1,
        timeoutMs: 2,
      }),
    ).rejects.toThrow("Timed out waiting for the KURONE-KO app page with the E2E driver");
  });

  it("selects the initialized app page matching the requested window label", async () => {
    const dashboardPage = createPage("dashboard", true, "http://localhost:1420/", "dashboard");
    const timerPage = createPage("timer", true, "http://localhost:1420/", "timer");

    const selectedPage = await waitForKuroneKoAppPage(createBrowser([dashboardPage, timerPage]), {
      label: "timer",
      pollIntervalMs: 1,
      timeoutMs: 20,
    });

    expect(selectedPage).toBe(timerPage);
  });

  it("does not select an initialized app page with a different window label", async () => {
    const dashboardPage = createPage("dashboard", true, "http://localhost:1420/", "dashboard");

    await expect(
      waitForKuroneKoAppPage(createBrowser([dashboardPage]), {
        label: "timer",
        pollIntervalMs: 1,
        timeoutMs: 2,
      }),
    ).rejects.toThrow("Timed out waiting for the KURONE-KO app page with the E2E driver");
  });

  it("selects the initialized app page whose E2E driver reports the requested runtime window label", async () => {
    const dashboardPage = createPage("dashboard", true, "http://localhost:1420/", undefined, "dashboard");
    const timerPage = createPage("timer", true, "http://localhost:1420/", undefined, "timer");

    const selectedPage = await waitForKuroneKoAppPage(createBrowser([dashboardPage, timerPage]), {
      label: "dashboard",
      pollIntervalMs: 1,
      timeoutMs: 20,
    });

    expect(selectedPage).toBe(dashboardPage);
  });
});
