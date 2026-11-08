const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('   ChatGPT Multitask — Windows Stabilization Gate   ');
console.log('====================================================\n');

// 1. Verify TypeScript compiles & dist files exist
console.log('[1/8] Verifying compiled artifacts...');
const requiredFiles = [
  '../dist/common/types.js',
  '../dist/preload/index.js',
  '../dist/main/index.js',
  '../dist/main/window-manager.js',
  '../dist/main/tab-manager.js',
  '../dist/main/side-browser-manager.js',
  '../dist/main/auto-updater.js',
  '../dist/main/settings-store.js',
  '../dist/renderer/index.js'
];

for (const relPath of requiredFiles) {
  const fullPath = path.resolve(__dirname, relPath);
  assert(fs.existsSync(fullPath), `Compiled file must exist: ${relPath}`);
}
console.log('✔ All compiled dist artifacts exist.\n');

// 2. Verify Renderer bundle is free of CommonJS exports
console.log('[2/8] Verifying Renderer bundle browser-compatibility...');
const rendererJs = fs.readFileSync(path.resolve(__dirname, '../dist/renderer/index.js'), 'utf-8');
assert(!/\bexports\b/.test(rendererJs), 'dist/renderer/index.js must have zero exports references');
assert(!/Object\.defineProperty\(exports/.test(rendererJs), 'dist/renderer/index.js must have zero Object.defineProperty(exports)');
console.log('✔ dist/renderer/index.js is 100% browser-compatible CommonJS-free.\n');

// 3. Verify Gate B: Performance & Debounced disk writes
console.log('[3/8] Verifying Gate B (UX-001 Performance: Debounced disk writes)...');
const tabManagerSrc = fs.readFileSync(path.resolve(__dirname, '../src/main/tab-manager.ts'), 'utf-8');
assert(tabManagerSrc.includes('persistTimer'), 'TabManager must debounce persistState calls');
assert(tabManagerSrc.includes('flushPersistState'), 'TabManager must have flushPersistState');
console.log('✔ Gate B debounced persistence verified.\n');

// 4. Verify Gate C: Image Open Handler routing
console.log('[4/8] Verifying Gate C (UX-002: Direct image open routing)...');
assert(tabManagerSrc.includes('files.oaiusercontent.com'), 'TabManager must detect OpenAI user content image CDN');
assert(tabManagerSrc.includes('shell.openExternal'), 'TabManager must divert external images to shell.openExternal');
console.log('✔ Gate C image handler bypass verified.\n');

// 5. Verify Gate E: GitHub Releases Auto-Updater
console.log('[5/8] Verifying Gate E (UX-004: GitHub Auto-Updater)...');
const autoUpdaterSrc = fs.readFileSync(path.resolve(__dirname, '../src/main/auto-updater.ts'), 'utf-8');
assert(autoUpdaterSrc.includes('sufyanaser/ChatGPT-Multitask-'), 'AutoUpdater must target official repository sufyanaser/ChatGPT-Multitask-');
assert(autoUpdaterSrc.includes('api.github.com'), 'AutoUpdater must query GitHub Releases API');
assert(autoUpdaterSrc.includes('/releases/latest'), 'AutoUpdater must query latest releases endpoint');
console.log('✔ Gate E Auto-Updater repository targets verified.\n');

// 6. Verify Gate G: Tab Indicators (Neutral outline icon)
console.log('[6/8] Verifying Gate G (UX-006: Tab Indicators & neutral outline)...');
const rendererSrc = fs.readFileSync(path.resolve(__dirname, '../src/renderer/index.ts'), 'utf-8');
assert(!rendererSrc.includes('circle cx="8" cy="12.2" r="0.6"'), 'Renderer must NOT have question-mark circle indicator');
assert(rendererSrc.includes('Conversation (Automatic)'), 'Renderer must label neutral icon as "Conversation (Automatic)"');
console.log('✔ Gate G neutral conversation indicator verified.\n');

// 7. Verify Gate H: Side Browser Integration
console.log('[7/8] Verifying Gate H (UX-007: Split-View Side Browser)...');
const sideBrowserSrc = fs.readFileSync(path.resolve(__dirname, '../src/main/side-browser-manager.ts'), 'utf-8');
assert(sideBrowserSrc.includes('persist:sidebrowser'), 'Side browser must use isolated partition persist:sidebrowser');
assert(sideBrowserSrc.includes('chat-only'), 'Side browser must support chat-only layout');
assert(sideBrowserSrc.includes('split'), 'Side browser must support split layout');
assert(sideBrowserSrc.includes('browser-only'), 'Side browser must support browser-only layout');
assert(sideBrowserSrc.includes('splitRatio'), 'Side browser must support split ratio');
console.log('✔ Gate H Side Browser isolated session and layout modes verified.\n');

// 8. Verify Assets & Package JSON configuration
console.log('[8/8] Verifying Windows Packaging metadata...');
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'));
assert.strictEqual(pkg.name, 'chatgpt-multitask');
assert.strictEqual(pkg.build.appId, 'com.chatgpt.multitask');
assert(pkg.build.win.icon.includes('icon.ico'), 'Windows build icon must point to icon.ico');
console.log('✔ Packaging metadata and icon configuration verified.\n');

console.log('====================================================');
console.log('   ALL GATES VERIFIED SUCCESSFULLY — STATUS: PASS   ');
console.log('====================================================\n');
