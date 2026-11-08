/**
 * Automated Verification Suite for Milestone 2: UI/UX & Side-Browser Fixes & CSP (Features F02, F03, F04)
 *
 * Verifies:
 * 1. Side-Browser DOM Wiring Fix (F02):
 *    - src/renderer/index.ts correctly queries 'browser-tabs-list' (no 'browser-tabs')
 *    - src/renderer/index.ts correctly queries 'btn-mode-full' (no 'btn-mode-browser-only')
 *    - src/renderer/index.html defines both elements with matching IDs
 * 2. Tab Focus & Overflow Accessibility (F03):
 *    - src/renderer/index.css includes .tab-item:focus-visible with accessible outline and offset
 *    - src/renderer/index.css uses natural flex sizing for .tabs-list (flex: 0 1 auto; min-width: 0)
 *    - src/renderer/index.css prevents clipping of trailing-controls and nav-controls (flex-shrink: 0)
 * 3. Content Security Policy Header (F04):
 *    - src/renderer/index.html has strict CSP meta tag with required directives
 *    - dist/renderer/index.html has matching CSP meta tag after asset copy
 * 4. Renderer Browser Compatibility (Clean ES, No CommonJS exports):
 *    - dist/renderer/index.js contains no CommonJS `exports` references
 *    - dist/renderer/index.js executes cleanly in a browser-like mock context without ReferenceError
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('=== Running Milestone 2 Verification Suite ===\n');

const projectRoot = path.join(__dirname, '..');
const srcHtmlPath = path.join(projectRoot, 'src/renderer/index.html');
const distHtmlPath = path.join(projectRoot, 'dist/renderer/index.html');
const srcTsPath = path.join(projectRoot, 'src/renderer/index.ts');
const srcCssPath = path.join(projectRoot, 'src/renderer/index.css');
const distCssPath = path.join(projectRoot, 'dist/renderer/index.css');
const distJsPath = path.join(projectRoot, 'dist/renderer/index.js');

// -----------------------------------------------------------------------------
// Test M2-1: Side-Browser DOM Wiring Consistency (F02)
// -----------------------------------------------------------------------------
console.log('Test M2-1: Verifying Side-Browser DOM Wiring Consistency (F02)...');

const srcTs = fs.readFileSync(srcTsPath, 'utf-8');
const srcHtml = fs.readFileSync(srcHtmlPath, 'utf-8');

// Check that index.ts queries 'browser-tabs-list'
assert(
  srcTs.includes("document.getElementById('browser-tabs-list')"),
  'src/renderer/index.ts must query "browser-tabs-list"'
);
assert(
  !srcTs.includes("document.getElementById('browser-tabs')"),
  'src/renderer/index.ts must NOT query obsolete "browser-tabs"'
);

// Check that index.ts queries 'btn-mode-full'
assert(
  srcTs.includes("document.getElementById('btn-mode-full')"),
  'src/renderer/index.ts must query "btn-mode-full"'
);
assert(
  !srcTs.includes("document.getElementById('btn-mode-browser-only')"),
  'src/renderer/index.ts must NOT query obsolete "btn-mode-browser-only"'
);

// Check that index.html contains the matching IDs
assert(
  srcHtml.includes('id="browser-tabs-list"'),
  'src/renderer/index.html must define id="browser-tabs-list"'
);
assert(
  srcHtml.includes('id="btn-mode-full"'),
  'src/renderer/index.html must define id="btn-mode-full"'
);

console.log('  ✔ browser-tabs-list DOM wiring verified.');
console.log('  ✔ btn-mode-full layout switcher DOM wiring verified.\n');

// -----------------------------------------------------------------------------
// Test M2-2: Tab Focus & Overflow Accessibility (F03)
// -----------------------------------------------------------------------------
console.log('Test M2-2: Verifying Tab Focus & Overflow Accessibility (F03)...');

const srcCss = fs.readFileSync(srcCssPath, 'utf-8');

// Check for .tab-item:focus-visible in index.css
assert(
  srcCss.includes('.tab-item:focus-visible'),
  'src/renderer/index.css must define .tab-item:focus-visible styling'
);

// Check focus ring uses theme accent outline
assert(
  /\.tab-item:focus-visible[\s\S]*?outline:\s*2px solid var\(--accent-color\)/.test(srcCss) ||
  /button:focus-visible,\s*input:focus-visible,\s*\.tab-item:focus-visible[\s\S]*?outline:\s*2px solid var\(--accent-color\)/.test(srcCss),
  'Focus outline must use 2px solid var(--accent-color)'
);

// Check that .tabs-list uses natural flex sizing and no hardcoded calc max-width
assert(
  /\.tabs-list\s*\{[^}]*flex:\s*0 1 auto/.test(srcCss),
  '.tabs-list must use flex: 0 1 auto for responsive flex sizing'
);
assert(
  /\.tabs-list\s*\{[^}]*min-width:\s*0/.test(srcCss),
  '.tabs-list must have min-width: 0 to allow shrinking on narrow windows'
);
assert(
  !/\.tabs-list\s*\{[^}]*max-width:\s*calc\(100% - 200px\)/.test(srcCss),
  '.tabs-list must NOT use rigid max-width: calc(100% - 200px)'
);

// Check that trailing-controls has flex-shrink: 0 to prevent toolbar controls clipping
assert(
  /\.trailing-controls\s*\{[^}]*flex-shrink:\s*0/.test(srcCss),
  '.trailing-controls must have flex-shrink: 0 to prevent toolbar controls clipping'
);

// Check that nav-controls has flex-shrink: 0
assert(
  /\.nav-controls\s*\{[^}]*flex-shrink:\s*0/.test(srcCss),
  '.nav-controls must have flex-shrink: 0'
);

console.log('  ✔ .tab-item:focus-visible keyboard focus ring verified.');
console.log('  ✔ .tabs-list responsive flex sizing & overflow handling verified.');
console.log('  ✔ Toolbar controls clipping protection (flex-shrink: 0) verified.\n');

// -----------------------------------------------------------------------------
// Test M2-3: Content Security Policy Header (F04)
// -----------------------------------------------------------------------------
console.log('Test M2-3: Verifying Content Security Policy Header (F04)...');

const expectedCspMeta = '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: https:; font-src \'self\' data:; connect-src \'self\' https://api.github.com;">';

assert(
  srcHtml.includes(expectedCspMeta),
  'src/renderer/index.html must contain the exact strict Content Security Policy meta tag'
);

if (fs.existsSync(distHtmlPath)) {
  const distHtml = fs.readFileSync(distHtmlPath, 'utf-8');
  assert(
    distHtml.includes(expectedCspMeta),
    'dist/renderer/index.html must contain the exact strict Content Security Policy meta tag'
  );
}

// Verify key CSP directives individually
assert(srcHtml.includes("default-src 'self'"), 'CSP must include default-src \'self\'');
assert(srcHtml.includes("script-src 'self'"), 'CSP must include script-src \'self\'');
assert(srcHtml.includes("style-src 'self' 'unsafe-inline'"), 'CSP must include style-src \'self\' \'unsafe-inline\'');
assert(srcHtml.includes("img-src 'self' data: https:"), 'CSP must include img-src \'self\' data: https:');
assert(srcHtml.includes("font-src 'self' data:"), 'CSP must include font-src \'self\' data:');
assert(srcHtml.includes("connect-src 'self' https://api.github.com"), 'CSP must include connect-src \'self\' https://api.github.com');

console.log('  ✔ Strict CSP meta tag present in head with correct directives.\n');

// -----------------------------------------------------------------------------
// Test M2-4: CommonJS Exports Check (Browser Bundle Compatibility)
// -----------------------------------------------------------------------------
console.log('Test M2-4: Verifying CommonJS exports check (Unit test 4 parity)...');

assert(fs.existsSync(distJsPath), 'dist/renderer/index.js must exist after build');
const distJs = fs.readFileSync(distJsPath, 'utf-8');

assert.strictEqual(
  /\bexports\b/.test(distJs),
  false,
  'dist/renderer/index.js must not contain CommonJS "exports" references'
);

const mockContext = vm.createContext({
  window: {
    addEventListener: () => {}
  },
  document: {
    getElementById: (id) => ({
      id,
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
  vm.runInContext(distJs, mockContext);
}, /exports is not defined/, 'Renderer script must not fail with "ReferenceError: exports is not defined" in browser context');

console.log('  ✔ No CommonJS exports in renderer bundle.');
console.log('  ✔ Clean execution in browser context without ReferenceError.\n');

console.log('🎉 ALL MILESTONE 2 VERIFICATION CHECKS PASSED SUCCESSFULLY!\n');
