import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import rawTauriConfig from "../src-tauri/tauri.conf.json";

interface TauriWindowConfig {
  label: string;
  width: number;
  height: number;
  transparent?: boolean;
  shadow?: boolean;
}

interface TauriConfig {
  app: {
    windows: TauriWindowConfig[];
  };
}

const tauriConfig: TauriConfig = rawTauriConfig;
const appCss = readFileSync(new URL("./App.css", import.meta.url), "utf8");
const dashboardCss = readFileSync(new URL("./features/dashboard/components/Dashboard.css", import.meta.url), "utf8");

const getCssBlock = (css: string, selector: string): string => {
  const selectorStart = css.startsWith(`${selector} {`) ? 0 : css.indexOf(`\n${selector} {`);

  if (selectorStart === -1) {
    throw new Error(`Missing CSS selector: ${selector}`);
  }

  const blockStart = css.indexOf("{", selectorStart);
  const blockEnd = css.indexOf("}", blockStart);

  if (blockStart === -1 || blockEnd === -1) {
    throw new Error(`Malformed CSS block: ${selector}`);
  }

  return css.slice(blockStart + 1, blockEnd);
};

const getPixelValue = (block: string, property: string): number => {
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escapedProperty}:\\s*(?<value>\\d+)px`, "u").exec(block);

  if (match?.groups?.value === undefined) {
    throw new Error(`Missing pixel property: ${property}`);
  }

  return Number(match.groups.value);
};

const getWindowConfig = (label: string): TauriWindowConfig => {
  const windowConfig = tauriConfig.app.windows.find((candidate) => candidate.label === label);

  if (windowConfig === undefined) {
    throw new Error(`Missing Tauri window config: ${label}`);
  }

  return windowConfig;
};

describe("window frame visual polish", () => {
  it("enables native shadow without changing fixed window dimensions", () => {
    expect(getWindowConfig("dashboard")).toMatchObject({
      width: 360,
      height: 640,
      transparent: true,
      shadow: true,
    });
    expect(getWindowConfig("timer")).toMatchObject({
      width: 300,
      height: 150,
      transparent: true,
      shadow: true,
    });
  });

  it("tightens timer chrome while retaining a visible shadow fallback", () => {
    const timerCard = getCssBlock(appCss, ".timer-card");

    expect(getPixelValue(timerCard, "border-radius")).toBeLessThanOrEqual(12);
    expect(timerCard).toContain("box-shadow: 0 0 12px rgba(0, 0, 0, 0.48)");
  });

  it("keeps timer duration dropdown scrollbars aligned with the modern dark chrome", () => {
    expect(appCss).toContain(".timer-duration-list");
    expect(appCss).toContain(".timer-duration-dropdown");
    expect(appCss).toContain("scrollbar-color: rgba(231, 160, 184, 0.46) rgba(255, 255, 255, 0.06)");
    expect(appCss).toContain(".timer-duration-dropdown::-webkit-scrollbar-thumb");
  });

  it("removes session-complete decorative chrome and compacts its readable content", () => {
    const completePanel = getCssBlock(appCss, ".session-complete-panel");
    const completeTitle = getCssBlock(appCss, ".complete-title");
    const completeSummary = getCssBlock(appCss, ".complete-summary");
    const completeNextStep = getCssBlock(appCss, ".complete-next-step");
    const eyebrow = getCssBlock(appCss, ".eyebrow");
    const controlButton = getCssBlock(appCss, ".control-button");

    expect(appCss).not.toContain(".session-complete-panel::before");
    expect(getPixelValue(completePanel, "gap")).toBeLessThanOrEqual(3);
    expect(getPixelValue(completePanel, "padding-top")).toBeLessThanOrEqual(6);
    expect(completeTitle).toContain("font-size: 1.1rem");
    expect(completeSummary).toContain("font-size: 0.58rem");
    expect(completeNextStep).toContain("font-size: 0.56rem");
    expect(eyebrow).toContain("font-size: 0.54rem");
    expect(getPixelValue(controlButton, "min-width")).toBeLessThanOrEqual(56);
    expect(controlButton).toContain("padding: 4px 8px");
  });

  it("tightens dashboard chrome while retaining a visible shadow fallback", () => {
    const dashboardShell = getCssBlock(dashboardCss, ".dashboard-shell");
    const dashboardCard = getCssBlock(dashboardCss, ".dashboard-card");

    expect(getPixelValue(dashboardShell, "padding")).toBeLessThanOrEqual(8);
    expect(getPixelValue(dashboardCard, "border-radius")).toBeLessThanOrEqual(14);
    expect(dashboardCard).toContain("box-shadow: 0 0 12px rgba(0, 0, 0, 0.48)");
  });
});
