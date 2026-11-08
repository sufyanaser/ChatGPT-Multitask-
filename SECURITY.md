# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.2.x | Yes |
| 0.1.x | No |

## Reporting a vulnerability

Please **do not** open a public issue for a security problem.

Report it privately through GitHub's
[private vulnerability reporting](https://github.com/sufyanaser/ChatGPT-Multitask-/security/advisories/new)
or by contacting the repository owner directly. Include:

- affected version and platform;
- steps to reproduce;
- impact and any proof-of-concept;
- whether the issue also affects the upstream ChatGPT website.

You can expect an acknowledgement within a few days. Valid reports will be
fixed on `develop` and disclosed after a patched release is available.

## Security model

- The renderer shell is sandboxed with `contextIsolation: true`,
  `nodeIntegration: false` and a narrow `contextBridge` API.
- ChatGPT and side-browser content run in separate `WebContentsView`s with no
  Node integration and no preload script.
- Embedded navigation is limited to allowlisted origins. Unknown schemes are
  blocked; only `mailto:`, `tel:` and `sms:` are handed to the operating system.
- The application shell cannot be navigated away from its local file or spawn
  additional `BrowserWindow`s.
- Permissions are granted only to allowlisted origins and only for media,
  clipboard, notifications and fullscreen.
- The updater uses the published `latest.yml` / `latest-mac.yml` metadata and
  verifies the SHA-512 and size of downloaded artifacts before installation.
- GitHub API fallback checks are unauthenticated and never send a token.

## Known limitations

- Windows installers are not Authenticode-signed.
- macOS builds are not code-signed or notarized because no Apple Developer
  certificate is available. Gatekeeper requires a manual open confirmation and
  macOS auto-update cannot be validated without a signed build.
- The application loads the official ChatGPT website; account security and
  server-side behaviour remain the responsibility of OpenAI.
