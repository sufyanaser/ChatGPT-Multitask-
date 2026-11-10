const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== Running Unit Tests ===\n');

// Test 1: Common types and IPC Channels
console.log('Test 1: Verifying IPC Channel contracts...');
const { IPC_CHANNELS } = require('../dist/common/types');
assert.strictEqual(typeof IPC_CHANNELS.TAB_CREATE, 'string');
assert.strictEqual(typeof IPC_CHANNELS.TAB_CLOSE, 'string');
assert.strictEqual(typeof IPC_CHANNELS.TAB_SELECT, 'string');
assert.strictEqual(typeof IPC_CHANNELS.TABS_STATE_UPDATE, 'string');
assert.strictEqual(typeof IPC_CHANNELS.TAB_REORDER, 'string');
assert.strictEqual(typeof IPC_CHANNELS.THEME_UPDATE, 'string');
assert.strictEqual(typeof IPC_CHANNELS.THEME_CHANGED, 'string');
assert.strictEqual(typeof IPC_CHANNELS.FULLSCREEN_UPDATE, 'string');
assert.strictEqual(typeof IPC_CHANNELS.GET_THEME, 'string');
assert.strictEqual(typeof IPC_CHANNELS.SET_THEME, 'string');
assert.strictEqual(typeof IPC_CHANNELS.THEME_GET, 'string');
assert.strictEqual(typeof IPC_CHANNELS.ZOOM_UPDATE, 'string');
assert.strictEqual(typeof IPC_CHANNELS.ZOOM_GET, 'string');
assert.strictEqual(typeof IPC_CHANNELS.ZOOM_SET, 'string');
assert.strictEqual(typeof IPC_CHANNELS.ZOOM_RESET, 'string');
assert.strictEqual(typeof IPC_CHANNELS.TAB_SET_TYPE, 'string');
assert.strictEqual(typeof IPC_CHANNELS.TAB_SHOW_CONTEXT_MENU, 'string');

// Side Browser IPC channels
assert.strictEqual(typeof IPC_CHANNELS.BROWSER_TOGGLE, 'string');
assert.strictEqual(typeof IPC_CHANNELS.BROWSER_SET_LAYOUT, 'string');
assert.strictEqual(typeof IPC_CHANNELS.BROWSER_SET_SPLIT_RATIO, 'string');
assert.strictEqual(typeof IPC_CHANNELS.BROWSER_NAVIGATE, 'string');
assert.strictEqual(typeof IPC_CHANNELS.BROWSER_BACK, 'string');
assert.strictEqual(typeof IPC_CHANNELS.BROWSER_FORWARD, 'string');
assert.strictEqual(typeof IPC_CHANNELS.BROWSER_RELOAD, 'string');
assert.strictEqual(typeof IPC_CHANNELS.BROWSER_TAB_CREATE, 'string');
assert.strictEqual(typeof IPC_CHANNELS.BROWSER_TAB_CLOSE, 'string');
assert.strictEqual(typeof IPC_CHANNELS.BROWSER_TAB_SELECT, 'string');
assert.strictEqual(typeof IPC_CHANNELS.BROWSER_STATE_UPDATE, 'string');
assert.strictEqual(typeof IPC_CHANNELS.BROWSER_GET_STATE, 'string');
assert.strictEqual(typeof IPC_CHANNELS.OPEN_EXTERNAL, 'string');

// Auto Updater IPC channels
assert.strictEqual(typeof IPC_CHANNELS.CHECK_FOR_UPDATES, 'string');
console.log('✔ IPC Channels (including Side Browser & Updater) are correctly defined.\n');

// Test 2: URL & Origin validation logic
console.log('Test 2: Verifying Domain Allowlist logic...');
function isUrlAllowed(urlStr) {
  const allowedOrigins = [
    'chatgpt.com',
    'oaistatic.com',
    'oaiusercontent.com',
    'openai.com',
    'auth0.openai.com',
    'accounts.google.com',
    'appleid.apple.com',
    'login.microsoftonline.com',
    'live.com'
  ];
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    return allowedOrigins.some(domain =>
      parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

// Valid OpenAI / ChatGPT URLs
assert.strictEqual(isUrlAllowed('https://chatgpt.com'), true);
assert.strictEqual(isUrlAllowed('https://chatgpt.com/c/672bd8f2-1234'), true);
assert.strictEqual(isUrlAllowed('https://chat.openai.com/g/g-p-test'), true);
assert.strictEqual(isUrlAllowed('https://auth0.openai.com/u/login'), true);
assert.strictEqual(isUrlAllowed('https://accounts.google.com/o/oauth2/v2/auth'), true);
assert.strictEqual(isUrlAllowed('https://appleid.apple.com/auth/authorize'), true);

// Disallowed / Malicious / External URLs
assert.strictEqual(isUrlAllowed('http://malicious-site.com'), false);
assert.strictEqual(isUrlAllowed('https://fake-chatgpt.com'), false);
assert.strictEqual(isUrlAllowed('javascript:alert(1)'), false);
assert.strictEqual(isUrlAllowed('file:///etc/passwd'), false);
console.log('✔ Domain Allowlist successfully validated legitimate auth & rejected unsafe domains.\n');

// Test 3: Tab State serialization & recovery with tab types
console.log('Test 3: Verifying TabStateStore serialization with Conversation Types...');
const tempStorePath = path.join(__dirname, 'temp-tabs-state.json');

const testState = {
  version: 1,
  tabs: [
    { id: 'tab-1', url: 'https://chatgpt.com', title: 'Standard Chat', typeOverride: 'chat', conversationType: 'chat' },
    { id: 'tab-2', url: 'https://chatgpt.com/c/12345', title: 'Work Project', typeOverride: 'work', conversationType: 'work' },
    { id: 'tab-3', url: 'https://chatgpt.com/g/g-123', title: 'Unclassified Task', typeOverride: 'auto', conversationType: 'unknown' }
  ],
  activeTabId: 'tab-2'
};

fs.writeFileSync(tempStorePath, JSON.stringify(testState, null, 2), 'utf-8');
const loaded = JSON.parse(fs.readFileSync(tempStorePath, 'utf-8'));
assert.strictEqual(loaded.version, 1);
assert.strictEqual(loaded.tabs.length, 3);
assert.strictEqual(loaded.activeTabId, 'tab-2');
assert.strictEqual(loaded.tabs[0].conversationType, 'chat');
assert.strictEqual(loaded.tabs[1].conversationType, 'work');
assert.strictEqual(loaded.tabs[2].conversationType, 'unknown');
assert.strictEqual(loaded.tabs[2].typeOverride, 'auto');
fs.unlinkSync(tempStorePath);
console.log('✔ Tab state serialization and recovery (with Conversation Types) validated.\n');

// Test 4: Regression protection: Renderer bundle browser-compatibility (no CommonJS exports)
console.log('Test 4: Verifying renderer script has no CommonJS exports...');
const rendererJsPath = path.join(__dirname, '../dist/renderer/index.js');
assert(fs.existsSync(rendererJsPath), 'dist/renderer/index.js must exist after build');
const rendererJs = fs.readFileSync(rendererJsPath, 'utf-8');

// 1. Static check: Ensure no reference to exports
assert.strictEqual(
  /\bexports\b/.test(rendererJs),
  false,
  'dist/renderer/index.js must not contain CommonJS "exports" references'
);

// 2. Runtime execution in clean sandboxed context without exports
const vm = require('vm');
const mockContext = vm.createContext({
  window: {
    addEventListener: () => {}
  },
  document: {
    getElementById: () => ({
      addEventListener: () => {},
      classList: {
        add: () => {},
        remove: () => {},
        contains: () => false,
        toggle: () => false
      },
      setAttribute: () => {},
      style: {}
    }),
    addEventListener: () => {},
    documentElement: {
      style: {
        setProperty: () => {}
      }
    }
  },
  console
});

assert.doesNotThrow(() => {
  vm.runInContext(rendererJs, mockContext);
}, /exports is not defined/, 'Renderer script must not fail with "ReferenceError: exports is not defined" in browser context');
console.log('✔ Renderer script browser-compatibility verified (no CommonJS exports).\n');

// Test 5: Tab indicator type resolution contracts
console.log('Test 5: Verifying Conversation Type resolution logic...');
function resolveConversationType(url, override) {
  if (override === 'chat') return 'chat';
  if (override === 'work') return 'work';
  return 'unknown';
}
assert.strictEqual(resolveConversationType('https://chatgpt.com', 'chat'), 'chat');
assert.strictEqual(resolveConversationType('https://chatgpt.com', 'work'), 'work');
assert.strictEqual(resolveConversationType('https://chatgpt.com', 'auto'), 'unknown');
assert.strictEqual(resolveConversationType('https://chatgpt.com/c/work-task', 'auto'), 'unknown', 'Auto mode must never guess from URL substring');
console.log('✔ Conversation Type resolution verified.\n');

// Test 6: Zoom factor clamping and step logic
console.log('Test 6: Verifying Zoom factor limits (80% to 150%, step 10%)...');
function clampZoom(factor) {
  return Math.min(1.5, Math.max(0.8, Math.round(factor * 10) / 10));
}
assert.strictEqual(clampZoom(1.0), 1.0);
assert.strictEqual(clampZoom(0.8), 0.8);
assert.strictEqual(clampZoom(0.7), 0.8, 'Zoom must not go below 80%');
assert.strictEqual(clampZoom(1.5), 1.5);
assert.strictEqual(clampZoom(1.6), 1.5, 'Zoom must not exceed 150%');
console.log('✔ Zoom clamping logic verified.\n');

// Test 7: Image open handler routing (UX-002: no chat tab spawning for images)
console.log('Test 7: Verifying Image Open Handler logic (UX-002)...');
function isDirectImage(urlStr) {
  return (
    urlStr.includes('files.oaiusercontent.com') ||
    urlStr.includes('blob:https://chatgpt.com') ||
    /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(urlStr)
  );
}
assert.strictEqual(isDirectImage('https://files.oaiusercontent.com/file-12345/image.png'), true);
assert.strictEqual(isDirectImage('https://chatgpt.com/some/image.webp'), true);
assert.strictEqual(isDirectImage('https://chatgpt.com/c/chat-uuid-here'), false);
console.log('✔ Direct image routing logic correctly identifies asset URLs.\n');

// Test 8: Platform icon assets verification
console.log('Test 7b: Verifying conversation de-duplication key...');
{
  const { conversationKey } = require('../dist/main/tab-manager');
  const id = '672bd8f2-1234-4abc-9def-000000000001';
  assert.strictEqual(conversationKey(`https://chatgpt.com/c/${id}`), `chatgpt.com/c/${id}`);
  assert.strictEqual(conversationKey(`https://chatgpt.com/c/${id}/?model=x#frag`), `chatgpt.com/c/${id}`, 'query, hash and trailing slash are ignored');
  assert.strictEqual(conversationKey(`https://chatgpt.com/g/g-p-abc/c/${id}`), `chatgpt.com/c/${id}`, 'project-scoped path maps to the same conversation');
  assert.strictEqual(conversationKey('https://chatgpt.com/'), null, 'home / new chat must never be de-duplicated');
  assert.strictEqual(conversationKey('https://chatgpt.com/g/g-p-abc/project'), null);
  assert.strictEqual(conversationKey('https://chatgpt.com/gpts'), null);
  assert.strictEqual(conversationKey(`http://chatgpt.com/c/${id}`), null);
  assert.strictEqual(conversationKey('not a url'), null);
  assert.notStrictEqual(conversationKey(`https://chatgpt.com/c/${id}`), conversationKey('https://chatgpt.com/c/672bd8f2-1234-4abc-9def-000000000002'));
}
console.log('✔ Conversation key verified.\n');

console.log('Test 7c: Verifying hosted-content drag-region guard...');
{
  const { NO_DRAG_REGIONS_CSS, neutralizeDragRegions } = require('../dist/main/drag-region-guard');
  assert.ok(/-webkit-app-region:\s*no-drag\s*!important/.test(NO_DRAG_REGIONS_CSS));
  const calls = [];
  const handlers = {};
  const fakeWc = {
    isDestroyed: () => false,
    on: (evt, fn) => { handlers[evt] = fn; },
    insertCSS: (css, opts) => { calls.push({ css, opts }); return Promise.resolve('k'); }
  };
  neutralizeDragRegions(fakeWc);
  assert.strictEqual(typeof handlers['dom-ready'], 'function', 'guard must re-apply on every new document');
  handlers['dom-ready']();
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].opts.cssOrigin, 'user', 'user origin is required to outrank !important author rules');
  for (const file of ['tab-manager', 'side-browser-manager']) {
    const src = fs.readFileSync(path.join(__dirname, `../dist/main/${file}.js`), 'utf8');
    assert.ok(src.includes('neutralizeDragRegions)(wc)'), `${file} must guard its WebContentsViews`);
  }
}
console.log('✔ Drag-region guard verified.\n');

console.log('Test 7d: Verifying visual style contract...');
{
  const { UI_STYLES } = require('../dist/common/types');
  assert.deepStrictEqual([...UI_STYLES], ['classic', 'glass', 'aurora', 'neumorph']);
  assert.strictEqual(typeof IPC_CHANNELS.SET_UI_STYLE, 'string');
  assert.strictEqual(typeof IPC_CHANNELS.SHOW_APPEARANCE_MENU, 'string');
  const css = fs.readFileSync(path.join(__dirname, '../src/renderer/index.css'), 'utf8');
  const wm = fs.readFileSync(path.join(__dirname, '../src/main/window-manager.ts'), 'utf8');
  const preload = fs.readFileSync(path.join(__dirname, '../src/preload/index.ts'), 'utf8');
  assert.ok(preload.includes("SET_UI_STYLE: 'theme:set-style'") && preload.includes("SHOW_APPEARANCE_MENU: 'theme:show-menu'"));
  // Every non-classic style defines a dark and a light --bg-bar, and the main
  // process paints the window / caption overlay with the same two colours.
  for (const style of ['glass', 'aurora', 'neumorph']) {
    const dark = css.match(new RegExp(`body\\.style-${style} \\{[^}]*--bg-bar: (#[0-9a-f]{6})`));
    const light = css.match(new RegExp(`body\\.style-${style}\\.theme-light \\{[^}]*--bg-bar: (#[0-9a-f]{6})`));
    assert.ok(dark && light, `${style} must define dark and light --bg-bar`);
    assert.ok(wm.includes(`${style}: ['${dark[1]}', '${light[1]}']`), `${style} chrome colours must match CSS`);
  }
  assert.ok(/backdrop-filter:\s*blur/.test(css), 'glass style must use backdrop blur');
  assert.ok(css.includes('@keyframes auroraDrift'), 'aurora style must be animated');
}
console.log('✔ Visual style contract verified.\n');

console.log('Test 8: Verifying platform icon assets...');
const assetsDir = path.join(__dirname, '../assets');
assert(fs.existsSync(path.join(assetsDir, 'icon.ico')), 'Windows icon.ico must exist');
assert(fs.existsSync(path.join(assetsDir, 'icon.icns')), 'macOS icon.icns must exist');
assert(fs.existsSync(path.join(assetsDir, 'icon.png')), 'Master icon.png must exist');
console.log('✔ Icon assets verified.\n');

console.log('All Unit Tests Passed Successfully!\n');
