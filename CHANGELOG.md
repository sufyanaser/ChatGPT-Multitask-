# Changelog

All notable changes to ChatGPT Multitask are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- Split-view divider was never visible: the renderer toggled an inline
  `display` that the global `.hidden { display: none !important }` rule
  overrode. Visibility is now a class toggle.
- Split divider drag stalled as soon as the pointer crossed onto a
  `WebContentsView`. Views are detached for the duration of the drag and
  re-attached on release; the chat and browser views are separated by a 6px
  gutter so the divider is hittable.
- Update popover was covered by the ChatGPT view below the tab strip. While the
  popover is open, the views reserve its horizontal strip; position and update
  state logic are unchanged.
- Right-click context menu was absent in ChatGPT and side-browser views.
  Links, images, editable fields and text selection now offer the matching
  actions. Keyboard shortcuts are unchanged.

## [0.2.0] - 2026-11-08

### Added

- Arabic-first bidirectional rendering engine for assistant markdown:
  paragraphs, headings, lists, blockquotes, tables and streamed responses are
  detected automatically; code, URLs, commands and math remain LTR.
- Split-view side browser with independent tabs, draggable divider and Chat /
  Split / Browser layout modes, persisted across restarts.
- Seven-state update popover with real download progress, cancellation, release
  notes and a manual "View Release" path.
- `GET_APP_VERSION` IPC channel and dynamic version badge in the renderer.
- Update-download cancellation and a dedicated canceled state that is not
  reported as an error.
- macOS Intel (`x64`) DMG and ZIP targets alongside Apple Silicon (`arm64`).
- Documentation: README, changelog, security policy, contributing guide,
  architecture, release and troubleshooting guides.

### Changed

- The updater is now a process-wide singleton; packaged builds treat
  electron-updater metadata as authoritative and use the GitHub API only for
  diagnosis and release notes.
- Update checks never report "up to date" for a 404, missing `latest.yml` /
  `latest-mac.yml`, authentication failure or network error.
- Tabs and side-browser state are flushed before an update-driven restart.
- External navigation from web content is restricted to HTTP(S) inside the app;
  only `mailto:`, `tel:` and `sms:` are handed to the operating system.
- Packaging scripts always pass `--publish never`; publication is performed by
  the `Release` workflow only after every build succeeds.
- `npm run clean` no longer deletes existing `release/` artifacts; use
  `npm run clean:all` for a full clean.

### Fixed

- The sandboxed preload script no longer requires a local module, restoring all
  `window.api` functionality in packaged builds.
- Closing a tab or the window during navigation no longer logs expected
  `ERR_ABORTED` / `ERR_FAILED (-2)` cancellations as failures.
- Web content can no longer navigate the application shell or spawn arbitrary
  `BrowserWindow`s.
- Secondary update buttons are correctly hidden by a global `.hidden` utility.
- The update popover is clamped both horizontally and vertically on short or
  narrow windows.
- Duplicate view listeners and duplicate updater instances were removed.

### Security

- Renderer remains sandboxed with context isolation and no Node integration.
- Session permissions are limited to media, clipboard, notifications and
  fullscreen for allowlisted origins.
- Unknown URL schemes are blocked instead of being passed to `shell.openExternal`.

## [0.1.0] - 2026-11-08

### Added

- Initial Windows x64 NSIS release.
- Native multi-tab ChatGPT client with persistent session.
- Compact Chat / Work / Automatic tab indicators.
- Theme synchronisation, zoom controls and split-view side browser.
- GitHub-based update check and update popover.
