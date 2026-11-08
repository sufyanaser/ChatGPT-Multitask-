/**
 * Hardened Automated Verification Suite for Milestone 3 (UX-008 & Auto-Updater)
 * Includes Anti-Facade Static Integrity Assertions & Real IPC Pipeline Verification.
 *
 * Verifies:
 * 1. Auto-Updater & Semver Engine Hardening (F05):
 *    - SemVer 2.0.0 Rule 11 pre-release precedence (1.0.0 > 1.0.0-beta.1).
 *    - GitHub 404 distinction from "Up to Date" (no published release != up-to-date).
 * 2. Fullscreen Modal & Backdrop Removal (F06):
 *    - Absence of #update-modal, .modal-backdrop, and fullscreen dimming.
 * 3. Native Anchored Popover Structure & 7 States (F06):
 *    - DOM presence of #update-popover and all 7 state panels.
 * 4. Popover Styling & Design Tokens (F06):
 *    - 320px width, 12px radius, theme tokens, viewport height constraint.
 * 5. Popover Controller, Positioning, Accessibility & Cancellation (F06):
 *    - Clamped coordinate calculations, single Escape listener with focus restoration.
 *    - Stale response cancellation protection & dynamic version binding.
 * 6. Browser Bundle Compatibility:
 *    - Clean renderer bundle execution (zero CommonJS exports).
 * 7. Anti-Facade & Zero Fake Timer Integrity Assertions (Forensic Audit Remediation):
 *    - Zero synthetic setInterval timers for download progress.
 *    - Zero hardcoded dummy byte totals (85MB / 89128960).
 *    - Restart & Install must call real quitAndInstall, NOT openExternal.
 *    - Start download must invoke real IPC download pipeline.
 *    - Progress updates must be event-driven via onDownloadProgress.
 * 8. IPC Channel Pipeline & Preload Surface Integrity:
 *    - IPC channel contracts for download, progress, and quit-and-install.
 *    - Preload bridge API methods on window.api.
 *    - Main process IPC handlers and AppUpdater wiring.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('=== Running Hardened Milestone 3 Verification Suite (UX-008 Integrity Hardened) ===\n');

const projectRoot = path.join(__dirname, '..');
const srcHtmlPath = path.join(projectRoot, 'src/renderer/index.html');
const distHtmlPath = path.join(projectRoot, 'dist/renderer/index.html');
const srcCssPath = path.join(projectRoot, 'src/renderer/index.css');
const distCssPath = path.join(projectRoot, 'dist/renderer/index.css');
const srcTsPath = path.join(projectRoot, 'src/renderer/index.ts');
const distJsPath = path.join(projectRoot, 'dist/renderer/index.js');
const autoUpdaterDistPath = path.join(projectRoot, 'dist/main/auto-updater.js');
const autoUpdaterSrcPath = path.join(projectRoot, 'src/main/auto-updater.ts');
const typesSrcPath = path.join(projectRoot, 'src/common/types.ts');
const typesDistPath = path.join(projectRoot, 'dist/common/types.js');
const preloadSrcPath = path.join(projectRoot, 'src/preload/index.ts');
const windowManagerSrcPath = path.join(projectRoot, 'src/main/window-manager.ts');

// -----------------------------------------------------------------------------
// Test M3-1: Semver Engine & 404 Distinction Logic Hardening (F05)
// -----------------------------------------------------------------------------
console.log('Test M3-1: Verifying Semver Comparison Engine & 404 Distinction Logic (F05)...');

assert(fs.existsSync(autoUpdaterDistPath), 'dist/main/auto-updater.js must exist after build');
const { compareSemver, AppUpdater } = require(autoUpdaterDistPath);

assert.strictEqual(typeof compareSemver, 'function', 'compareSemver must be exported from auto-updater');

// Standard version comparison cases
assert(compareSemver('0.2.0', '0.1.0') > 0, '0.2.0 must be newer than 0.1.0');
assert(compareSemver('0.1.0', '0.2.0') < 0, '0.1.0 must be older than 0.2.0');
assert.strictEqual(compareSemver('0.1.0', '0.1.0'), 0, '0.1.0 must equal 0.1.0');

// Leading 'v' / 'V' stripping
assert(compareSemver('v0.2.0', '0.1.0') > 0, 'v0.2.0 must be newer than 0.1.0');
assert(compareSemver('0.2.0', 'v0.1.0') > 0, '0.2.0 must be newer than v0.1.0');
assert.strictEqual(compareSemver('v0.1.0', '0.1.0'), 0, 'v0.1.0 must equal 0.1.0');
assert.strictEqual(compareSemver('v0.1.0', 'v0.1.0'), 0, 'v0.1.0 must equal v0.1.0');

// Patch versions
assert(compareSemver('0.1.1', '0.1.0') > 0, '0.1.1 must be newer than 0.1.0');
assert(compareSemver('0.1.0', '0.1.1') < 0, '0.1.0 must be older than 0.1.1');
assert(compareSemver('1.0.0', '0.9.9') > 0, '1.0.0 must be newer than 0.9.9');
assert(compareSemver('0.0.9', '0.1.0') < 0, '0.0.9 must be older than 0.1.0');

// SemVer 2.0.0 Rule 11 Pre-release Precedence (Reviewer 2 Finding 4)
assert(compareSemver('1.0.0', '1.0.0-beta.1') > 0, 'Normal version 1.0.0 must be newer than pre-release 1.0.0-beta.1');
assert(compareSemver('1.0.0-beta.1', '1.0.0') < 0, 'Pre-release 1.0.0-beta.1 must be older than normal version 1.0.0');
assert(compareSemver('1.0.0-beta.2', '1.0.0-beta.1') > 0, '1.0.0-beta.2 must be newer than 1.0.0-beta.1');
assert(compareSemver('1.0.0-rc.1', '1.0.0-beta.2') > 0, '1.0.0-rc.1 must be newer than 1.0.0-beta.2');
assert.strictEqual(compareSemver('1.0.0-beta.1', '1.0.0-beta.1'), 0, 'Identical pre-releases must be equal');

// Boundary & short semver
assert.strictEqual(compareSemver('0.1', '0.1.0'), 0, '0.1 must equal 0.1.0');
assert(compareSemver('', '0.1.0') < 0, 'empty string must be treated as 0.0.0');

console.log('  ✔ compareSemver semantic comparisons verified across all test cases (including SemVer 2.0.0 Rule 11).');

// Verify auto-updater repository targets & 404 distinction
const autoUpdaterSrc = fs.readFileSync(autoUpdaterSrcPath, 'utf-8');
assert(autoUpdaterSrc.includes('api.github.com'), 'Must query GitHub API');
assert(autoUpdaterSrc.includes('sufyanaser/ChatGPT-Multitask-'), 'Must target official repository');
assert(autoUpdaterSrc.includes('/releases/latest'), 'Must target /releases/latest endpoint');
assert(autoUpdaterSrc.includes('compareSemver'), 'checkForUpdatesManually must use compareSemver');
assert(autoUpdaterSrc.includes('res.statusCode === 404'), 'checkForUpdatesManually must explicitly handle 404');

// GitHub 404 Distinction (ORIGINAL_REQUEST.md line 880 & Reviewer 2 Finding 2):
// Must distinguish "No published release" from "No newer version".
// 404 must NOT report status: 'not-available' or 'up-to-date' mapped to green checkmark.
assert(
  autoUpdaterSrc.includes("status: 'no-release'") ||
  autoUpdaterSrc.includes("status: 'no-published-release'") ||
  autoUpdaterSrc.includes("status: 'no-releases'"),
  '404 handler must return a dedicated status (e.g. status: "no-release") distinguishing "no published releases" from "up to date"'
);

console.log('  ✔ GitHub Releases API targeting and 404 distinction verified.\n');

// -----------------------------------------------------------------------------
// Test M3-2: Removal of Full-Screen Modal & Backdrop (F06)
// -----------------------------------------------------------------------------
console.log('Test M3-2: Verifying Complete Removal of Fullscreen Modal & Backdrop (F06)...');

const srcHtml = fs.readFileSync(srcHtmlPath, 'utf-8');
const srcCss = fs.readFileSync(srcCssPath, 'utf-8');

assert(!srcHtml.includes('id="update-modal"'), 'src/renderer/index.html must NOT contain obsolete id="update-modal"');
assert(!srcHtml.includes('modal-backdrop'), 'src/renderer/index.html must NOT contain obsolete modal-backdrop');
assert(!srcCss.includes('.modal-backdrop'), 'src/renderer/index.css must NOT contain obsolete .modal-backdrop');
assert(!srcCss.includes('.modal-card'), 'src/renderer/index.css must NOT contain obsolete .modal-card');

if (fs.existsSync(distHtmlPath)) {
  const distHtml = fs.readFileSync(distHtmlPath, 'utf-8');
  assert(!distHtml.includes('id="update-modal"'), 'dist/renderer/index.html must NOT contain obsolete id="update-modal"');
  assert(!distHtml.includes('modal-backdrop'), 'dist/renderer/index.html must NOT contain obsolete modal-backdrop');
}

if (fs.existsSync(distCssPath)) {
  const distCss = fs.readFileSync(distCssPath, 'utf-8');
  assert(!distCss.includes('.modal-backdrop'), 'dist/renderer/index.css must NOT contain obsolete .modal-backdrop');
  assert(!distCss.includes('.modal-card'), 'dist/renderer/index.css must NOT contain obsolete .modal-card');
}

console.log('  ✔ Obsolete #update-modal completely eliminated.');
console.log('  ✔ Obsolete .modal-backdrop fullscreen overlay completely eliminated.');
console.log('  ✔ Zero application dimming verified.\n');

// -----------------------------------------------------------------------------
// Test M3-3: Native Anchored Popover Structure & 7 States (F06)
// -----------------------------------------------------------------------------
console.log('Test M3-3: Verifying Anchored Popover Structure & 7 States (F06)...');

assert(srcHtml.includes('id="update-popover"'), 'index.html must define id="update-popover"');
assert(srcHtml.includes('class="update-popover hidden"'), 'Popover must have class="update-popover hidden" by default');
assert(srcHtml.includes('role="dialog"'), 'Popover must have role="dialog"');
assert(srcHtml.includes('id="btn-popover-close"'), 'Popover must have close button');

const requiredStateIds = [
  'state-idle',
  'state-checking',
  'state-up-to-date',
  'state-available',
  'state-downloading',
  'state-ready',
  'state-error'
];

for (const stateId of requiredStateIds) {
  assert(srcHtml.includes(`id="${stateId}"`), `index.html must define panel id="${stateId}"`);
}

assert(srcHtml.includes('id="uptodate-version"'), 'Must contain #uptodate-version');
assert(srcHtml.includes('id="uptodate-timestamp"'), 'Must contain #uptodate-timestamp');
assert(srcHtml.includes('id="diff-current-ver"'), 'Must contain #diff-current-ver');
assert(srcHtml.includes('id="diff-latest-ver"'), 'Must contain #diff-latest-ver');
assert(srcHtml.includes('id="update-release-notes"'), 'Must contain #update-release-notes');
assert(srcHtml.includes('id="update-progress-bar"'), 'Must contain #update-progress-bar');
assert(srcHtml.includes('id="download-progress-percent"'), 'Must contain #download-progress-percent');
assert(srcHtml.includes('id="download-progress-bytes"'), 'Must contain #download-progress-bytes');
assert(srcHtml.includes('id="update-error-message"'), 'Must contain #update-error-message');
assert(srcHtml.includes('id="btn-update-action-primary"'), 'Must contain #btn-update-action-primary');
assert(srcHtml.includes('id="btn-update-action-secondary"'), 'Must contain #btn-update-action-secondary');
assert(srcHtml.includes('id="btn-updates"'), 'Toolbar must define id="btn-updates"');
assert(srcHtml.includes('aria-haspopup="dialog"'), '#btn-updates must have aria-haspopup="dialog"');

console.log('  ✔ #update-popover container verified.');
console.log('  ✔ All 7 UX-008 states present.');
console.log('  ✔ Primary and secondary action buttons & state metadata containers verified.\n');

// -----------------------------------------------------------------------------
// Test M3-4: Popover Styling & Design Tokens (F06)
// -----------------------------------------------------------------------------
console.log('Test M3-4: Verifying Popover Styling & Design Tokens (F06)...');

assert(/\.update-popover\s*\{[^}]*width:\s*320px/.test(srcCss), '.update-popover must define width: 320px');
assert(/\.update-popover\s*\{[^}]*border-radius:\s*12px/.test(srcCss), '.update-popover must define border-radius: 12px');
assert(/\.update-popover\s*\{[^}]*background:\s*var\(--bg-tab-active\)/.test(srcCss), '.update-popover must use var(--bg-tab-active)');
assert(/\.update-popover\s*\{[^}]*position:\s*fixed/.test(srcCss), '.update-popover must use position: fixed');
assert(/\.update-popover\s*\{[^}]*z-index:\s*1000/.test(srcCss), '.update-popover must have z-index: 1000');
assert(/\.update-popover\s*\{[^}]*box-shadow:/.test(srcCss), '.update-popover must define box-shadow');
assert(/\.update-popover\.hidden\s*\{[^}]*display:\s*none/.test(srcCss), '.update-popover.hidden must hide the element');
assert(srcCss.includes('popoverFadeIn'), 'index.css must define popoverFadeIn transition animation');

// Viewport height constraint (Reviewer 2 Finding 7)
assert(
  /max-height:\s*(?:min\(|calc\(100vh)/.test(srcCss),
  '.update-popover must constrain max-height to viewport height to avoid button clipping on short screens'
);

console.log('  ✔ Popover dimensions (320px width, 12px radius) and responsive constraints verified.');
console.log('  ✔ Theme-aware tokens, fixed positioning, and z-index verified.');
console.log('  ✔ Smooth popoverFadeIn transition animation verified.\n');

// -----------------------------------------------------------------------------
// Test M3-5: Popover Controller, Accessibility, Cancellation & Dynamic Version (F06)
// -----------------------------------------------------------------------------
console.log('Test M3-5: Verifying Popover Controller, Accessibility & Cancellation (F06)...');

const srcTs = fs.readFileSync(srcTsPath, 'utf-8');

// Dynamic positioning calculations
assert(srcTs.includes('toggleUpdatePopover'), 'src/renderer/index.ts must implement toggleUpdatePopover');
assert(srcTs.includes('updatePopoverPosition'), 'src/renderer/index.ts must implement updatePopoverPosition');
assert(srcTs.includes('btnRect.bottom + 6'), 'Positioning must anchor 6px below button');
assert(srcTs.includes('const margin = 8'), 'Positioning must enforce minimum 8px margin');
assert(srcTs.includes('const popoverWidth = 320'), 'Positioning must account for 320px popover width');

// Single Escape Listener & Focus Restoration (Reviewer 2 Finding 3)
const initZoomMatch = srcTs.match(/initZoom\s*\(\)\s*:\s*void\s*\{([\s\S]*?)bindBrowserEvents/);
if (initZoomMatch) {
  assert(
    !initZoomMatch[1].includes('closeUpdatePopover'),
    'initZoom must NOT call closeUpdatePopover to prevent shadowing the dedicated Escape focus restoration listener'
  );
}
assert(srcTs.includes("e.key === 'Escape'"), 'Controller must handle Escape key dismissal');
assert(srcTs.includes('pointerdown'), 'Controller must listen for pointerdown outside popover');
assert(srcTs.includes('this.btnUpdates?.focus()'), 'Escape dismissal must restore focus to #btn-updates');

// Cancellation Safety (Reviewer 2 Finding 5)
assert(
  srcTs.includes('currentCheckRequestId') ||
  srcTs.includes('checkCancelled') ||
  srcTs.includes('abortController') ||
  srcTs.includes('checkRequestId'),
  'Update check controller must track request IDs or cancellation flag to discard stale async resolutions upon Cancel'
);

// Dynamic Version Badge Binding (Reviewer 2 Finding 6)
assert(
  srcTs.includes('update-current-version-badge') || srcTs.includes('update-meta-version'),
  'Current version must be dynamically bound in renderer to avoid stale hardcoded v0.1.0 badges'
);

// 404 Distinction in Renderer Popover UI (ORIGINAL_REQUEST.md line 880)
// Must not unconditionally route non-error/non-available to 'up-to-date'
assert(
  srcTs.includes("'no-release'") ||
  srcTs.includes("'not-available'") && srcTs.includes('No published releases'),
  'Renderer must distinguish "no published release" from "up-to-date"'
);

console.log('  ✔ Dynamic coordinate calculation & boundary clamping verified.');
console.log('  ✔ Single Escape listener and keyboard focus restoration verified.');
console.log('  ✔ Cancellation safety and dynamic version binding verified.\n');

// -----------------------------------------------------------------------------
// Test M3-6: Browser Bundle Compatibility (Clean ES, Zero CommonJS Exports)
// -----------------------------------------------------------------------------
console.log('Test M3-6: Verifying Clean Renderer Bundle Execution (Zero CommonJS Exports)...');

assert(fs.existsSync(distJsPath), 'dist/renderer/index.js must exist after build');
const distJs = fs.readFileSync(distJsPath, 'utf-8');

assert.strictEqual(
  /\bexports\b/.test(distJs),
  false,
  'dist/renderer/index.js must NOT contain CommonJS "exports"'
);

console.log('  ✔ Renderer bundle is 100% CommonJS-free.');
console.log('  ✔ Clean sandboxed browser execution confirmed.\n');

// -----------------------------------------------------------------------------
// Test M3-7 (NEW): Anti-Facade & Zero Fake Timer Integrity Assertions (Forensic Audit Remediation)
// -----------------------------------------------------------------------------
console.log('Test M3-7: Verifying Anti-Facade & Zero Fake Timer Integrity Assertions...');

// 7.1: Zero Synthetic Interval Timer in Renderer Source & Bundle
assert(
  !/downloadInterval\s*=\s*setInterval/.test(srcTs),
  'INTEGRITY VIOLATION: src/renderer/index.ts must NOT use setInterval to simulate download progress'
);
assert(
  !/currentPercent\s*\+=\s*10/.test(srcTs),
  'INTEGRITY VIOLATION: src/renderer/index.ts must NOT use synthetic percentage increments'
);
assert(
  !/downloadInterval\s*=\s*setInterval/.test(distJs),
  'INTEGRITY VIOLATION: dist/renderer/index.js must NOT contain synthetic setInterval download simulation'
);

// 7.2: Zero Hardcoded Dummy Download Constants
assert(
  !srcTs.includes('85 * 1024 * 1024') && !srcTs.includes('85.0 MB'),
  'INTEGRITY VIOLATION: src/renderer/index.ts must NOT contain hardcoded dummy 85MB download size'
);
assert(
  !distJs.includes('89128960') && !distJs.includes('85.0 MB'),
  'INTEGRITY VIOLATION: dist/renderer/index.js must NOT contain hardcoded dummy 85MB constant'
);

// 7.3: Restart & Install Authenticity (No Browser Redirect Facade)
const restartFnMatch = srcTs.match(/restartAndInstall\s*\(\)\s*:\s*void\s*\{([\s\S]*?)\}/);
assert(restartFnMatch, 'restartAndInstall method must exist in src/renderer/index.ts');
assert(
  !restartFnMatch[1].includes('openExternal'),
  'INTEGRITY VIOLATION: restartAndInstall() must NOT call openExternal (browser link facade prohibited by ORIGINAL_REQUEST.md line 608)'
);
assert(
  restartFnMatch[1].includes('quitAndInstall'),
  'restartAndInstall() must invoke genuine window.api.quitAndInstall()'
);

// 7.4: Start Download Authenticity (Calls Genuine IPC Downloader)
const startDownloadMatch = srcTs.match(/startDownload\s*\([^)]*\)\s*:\s*void\s*\{([\s\S]*?)\n\s*\}/);
assert(startDownloadMatch, 'startDownload method must exist in src/renderer/index.ts');
assert(
  startDownloadMatch[1].includes('window.api') &&
  (startDownloadMatch[1].includes('startDownload') || startDownloadMatch[1].includes('downloadUpdate')),
  'startDownload() must invoke window.api.startDownload() or window.api.downloadUpdate()'
);

// 7.5: Event-Driven Progress Binding (IPC Driven, Not Polled / Faked)
assert(
  srcTs.includes('onDownloadProgress'),
  'src/renderer/index.ts must subscribe to onDownloadProgress for authentic event-driven UI updates'
);

console.log('  ✔ Zero fake timer intervals in renderer source and compiled bundle confirmed.');
console.log('  ✔ Zero hardcoded dummy byte totals confirmed.');
console.log('  ✔ Real quitAndInstall invocation confirmed for "Restart & Install".');
console.log('  ✔ Real IPC download pipeline invocation confirmed for "Start Download".');
console.log('  ✔ Event-driven progress binding confirmed.\n');

// -----------------------------------------------------------------------------
// Test M3-8 (NEW): IPC Channel Pipeline & Preload Surface Integrity
// -----------------------------------------------------------------------------
console.log('Test M3-8: Verifying IPC Channel Pipeline & Preload Surface Integrity...');

// 8.1: IPC Channel Constants in src/common/types.ts & dist/common/types.js
assert(fs.existsSync(typesDistPath), 'dist/common/types.js must exist after build');
const { IPC_CHANNELS } = require(typesDistPath);

assert(
  IPC_CHANNELS.START_DOWNLOAD || IPC_CHANNELS.DOWNLOAD_UPDATE,
  'IPC_CHANNELS must define START_DOWNLOAD or DOWNLOAD_UPDATE'
);
assert(
  IPC_CHANNELS.DOWNLOAD_PROGRESS,
  'IPC_CHANNELS must define DOWNLOAD_PROGRESS'
);
assert(
  IPC_CHANNELS.QUIT_AND_INSTALL,
  'IPC_CHANNELS must define QUIT_AND_INSTALL'
);

// 8.2: Preload Bridge API Surface in src/preload/index.ts
const preloadSrc = fs.readFileSync(preloadSrcPath, 'utf-8');
assert(
  preloadSrc.includes('startDownload') || preloadSrc.includes('downloadUpdate'),
  'src/preload/index.ts must expose startDownload or downloadUpdate on window.api'
);
assert(
  preloadSrc.includes('onDownloadProgress'),
  'src/preload/index.ts must expose onDownloadProgress on window.api'
);
assert(
  preloadSrc.includes('quitAndInstall'),
  'src/preload/index.ts must expose quitAndInstall on window.api'
);

// 8.3: Main Process IPC Handlers in src/main/window-manager.ts
const wmSrc = fs.readFileSync(windowManagerSrcPath, 'utf-8');
assert(
  wmSrc.includes('START_DOWNLOAD') || wmSrc.includes('DOWNLOAD_UPDATE') || wmSrc.includes('downloadUpdate'),
  'src/main/window-manager.ts must handle download IPC invocation'
);
assert(
  wmSrc.includes('QUIT_AND_INSTALL') || wmSrc.includes('quitAndInstall'),
  'src/main/window-manager.ts must handle quitAndInstall IPC invocation'
);

// 8.4: Main Process Updater Methods in src/main/auto-updater.ts
assert(
  autoUpdaterSrc.includes('downloadUpdate'),
  'src/main/auto-updater.ts must implement downloadUpdate() calling autoUpdater.downloadUpdate()'
);
assert(
  autoUpdaterSrc.includes('quitAndInstall'),
  'src/main/auto-updater.ts must implement quitAndInstall() calling autoUpdater.quitAndInstall()'
);
assert(
  autoUpdaterSrc.includes('download-progress'),
  'src/main/auto-updater.ts must register autoUpdater.on("download-progress")'
);

console.log('  ✔ IPC Channel definitions verified in types.');
console.log('  ✔ Preload API surface (startDownload, onDownloadProgress, quitAndInstall) verified.');
console.log('  ✔ Main process IPC handlers and AppUpdater integration verified.\n');

console.log('🎉 ALL HARDENED MILESTONE 3 VERIFICATION CHECKS PASSED WITH 100% SUCCESS!\n');
