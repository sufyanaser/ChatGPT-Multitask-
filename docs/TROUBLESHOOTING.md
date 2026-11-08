# Troubleshooting

## The window opens but a tab stays blank

1. Check your internet connection and open <https://chatgpt.com> in a normal
   browser.
2. Use **View → Reload Tab** (`Ctrl+R`).
3. If the app was offline at launch, close and reopen it.
4. If only one tab is blank, open a new tab (`Ctrl+T`).

## Login does not persist

- The app uses one persistent session partition. Clearing site data in the
  embedded page signs you out.
- If a proxy or corporate TLS inspection is active, Chromium may reject the
  certificate. Configure the system proxy and restart the app.

## "No Published Releases" in the update popover

This is expected until the first GitHub Release exists. The app does not claim
it is up to date when the release metadata is missing. Use **View on GitHub** to
open the releases page manually.

## "The published release is missing its update metadata"

The GitHub Release exists but `latest.yml` (Windows) or `latest-mac.yml` (macOS)
was not attached, or it does not match the installer. Re-run the Release
workflow; do not publish partially built releases.

## Update check fails with a network or authentication message

- Verify connectivity to `github.com` and `api.github.com`.
- Corporate proxies and rate limits can block the GitHub API. Retry later.
- The updater never sends a GitHub token from the client.

## Automatic download is disabled

In-app background downloads require an installed, packaged build. Development
builds (`npm start`) only support **View Release**. Install the released build
to use automatic updates.

## macOS says the app is damaged or from an unidentified developer

macOS artifacts are unsigned and not notarized. This is a known limitation, not
a corrupted download.

- Verify the SHA-256 checksum against `SHA256SUMS.txt` from the same release.
- Open the DMG, drag the app to Applications, then right-click the app and
  choose **Open**.
- If Gatekeeper still blocks it, remove the quarantine attribute:

  ```bash
  xattr -dr com.apple.quarantine "/Applications/ChatGPT Multitask.app"
  ```

Only do this for a build whose checksum you have verified.

## Windows SmartScreen warning

The installer is not Authenticode-signed. Verify the SHA-256 checksum published
with the release, then choose **More info → Run anyway**.

## Split view does not appear

- Use the layout buttons in the side-browser header (Chat / Split / Browser).
- Some sites refuse to render in an embedded browser; open them in your default
  browser instead.
- If the divider is stuck, switch to Chat mode and back to Split.

## Arabic text renders left-to-right

- Reload the tab once so the RTL observer is injected.
- RTL applies to assistant markdown only, not to the ChatGPT UI chrome.
- Report a reproducible example with a screenshot if an answer still renders
  incorrectly.

## High CPU or memory use

Each ChatGPT tab and each side-browser tab is a full renderer process. Close
unused tabs. Large conversations with many code blocks cost more memory.

## Reset local state

Close the app first, then remove the application data directory:

- Windows: `%APPDATA%\chatgpt-multitask`
- macOS: `~/Library/Application Support/chatgpt-multitask`

This signs you out and removes saved tabs, layout, theme and zoom. It does not
delete any ChatGPT account data.

## Logs

Run from a terminal to see main-process logs:

```bash
npm start
```

Packaged builds do not write a log file by default. Reproduce the issue from a
terminal build when reporting a bug.
