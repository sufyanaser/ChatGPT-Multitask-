# Changelog

All notable changes to ChatGPT Multitask are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [3.0.0] - 2026-11-10

First stable release. The version moves from 0.2.1 directly to 3.0.0.

### Fixed

- Controls in ChatGPT's own header and sidebar toolbars (Search, Sidebar
  toggle and other non-`<button>` controls) did not respond to clicks.
  chatgpt.com declares `-webkit-app-region: drag` on those toolbars; a browser
  tab ignores it, but inside the app's hidden-titlebar window the area was
  treated as window caption and the click never reached the page. Hosted pages
  can no longer declare window drag regions; the window is dragged from the
  app's tab bar only.
- Tab drag-and-drop reordered the wrong tabs after any tab had been closed or
  moved.
- The split divider no longer hides the ChatGPT and browser views while it is
  dragged; both panes resize live and the ratio is saved on release.
- The Arabic RTL stylesheet was re-inserted on every in-page navigation,
  stacking a duplicate per conversation switch. It is now inserted once per
  document.

### Changed

- Tab strip: tabs shrink from 200px to a 76px floor (the active tab keeps
  132px), then the strip scrolls with the mouse wheel, fades at the edges and
  keeps the active tab in view.
- Restored tabs load lazily: only the active tab navigates at startup, the
  others on first selection.
- Opening a link to a conversation that is already open focuses its tab
  instead of creating a duplicate. New tabs (`Ctrl+T`, the `+` button) are
  always independent.
- Refined tab bar appearance in light and dark themes: clearer active tab,
  separators, hover / pressed / focus states, consistent icon size, and
  reduced-motion support.
- Releases with a version below 1.0 or a pre-release suffix are published as
  GitHub pre-releases; all others as stable.

### Known issues

- While the update popover is open, the content area narrows by about 340px.
- Windows builds are unsigned and may trigger SmartScreen. macOS builds are
  unsigned and not notarized; automatic update on macOS is not validated.
- Pointer-level interaction tests run on Linux only. Windows and macOS rely on
  the manual checklist in `docs/RELEASE.md`.

## [0.2.1] - 2026-11-08

Pre-release. Not a stable release.

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
- Theme switching was re-verified with the existing theme/zoom checks; no code
  change was required.

### Known issues

- Search and the Sidebar toggle inside ChatGPT did not respond after sign-in in
  one report. The cause is not confirmed; it needs a check on Windows with a
  signed-in account.
- Split view: while the update popover is open, the chat content narrows by
  about 340px. The divider drag hides the ChatGPT view and it resizes on
  release rather than live.
- Update popover: the popover reserves a strip of the content area while open.
- Interactive tests on macOS are not complete. The Windows and macOS packages
  were built by CI but not exercised by hand.

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
