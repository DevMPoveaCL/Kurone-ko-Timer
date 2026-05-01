# Kurone-ko Timer — Next Version Roadmap

This document captures proposed improvements for the next Kurone-ko Timer versions after `v1.0.0`.

## Current Baseline

- `v1.0.0` is published publicly on GitHub.
- Windows installers are available in the GitHub Release as `.msi` and `.exe` assets.
- CI validates tests and TypeScript checks.
- Manual Windows release workflow builds installers and can attach them to an existing release.

## v1.1.0 — Identity and UX Polish

Goal: make the app feel more intentional, branded, and polished without changing the core timer behavior.

### App identity

- Add a Kurone-ko logo/mascot.
- Replace the default app icons with branded Kurone-ko icons:
  - Windows `.ico`
  - macOS `.icns`
  - PNG sizes used by Tauri
- Verify the icon appears correctly in:
  - installed app
  - Windows Start Menu
  - taskbar
  - installer metadata

### UI polish

- Fix the initial `Start focusing` button alignment/centering issue.
- Review spacing, typography, and button states in the first-run/dashboard view.
- Keep the compact floating timer readable and non-intrusive.
- Preserve the current visual personality: warm, focused, minimal, and cat-themed.

### Release validation

- Rebuild Windows installers.
- Smoke test installation using the `.exe` NSIS installer.
- Confirm the release workflow still runs without warnings.

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
