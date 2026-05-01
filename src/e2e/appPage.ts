export interface KuroneKoE2EPage {
  evaluate: <Result>(callback: () => Result | Promise<Result>) => Promise<Result>;
  label?: string;
  url: () => string;
}

export interface KuroneKoE2EContext<PageType extends KuroneKoE2EPage> {
  pages: () => PageType[];
}

export interface KuroneKoE2EBrowser<PageType extends KuroneKoE2EPage> {
  contexts: () => Array<KuroneKoE2EContext<PageType>>;
}

export interface WaitForKuroneKoAppPageOptions {
  label?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

interface KuroneKoE2EWindow {
  __KURONE_KO_E2E__?: {
    getWindowLabel?: () => Promise<string> | string;
  };
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_POLL_INTERVAL_MS = 100;

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const hasKuroneKoE2EDriver = async (page: KuroneKoE2EPage): Promise<boolean> => {
  try {
    return await page.evaluate(() => (window as Window & KuroneKoE2EWindow).__KURONE_KO_E2E__ !== undefined);
  } catch {
    return false;
  }
};

const readWindowLabel = async (page: KuroneKoE2EPage): Promise<string | null> => {
  try {
    return await page.evaluate(async () => {
      const driver = (window as Window & KuroneKoE2EWindow).__KURONE_KO_E2E__;

      return (await driver?.getWindowLabel?.()) ?? null;
    });
  } catch {
    return null;
  }
};

const matchesWindowLabel = async (page: KuroneKoE2EPage, label?: string): Promise<boolean> => {
  if (label === undefined) {
    return true;
  }

  if (page.label === label) {
    return true;
  }

  const runtimeLabel = await readWindowLabel(page);

  if (runtimeLabel !== null) {
    page.label = runtimeLabel;
  }

  return runtimeLabel === label;
};

export const waitForKuroneKoAppPage = async <PageType extends KuroneKoE2EPage>(
  browser: KuroneKoE2EBrowser<PageType>,
  options: WaitForKuroneKoAppPageOptions = {},
): Promise<PageType> => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const label = options.label;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const pages = browser.contexts().flatMap((context) => context.pages());

    for (const page of pages) {
      if ((await matchesWindowLabel(page, label)) && (await hasKuroneKoE2EDriver(page))) {
        return page;
      }
    }

    await delay(pollIntervalMs);
  }

  throw new Error("Timed out waiting for the KURONE-KO app page with the E2E driver");
};
