import { chromium, expect, test, type Browser, type Page } from "@playwright/test";
import { waitForKuroneKoAppPage } from "../../src/e2e/appPage";

const CDP_ENDPOINT = process.env.KURONE_KO_CDP_ENDPOINT ?? "http://127.0.0.1:9222";

interface KuroneKoE2EDriver {
  getWindowLabel: () => Promise<string> | string;
  isWindowVisible: (label: string) => Promise<boolean> | boolean;
  getMusicState: () => Promise<KuroneKoMusicState> | KuroneKoMusicState;
  reset: () => Promise<void> | void;
  setFastDurations: (settings: {
    focusDurationSeconds: number;
    shortBreakDurationSeconds: number;
    longBreakDurationSeconds: number;
    sessionGoal: number;
    sessionsBeforeLongBreak: number;
  }) => Promise<void> | void;
}

interface KuroneKoMusicState {
  ducked: boolean;
  enabled: boolean;
  isPlaying: boolean;
}

interface KuroneKoWindow extends Window {
  __KURONE_KO_E2E__?: KuroneKoE2EDriver;
}

interface ElementBounds {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
}

interface ElementLayoutSnapshot extends ElementBounds {
  text: string;
}

interface CardFrameSnapshot extends ElementBounds {
  borderRadius: number;
  boxShadow: string;
  viewportHeight: number;
  viewportWidth: number;
}

const TIMER_VIEWPORT = {
  height: 150,
  width: 300,
} as const;

const DASHBOARD_VIEWPORT = {
  height: 640,
  width: 360,
} as const;

const MAX_TIMER_GUTTER_PX = 4;
const MAX_DASHBOARD_GUTTER_PX = 8;

const toElementBounds = (rect: DOMRect): ElementBounds => ({
  bottom: rect.bottom,
  height: rect.height,
  left: rect.left,
  right: rect.right,
  top: rect.top,
  width: rect.width,
});

const expectBoundsInsideViewport = (bounds: ElementBounds, viewport: typeof TIMER_VIEWPORT | typeof DASHBOARD_VIEWPORT) => {
  expect(bounds.width).toBeGreaterThan(0);
  expect(bounds.height).toBeGreaterThan(0);
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(viewport.width);
  expect(bounds.bottom).toBeLessThanOrEqual(viewport.height);
};

const expectRoundedCardFrame = (snapshot: CardFrameSnapshot, viewport: typeof TIMER_VIEWPORT | typeof DASHBOARD_VIEWPORT, maxGutterPx: number) => {
  expect(snapshot.viewportWidth).toBe(viewport.width);
  expect(snapshot.viewportHeight).toBe(viewport.height);
  expect(snapshot.left).toBeGreaterThanOrEqual(0);
  expect(snapshot.top).toBeGreaterThanOrEqual(0);
  expect(snapshot.left).toBeLessThanOrEqual(maxGutterPx);
  expect(snapshot.top).toBeLessThanOrEqual(maxGutterPx);
  expect(viewport.width - snapshot.right).toBeLessThanOrEqual(maxGutterPx);
  expect(viewport.height - snapshot.bottom).toBeLessThanOrEqual(maxGutterPx);
  expect(snapshot.boxShadow).not.toBe("none");
  expect(snapshot.borderRadius).toBeGreaterThan(0);
};

const getViewportSize = async (page: Page): Promise<typeof TIMER_VIEWPORT | typeof DASHBOARD_VIEWPORT> =>
  page.evaluate(() => ({
    height: window.innerHeight,
    width: window.innerWidth,
  }));

const resetE2EState = async (page: Page) => {
  await page.evaluate(async () => {
    const driver = (window as KuroneKoWindow).__KURONE_KO_E2E__;

    if (driver === undefined) {
      throw new Error("KURONE-KO E2E driver is not available");
    }

    await driver.reset();
  });
};

const setFastDurations = async (page: Page, focusDurationSeconds: number) => {
  await page.evaluate(async (durationSeconds) => {
    const driver = (window as KuroneKoWindow).__KURONE_KO_E2E__;

    if (driver === undefined) {
      throw new Error("KURONE-KO E2E driver is not available");
    }

    await driver.setFastDurations({
      focusDurationSeconds: durationSeconds,
      shortBreakDurationSeconds: 1,
      longBreakDurationSeconds: 1,
      sessionGoal: 1,
      sessionsBeforeLongBreak: 1,
    });
  }, focusDurationSeconds);
};

const getMusicState = async (page: Page): Promise<KuroneKoMusicState> =>
  page.evaluate(async () => {
    const driver = (window as KuroneKoWindow).__KURONE_KO_E2E__;

    if (driver === undefined) {
      throw new Error("KURONE-KO E2E driver is not available");
    }

    return driver.getMusicState();
  });

const getWindowLabel = async (page: Page): Promise<string> =>
  page.evaluate(async () => {
    const driver = (window as KuroneKoWindow).__KURONE_KO_E2E__;

    if (driver === undefined) {
      throw new Error("KURONE-KO E2E driver is not available");
    }

    return driver.getWindowLabel();
  });

const isWindowVisible = async (page: Page, label: string): Promise<boolean> =>
  page.evaluate(async (windowLabel) => {
    const driver = (window as KuroneKoWindow).__KURONE_KO_E2E__;

    if (driver === undefined) {
      throw new Error("KURONE-KO E2E driver is not available");
    }

    return driver.isWindowVisible(windowLabel);
  }, label);

test.describe("KURONE-KO native widget smoke", () => {
  let browser: Browser;
  let page: Page;

  test.beforeAll(async () => {
    browser = await chromium.connectOverCDP(CDP_ENDPOINT);
    page = await waitForKuroneKoAppPage(browser, { label: "dashboard" });
    await expect(page.getByLabel("KURONE-KO dashboard")).toBeVisible();
    await expect.poll(() => getWindowLabel(page)).toBe("dashboard");
    await expect.poll(() => isWindowVisible(page, "dashboard")).toBe(true);
    await expect.poll(() => isWindowVisible(page, "timer")).toBe(false);
  });

  test.afterAll(async () => {
    await browser?.close();
  });

  test.beforeEach(async () => {
    const dashboardPage = await waitForKuroneKoAppPage(browser, { label: "dashboard" });
    const timerPage = await waitForKuroneKoAppPage(browser, { label: "timer" });

    if (await isWindowVisible(timerPage, "timer")) {
      await timerPage.getByRole("button", { name: "Return to dashboard" }).click();
    }

    await expect.poll(() => isWindowVisible(dashboardPage, "dashboard")).toBe(true);
    await expect(dashboardPage.getByLabel("KURONE-KO dashboard")).toBeVisible();
    if (await dashboardPage.getByRole("dialog", { name: "Welcome to KURONE-KO" }).isVisible()) {
      await dashboardPage.keyboard.press("Escape");
    }

    const backToDashboard = dashboardPage.getByRole("button", { name: "Back to dashboard" });
    if (await backToDashboard.isVisible()) {
      await backToDashboard.click();
    }

    await dashboardPage.getByRole("button", { name: "Start Focus" }).click();

    page = timerPage;
    await expect.poll(() => isWindowVisible(page, "timer")).toBe(true);
    await expect.poll(() => isWindowVisible(page, "dashboard")).toBe(false);
    await expect(page.getByLabel("KURONE-KO focus timer; drag empty areas to move")).toBeVisible();
    await page.getByRole("button", { name: "Show timer" }).click();
    await resetE2EState(page);
  });

  test("opens dashboard visibly at launch and keeps the timer hidden until selected", async () => {
    expect(await getWindowLabel(page)).toBe("timer");
    await expect.poll(() => isWindowVisible(page, "timer")).toBe(true);
    await expect.poll(() => isWindowVisible(page, "dashboard")).toBe(false);

    await page.getByRole("button", { name: "Return to dashboard" }).click();

    const dashboardPage = await waitForKuroneKoAppPage(browser, { label: "dashboard" });
    await expect.poll(() => isWindowVisible(dashboardPage, "dashboard")).toBe(true);
    await expect.poll(() => isWindowVisible(dashboardPage, "timer")).toBe(false);
    await expect(dashboardPage.getByLabel("KURONE-KO dashboard")).toBeVisible();

    await expect.poll(() => getViewportSize(dashboardPage)).toEqual(DASHBOARD_VIEWPORT);

    const dashboardCardFrame = await dashboardPage.locator(".dashboard-card").evaluate<CardFrameSnapshot>((element) => {
      const rect = element.getBoundingClientRect();
      const styles = window.getComputedStyle(element);

      return {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
        borderRadius: Number.parseFloat(styles.borderTopLeftRadius),
        boxShadow: styles.boxShadow,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      };
    });

    expectRoundedCardFrame(dashboardCardFrame, DASHBOARD_VIEWPORT, MAX_DASHBOARD_GUTTER_PX);
    expect(dashboardCardFrame.borderRadius).toBeLessThanOrEqual(14);
  });

  test("launches the app window and responds to toolbar panel toggles", async () => {
    await expect(page.getByText(/drag/i)).toHaveCount(0);
    await expect(page.getByLabel("Move widget")).toHaveAttribute("data-tauri-drag-region", "");
    await expect(page.getByRole("button", { name: "Show timer" })).toHaveText("");
    await expect(page.getByRole("button", { name: "Show settings" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Show history" })).toHaveText("");
    await expect(page.getByRole("button", { name: "Play Kurone-ko Playlist" })).toHaveText("");
    await expect(page.getByText("KURONE-KO · Ready to focus")).toBeVisible();

    await page.getByRole("button", { name: "Show history" }).click();
    await expect(page.getByLabel("Today history")).toBeVisible();

    await page.getByRole("button", { name: "Show history" }).click();
    await expect(page.getByLabel("Today history")).toBeHidden();
    await expect(page.getByText("KURONE-KO · Ready to focus")).toBeVisible();
  });

  test("toggles Kurone-ko Playlist from the compact widget control", async () => {
    await page.getByRole("button", { name: "Play Kurone-ko Playlist" }).click();

    await expect(page.getByRole("button", { name: "Stop Kurone-ko Playlist" })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Stop Kurone-ko Playlist" }).click();

    await expect(page.getByRole("button", { name: "Play Kurone-ko Playlist" })).toHaveAttribute("aria-pressed", "false");
  });

  test("keeps settings controls out of the focus widget", async () => {
    await expect(page.getByRole("button", { name: "Show settings" })).toHaveCount(0);
    await expect(page.getByLabel("Timer settings")).toHaveCount(0);
    await expect(page.getByLabel("Focus minutes")).toHaveCount(0);
    await expect(page.getByRole("radio", { name: "Generated Ambience" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Focus" })).toHaveCount(0);
  });

  test("does not expose obsolete generated ambience source from configuration", async () => {
    await page.getByRole("button", { name: "Return to dashboard" }).click();

    const dashboardPage = await waitForKuroneKoAppPage(browser, { label: "dashboard" });
    await expect(dashboardPage.getByLabel("KURONE-KO dashboard")).toBeVisible();
    await dashboardPage.getByRole("button", { name: "Configuration" }).click();
    await expect(dashboardPage.getByRole("heading", { name: "Configuration" })).toBeVisible();

    await expect(dashboardPage.getByRole("radio", { name: "Generated Ambience" })).toHaveCount(0);
    await expect(dashboardPage.getByRole("radio", { name: "Kurone-ko Playlist" })).toBeVisible();
  });

  test("persists Kurone-ko playlist source selection from configuration", async () => {
    await page.getByRole("button", { name: "Return to dashboard" }).click();

    const dashboardPage = await waitForKuroneKoAppPage(browser, { label: "dashboard" });
    await expect(dashboardPage.getByLabel("KURONE-KO dashboard")).toBeVisible();
    await dashboardPage.getByRole("button", { name: "Configuration" }).click();
    await expect(dashboardPage.getByRole("heading", { name: "Configuration" })).toBeVisible();

    await dashboardPage.getByRole("radio", { name: "Kurone-ko Playlist" }).click();

    await expect(dashboardPage.getByText("Kurone-ko Playlist configured for focus sessions")).toBeVisible();
    await expect(dashboardPage.getByRole("button", { name: "Deep Focus" })).toHaveCount(0);
    await expect(dashboardPage.getByRole("button", { name: "Nature Calm" })).toHaveCount(0);
    await expect(dashboardPage.getByRole("button", { name: "Lo-fi Flow" })).toHaveCount(0);
    await expect.poll(() => dashboardPage.evaluate(() => window.localStorage.getItem("kurone-ko.music.source"))).toBe("kuroneko-playlist");

    await dashboardPage.reload();
    await expect(dashboardPage.getByLabel("KURONE-KO dashboard")).toBeVisible();
    if (await dashboardPage.getByRole("dialog", { name: "Welcome to KURONE-KO" }).isVisible()) {
      await dashboardPage.keyboard.press("Escape");
    }
    await dashboardPage.getByRole("button", { name: "Configuration" }).click();
    await expect(dashboardPage.getByRole("heading", { name: "Configuration" })).toBeVisible();
    await expect(dashboardPage.getByRole("radio", { name: "Kurone-ko Playlist" })).toBeChecked();
    await expect(dashboardPage.getByText("Kurone-ko Playlist configured for focus sessions")).toBeVisible();
  });

  test("starts the timer and decrements the displayed time", async () => {
    await setFastDurations(page, 3);
    await expect(page.getByText("00:03")).toBeVisible();

    await page.getByRole("button", { name: "Start" }).click();

    await expect(page.getByText("00:02")).toBeVisible({ timeout: 2_500 });
  });

  test("completes a test-safe focus session and keeps sub-minute sessions out of history", async () => {
    await setFastDurations(page, 1);

    await page.getByRole("button", { name: "Start" }).click();

    await expect(page.getByLabel("Pomodoro session complete")).toBeVisible({ timeout: 3_000 });

    await expect.poll(() => getViewportSize(page)).toEqual(TIMER_VIEWPORT);

    const timerCardFrame = await page.locator(".timer-card").evaluate<CardFrameSnapshot>((element) => {
      const rect = element.getBoundingClientRect();
      const styles = window.getComputedStyle(element);

      return {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
        borderRadius: Number.parseFloat(styles.borderTopLeftRadius),
        boxShadow: styles.boxShadow,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      };
    });

    expectRoundedCardFrame(timerCardFrame, TIMER_VIEWPORT, MAX_TIMER_GUTTER_PX);
    expect(timerCardFrame.borderRadius).toBeLessThanOrEqual(12);

    const sessionCompleteChildren = await page.locator(".session-complete-panel > *").evaluateAll<ElementLayoutSnapshot[]>((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();

        return {
          bottom: rect.bottom,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          text: element.textContent?.trim() ?? "",
          top: rect.top,
          width: rect.width,
        };
      }),
    );

    expect(sessionCompleteChildren.map((child) => child.text)).toEqual([
      "KURONE-KO · Session complete",
      "Goal done",
      "0 focused minutes saved",
      "1/1 focus blocks",
      "Start againHistory",
    ]);

    for (const childBounds of sessionCompleteChildren) {
      expectBoundsInsideViewport(childBounds, TIMER_VIEWPORT);
    }

    await page.getByRole("button", { name: "History", exact: true }).click();

    await expect(page.getByText("Today: 0 sessions · 0 min")).toBeVisible();
    await expect(page.getByText("0 min focus")).toHaveCount(0);
  });

  test("stops Kurone-ko Playlist when the focus session completes", async () => {
    await setFastDurations(page, 1);
    await page.getByRole("button", { name: "Play Kurone-ko Playlist" }).click();

    await expect(page.getByRole("button", { name: "Stop Kurone-ko Playlist" })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => getMusicState(page)).toMatchObject({ enabled: true, isPlaying: true, ducked: false });

    await page.getByRole("button", { name: "Start" }).click();

    await expect(page.getByLabel("Pomodoro session complete")).toBeVisible({ timeout: 3_000 });
    await expect.poll(() => getMusicState(page)).toMatchObject({ enabled: false, isPlaying: false, ducked: false });
    await expect(page.getByRole("button", { name: "Play Kurone-ko Playlist" })).toHaveAttribute("aria-pressed", "false");
  });
});
