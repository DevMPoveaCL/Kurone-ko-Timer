# KURONE-KO

KURONE-KO is a local-first desktop focus companion. It combines a quiet Pomodoro-style timer widget with a small dashboard for setup, onboarding, playlist control, and daily focus history, so the configuration lives away from the distraction-free work surface.

## Core features

- Floating timer widget with focus, short break, and long break phases.
- Compact dashboard for starting focus, adjusting settings, and reopening onboarding.
- Daily focus summary backed by local app storage.
- Optional KURONE-KO Playlist using bundled `.ogg` audio assets.
- Native desktop shell powered by Tauri with no account, backend, or cloud dependency.

## Screenshots

Screenshots are stored in [`docs/screenshots/`](docs/screenshots/).

| Dashboard | Timer widget |
| --- | --- |
| ![KURONE-KO dashboard](docs/screenshots/dashboard.png) | ![KURONE-KO timer widget](docs/screenshots/timer-widget.png) |

If the image files are not present yet, see [`docs/screenshots/README.md`](docs/screenshots/README.md) for the expected capture list.

## Tech stack

- Tauri 2 + Rust native shell
- React 19 + TypeScript
- Zustand 5 for local UI state
- Vite for development
- Vitest + Testing Library for unit/component coverage
- Playwright for Tauri/WebView E2E coverage

## Prerequisites

- Node.js and npm
- Rust toolchain
- Tauri 2 platform prerequisites for your operating system
- Microsoft Edge WebView2 Runtime on Windows

## Install and development

Install dependencies:

```bash
npm install
```

Run the Vite web dev server:

```bash
npm run dev
```

Run the native Tauri development app:

```bash
npm run tauri dev
```

## Verification

Run unit/component tests:

```bash
npm test
```

Run TypeScript checks:

```bash
npx tsc --noEmit
```

Run the native E2E suite:

```bash
npm run test:e2e
```

### E2E notes

The Playwright E2E suite starts `npm run tauri dev` with WebView2 remote debugging enabled and connects to the real Tauri WebView over CDP. Port `9222` must be free unless you provide `KURONE_KO_CDP_ENDPOINT` with a different endpoint.

Generated Playwright reports and `test-results/` are local artifacts and should not be committed.

## Project structure

```text
docs/screenshots/               Public README screenshots
public/audio/kuroneko-playlist/ Bundled local playlist assets
src/                            React application source
src/e2e/                        Browser-exposed E2E driver helpers
src/features/                   Feature modules for dashboard, timer, music, settings, and history
src/shared/                     Shared hydration/window utilities
src-tauri/                      Tauri shell, config, icons, and Rust source
tests/e2e/                      Playwright E2E tests for the native app
```

## Public repository safety

KURONE-KO does not require checked-in secrets, API keys, accounts, signing credentials, or environment files for development. Keep local `.env*`, build output, Playwright reports, `test-results/`, and Rust target artifacts out of version control.

## v1.0 status

Version `1.0.0` is the public baseline for the local desktop focus companion: dashboard, timer widget, local focus history, onboarding, settings, bundled playlist support, and automated verification are in place.

## License

Released under the [MIT License](LICENSE).
