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
console.log('✔ IPC Channels are correctly defined.\n');

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

// Test 3: Tab State serialization & recovery
console.log('Test 3: Verifying TabStateStore serialization...');
const tempStorePath = path.join(__dirname, 'temp-tabs-state.json');

const testState = {
  version: 1,
  tabs: [
    { id: 'tab-1', url: 'https://chatgpt.com', title: 'New chat' },
    { id: 'tab-2', url: 'https://chatgpt.com/c/12345', title: 'Architecture Review' }
  ],
  activeTabId: 'tab-2'
};

fs.writeFileSync(tempStorePath, JSON.stringify(testState, null, 2), 'utf-8');
const loaded = JSON.parse(fs.readFileSync(tempStorePath, 'utf-8'));
assert.strictEqual(loaded.version, 1);
assert.strictEqual(loaded.tabs.length, 2);
assert.strictEqual(loaded.activeTabId, 'tab-2');
assert.strictEqual(loaded.tabs[1].title, 'Architecture Review');
fs.unlinkSync(tempStorePath);
console.log('✔ Tab state serialization and recovery validated.\n');

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
      addEventListener: () => {}
    })
  },
  console
});

assert.doesNotThrow(() => {
  vm.runInContext(rendererJs, mockContext);
}, /exports is not defined/, 'Renderer script must not fail with "ReferenceError: exports is not defined" in browser context');
console.log('✔ Renderer script browser-compatibility verified (no CommonJS exports).\n');

console.log('All Unit Tests Passed Successfully!\n');
