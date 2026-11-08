# Architecture

## Process model

```text
┌──────────────────────────── Main process (Node.js) ────────────────────────────┐
│  index.ts            app lifecycle, single-instance lock, app user model id     │
│  window-manager.ts   BrowserWindow, menus, IPC registration, layout bounds     │
│  tab-manager.ts      ChatGPT WebContentsViews, RTL engine, tab persistence     │
│  side-browser-manager.ts  Split-view browser views, layout and persistence     │
│  session-manager.ts  Persistent session, permission and download policy        │
│  auto-updater.ts     electron-updater singleton, GitHub fallback, IPC events   │
└────────────────────────────────────────────────────────────────────────────────┘
             ▲ IPC (request/response + events)        ▲ WebContents events
             │                                        │
┌────────────┴───────────────┐        ┌───────────────┴────────────────────────┐
│ Renderer shell (sandboxed) │        │ ChatGPT / side-browser WebContentsViews │
│  preload: contextBridge    │        │  no preload, no Node integration        │
│  renderer: tab bar + UI    │        │  official web app / user sites          │
└────────────────────────────┘        └─────────────────────────────────────────┘
```

The renderer shell is the only page with a preload script. It renders the tab
bar, side-browser chrome and update popover. Web content is never granted
`window.api`.

## IPC contracts

All channel names live in `src/common/types.ts` (`IPC_CHANNELS`). The sandboxed
preload cannot `require` local modules, so it mirrors the channel strings as
literals; both surfaces are covered by tests.

| Area | Direction | Examples |
| --- | --- | --- |
| Tabs | renderer → main | `tabs:create`, `tabs:select`, `tabs:set-type` |
| Tabs | main → renderer | `tabs:state-update` |
| Side browser | renderer → main | `browser:set-layout`, `browser:navigate` |
| Side browser | main → renderer | `browser:state-update` |
| Window/theme | both | `theme:get`, `theme:set`, `zoom:set` |
| Updates | renderer → main | `app:check-for-updates`, `updater:start-download` |
| Updates | main → renderer | `updater:download-progress`, `updater:downloaded` |

## Sessions and security

A single persistent `Session` partition is shared by ChatGPT tabs so the user
stays signed in. Side-browser tabs use their own session so third-party cookies
do not mix with ChatGPT.

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` for web
  content.
- Navigation is restricted to an origin allowlist; `will-navigate` and
  `setWindowOpenHandler` deny everything else.
- `shell.openExternal` is only called for HTTP(S), `mailto:`, `tel:` or `sms:`.
- Permission requests are granted only to allowlisted origins.

## Arabic RTL engine

`src/main/tab-manager.ts` exports two artefacts:

1. `RTL_SCOPED_CSS` — high-specificity, scoped CSS for container direction,
   list padding, blockquote borders, table alignment and LTR isolation for
   `pre`, inline code, KaTeX and math.
2. `RTL_OBSERVER_SCRIPT` — an idempotent `MutationObserver` that samples text
   outside code blocks, classifies Arabic vs Latin content, applies `dir` to the
   container and block elements, and is throttled with `requestAnimationFrame`.
   It never throws into the host page.

The observer runs on `dom-ready`, `did-finish-load` and `did-navigate-in-page`
so streamed answers and client-side navigation stay correct.

## Update pipeline

`AppUpdater` is a singleton because `electron-updater` registers process-wide
listeners.

**Packaged builds**

1. `autoUpdater.checkForUpdates()` reads the embedded `app-update.yml` and the
   published `latest.yml` / `latest-mac.yml`.
2. If the published version is newer, it is stored as `pendingVersion` and the
   UI shows release notes.
3. `autoUpdater.downloadUpdate(token)` emits genuine `download-progress` events.
4. `update-downloaded` verifies the artifact and enables *Restart & Install*,
   which flushes tab/layout state before `quitAndInstall`.

**Failure handling**

- 404 / missing metadata / auth failure / network error is never mapped to
  "up to date".
- The unauthenticated GitHub Releases API is used only to distinguish
  "no published release" from a real failure and to fetch notes.
- Development builds have no embedded feed, so they use the GitHub API and
  disable automatic download.

## Persistence

| Store | Contents |
| --- | --- |
| `TabStateStore` | open ChatGPT tabs, active tab, type overrides |
| `SideBrowserManager` store | side-browser tabs, active tab, layout, split ratio |
| `SettingsStore` | theme, zoom, last layout |

Writes are debounced (400 ms) and flushed synchronously on window close and
before an update-driven restart.
