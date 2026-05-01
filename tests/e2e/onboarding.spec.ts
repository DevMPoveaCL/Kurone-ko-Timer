import { chromium, expect, test, type Browser, type Page } from "@playwright/test";
import { waitForKuroneKoAppPage } from "../../src/e2e/appPage";

const CDP_ENDPOINT = process.env.KURONE_KO_CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const ONBOARDING_DISMISSED_STORAGE_KEY = "kurone-ko.onboarding.dismissed";

interface KuroneKoE2EDriver {
  isWindowVisible: (label: string) => Promise<boolean> | boolean;
  reset: () => Promise<void> | void;
}

interface KuroneKoWindow extends Window {
  __KURONE_KO_E2E__?: KuroneKoE2EDriver;
}

const isWindowVisible = async (page: Page, label: string): Promise<boolean> =>
  page.evaluate(async (windowLabel) => {
    const driver = (window as KuroneKoWindow).__KURONE_KO_E2E__;

    if (driver === undefined) {
      throw new Error("KURONE-KO E2E driver is not available");
    }

    return driver.isWindowVisible(windowLabel);
  }, label);

const resetE2EState = async (page: Page) => {
  await page.evaluate(async () => {
    const driver = (window as KuroneKoWindow).__KURONE_KO_E2E__;

    if (driver === undefined) {
      throw new Error("KURONE-KO E2E driver is not available");
    }

    await driver.reset();
  });
};

test.describe("guided dashboard onboarding", () => {
  let browser: Browser;
  let page: Page;

  test.beforeAll(async () => {
    browser = await chromium.connectOverCDP(CDP_ENDPOINT);
    page = await waitForKuroneKoAppPage(browser, { label: "dashboard" });
  });

  test.afterAll(async () => {
    await browser?.close();
  });

  test.beforeEach(async () => {
    const timerPage = await waitForKuroneKoAppPage(browser, { label: "timer" });

    if (await isWindowVisible(timerPage, "timer")) {
      await timerPage.getByRole("button", { name: "Return to dashboard" }).click();
    }

    page = await waitForKuroneKoAppPage(browser, { label: "dashboard" });
    await expect.poll(() => isWindowVisible(page, "dashboard")).toBe(true);
    await resetE2EState(page);
    await page.evaluate((key) => window.localStorage.removeItem(key), ONBOARDING_DISMISSED_STORAGE_KEY);
    await page.reload();
    await expect(page.getByLabel("KURONE-KO dashboard")).toBeVisible();
  });

  test("shows first-launch onboarding, persists dismissal, and reopens from Instructions", async () => {
    await expect(page.getByRole("dialog", { name: "Welcome to KURONE-KO" })).toBeVisible();

    await page.getByLabel("No volver a mostrar").check();
    await page.getByRole("button", { name: "Start focusing" }).click();

    await expect(page.getByRole("dialog", { name: "Welcome to KURONE-KO" })).toBeHidden();
    await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), ONBOARDING_DISMISSED_STORAGE_KEY)).toBe("true");

    await page.reload();
    await expect(page.getByRole("dialog", { name: "Welcome to KURONE-KO" })).toHaveCount(0);

    await page.getByRole("button", { name: "Instructions" }).click();

    await expect(page.getByRole("dialog", { name: "Welcome to KURONE-KO" })).toBeVisible();
    await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), ONBOARDING_DISMISSED_STORAGE_KEY)).toBe("false");
  });

  test("opens the configuration shell from the dashboard", async () => {
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Configuration" }).click();

    await expect(page.getByRole("heading", { name: "Configuration" })).toBeVisible();
    await expect(page.getByLabel("Focus minutes")).toHaveValue("25");
    await expect(page.getByRole("button", { name: "AI integration unavailable" })).toBeVisible();
  });

  test("starts the distraction-free focus widget from the dashboard", async () => {
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Start Focus" }).click();

    const timerPage = await waitForKuroneKoAppPage(browser, { label: "timer" });
    await expect.poll(() => isWindowVisible(timerPage, "timer")).toBe(true);
    await expect.poll(() => isWindowVisible(timerPage, "dashboard")).toBe(false);
    await expect(timerPage.getByLabel("KURONE-KO focus timer; drag empty areas to move")).toBeVisible();
    await expect(timerPage.getByRole("button", { name: "Show settings" })).toHaveCount(0);
    await expect(timerPage.getByRole("button", { name: "Return to dashboard" })).toBeVisible();
    await expect(timerPage.getByRole("button", { name: "Minimize widget" })).toBeVisible();

    await timerPage.getByRole("button", { name: "Return to dashboard" }).click();
    await expect.poll(() => isWindowVisible(page, "dashboard")).toBe(true);
  });
});
