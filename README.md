# ChatGPT Multitask

A cross-platform desktop client that wraps the official ChatGPT web app in a
native multi-tab window, with a split-view side browser, Arabic-first RTL
rendering, and built-in update checks.

> **Independent third-party project.** ChatGPT Multitask is not affiliated with,
> endorsed by, or sponsored by OpenAI. ChatGPT and the ChatGPT logo are
> trademarks of OpenAI. This application loads the official ChatGPT website in
> an embedded browser; you use your own ChatGPT account and remain subject to
> OpenAI's terms and policies.

## Features

- **Native multi-tab browsing** — each tab is an isolated `WebContentsView`
  sharing one persistent login session.
- **Split-view side browser** — open documentation or reference pages next to
  ChatGPT, with draggable divider and three layout modes (Chat, Split, Browser).
- **Arabic RTL rendering (P0)** — assistant markdown, headings, lists, tables and
  blockquotes render right-to-left; code, URLs, commands and math stay LTR;
  streamed and dynamically rendered answers are handled.
- **Conversation indicators** — neutral Chat / Work / Automatic tab badges with
  a manual override menu (never guesses a type it cannot verify).
- **Theme and zoom sync** — follows the OS theme, per-window zoom from 80% to
  150%, keyboard shortcuts for both.
- **Safe navigation** — an allowlist for embedded browsing, explicit external
  link handling, sandboxed renderer, context isolation and no Node integration
  in web content.
- **Automatic update checks** — real GitHub release metadata with a manual
  "View Release" fallback; the app never reports "up to date" when no release
  exists or a check fails.
- **Persistent workspace** — open tabs, layout, theme and zoom are restored
  after restart or an update-driven restart.

## Download

Release builds are published on the
[GitHub Releases page](https://github.com/sufyanaser/ChatGPT-Multitask-/releases).

| Platform | Artifact | Status |
| --- | --- | --- |
| Windows 10/11 x64 | `ChatGPT-Multitask-Windows-x64-Setup.exe` (NSIS) | Built and checksum-verified locally |
| macOS Apple Silicon | `ChatGPT-Multitask-macOS-arm64.dmg` / `.zip` | Built on GitHub Actions |
| macOS Intel | `ChatGPT-Multitask-macOS-x64.dmg` / `.zip` | Built on GitHub Actions |

> macOS artifacts are **unsigned and not notarized** because no Apple Developer
> certificate is available to this project. Gatekeeper will require a manual
> "Open" confirmation. Windows installers are also unsigned and may show a
> SmartScreen warning.

## Requirements

- Windows 10 or newer (x64), or macOS 11 or newer (arm64 / x64).
- An internet connection and a ChatGPT account.
- For development: Node.js 22.x and npm.

## Build from source

```bash
npm ci
npm run typecheck
npm test            # builds, then runs unit, Electron, RTL and updater suites
npm run pack:win    # Windows NSIS installer in ./release
npm run pack:mac    # macOS DMG + ZIP for arm64 and x64 (run on macOS)
```

Development run:

```bash
npm start
```

## Project structure

```text
src/
  common/types.ts        Shared IPC channels and payload types
  main/                  Electron main process
    index.ts             App lifecycle and single-instance lock
    window-manager.ts    Window, menu, IPC registration, update dialog
    tab-manager.ts       ChatGPT tabs, RTL engine, navigation policy
    side-browser-manager.ts  Split-view browser and persisted layout
    session-manager.ts   Persistent session, permissions, downloads
    auto-updater.ts      electron-updater singleton + GitHub fallback
  preload/index.ts       Sandboxed contextBridge API
  renderer/              Tab bar, side-browser chrome, update popover
scripts/                 Build, test and verification helpers
tests/                   Unit and live Electron verification suites
docs/                    Architecture, release and troubleshooting guides
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the process model, IPC
contract and update pipeline.

## Testing

`npm test` runs the full gate:

1. Unit tests for IPC contracts, URL allowlist, persistence and zoom.
2. Electron smoke test against the official ChatGPT site.
3. Live theme, zoom and tab-indicator verification.
4. Windows stabilization gate.
5. Arabic RTL acceptance and adversarial stress suites.
6. Update pipeline, popover and SemVer integrity verification.

## Release process

1. Merge validated changes into `develop`, then `main`.
2. Bump `version` in `package.json` and `package-lock.json`.
3. Update `CHANGELOG.md`.
4. Tag the release (`v3.0.0`) and push the tag.
5. The `Release` workflow builds Windows and macOS, verifies update metadata,
   and publishes the GitHub Release only if every build succeeds.

Do not publish a release from failing code. See
[docs/RELEASE.md](docs/RELEASE.md) for the exact checklist.

## Security

Please report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).
Do not open a public issue for a security problem.

## License

[MIT](LICENSE) © ChatGPT Multitask Contributors.
