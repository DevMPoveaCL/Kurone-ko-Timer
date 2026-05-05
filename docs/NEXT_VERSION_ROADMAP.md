# Kurone-ko Timer — Next Version Roadmap

This document captures proposed improvements for the next Kurone-ko Timer versions after `v1.0.0`.

## Current Baseline

- `v1.1.0` — Identity, UX polish, keyboard shortcuts, window position sync.
- Windows installers are available in the GitHub Release as `.msi` and `.exe` assets.
- CI validates tests (26 files, 175 tests) and TypeScript checks.
- Manual Windows release workflow builds installers and can attach them to an existing release.

## v1.1.0 — Identity and UX Polish ✅

Goal: make the app feel more intentional, branded, and polished without changing the core timer behavior.

### App identity ✅

- Kurone-ko mascot (black cat + pink cap/K) as dashboard hero.
- All icons branded via `tauri icon` CLI from master PNG.
- Icon visible in taskbar, Start Menu, window, and installer metadata.

### UI polish ✅

- "Start Session" button centered, renamed from "Start Focus".
- Typography: Inter → Nunito (warm, rounded, crisp on Windows). M PLUS Rounded 1c rejected (poor Latin hinting).
- Dashboard layout: mascot hero (no text branding), compact spacing, full-bleed window.
- Focus summary redesigned (removed box that looked like a button).
- Footer: "Developed by DevMPoveaCL".
- Settings renamed from "Configuration". "Methods" → "Zettelkasten".
- Unified scrollbar CSS (DRY): grouped selectors, no JSX changes.
- Keyboard focus indicators (`:focus-visible` with rose outline).
- Exit button (✕) with proper music cleanup via `onCloseRequested`.

### Keyboard shortcuts ✅

- Timer: `S` (start/pause/resume), `R` (reset), `M` (music), `H` (history), `Escape` (dashboard).
- Dashboard: `S` (settings), `I` (instructions), `H` (shortcuts reference), `Escape` (back).
- Global: `Ctrl+Arrows` (move window), `Escape` (close panels).
- Shortcuts reference panel (`?` button → `H` key).
- Three guardrails: input blocking, modal blocking, Ctrl bypass.
- Auto-focus on startup (no click needed).

### Window position sync ✅

- Windows remember positions across switches (localStorage).
- Centered on each other when switching (hide → position → show, no flicker).
- Clamped to monitor bounds (can't drag off-screen, 80ms debounce).
- `currentMonitor()` for multi-resolution support (tested 1366×768 through 4K).
- ACL permissions fixed (`allow-set-position`, `allow-close`, `allow-destroy`).
- Rust `position_window` command as positioning backend.

### Onboarding & instructions ✅

- Updated text reflecting built-in playlist and upcoming features.
- "Start focusing" → "Got it" + X close button.
- Escape and arrow keys work in modals.

### Cross-window reactivity ✅

- Dashboard refreshes history when timer completes a session (Tauri event `history-updated`).
- `onFocusChanged` for reliable focus detection (replaced unreliable `window.focus`).

### Release validation ✅

- Builds: NSIS `.exe` and WiX `.msi` with branded icons.
- Smoke tested via `npm run tauri dev`.

## v1.2.0 — Spotify Playlist Integration

Goal: allow users to connect focus sessions with music while avoiding heavy bundled audio assets.

### Discovery first

- Investigate Spotify Web API requirements.
- Decide whether Kurone-ko needs full authentication or can start with curated external playlist links.
- Compare tradeoffs:
  - curated public Kurone-ko playlist links: simpler, lighter, less control
  - user Spotify integration: richer, requires OAuth and token handling

### Possible features

- Open a curated Kurone-ko focus playlist.
- Let users configure their own playlist URL.
- Later: Spotify OAuth to read/play user playlists if product value justifies the complexity.

### Risks

- Spotify API authentication increases implementation and security complexity.
- Playback control may require Spotify Premium depending on API usage.
- External service dependency means some features may not work offline.

## v1.3.0 — Personalization

Goal: make Kurone-ko feel more personal without bloating the app.

- Custom focus/break durations.
- Optional session labels.
- Lightweight preferences persistence.
- Optional sound/theme settings.
- Maintain simple defaults so the app still works immediately.

## Backlog

- Improve release notes template.
- Add screenshots of the installed Windows app.
- Consider signing Windows installers in the future.
- Consider E2E testing later, but only after the core UI stabilizes.
- Audit final installer size if it grows beyond roughly 100–200 MB.

## Principles for Future Work

- Do not add complexity before the user value is clear.
- Prefer small PRs with one clear purpose.
- Keep `main` protected and release builds reproducible.
- Do not commit generated installers or build artifacts to the repository.
- Validate releases with both automated checks and manual smoke tests.
