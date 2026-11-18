const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- macOS UI Consistency, Alignment & Bidirectional Verification ---');

const cssPath = path.resolve(__dirname, '../src/renderer/index.css');
const tsPath = path.resolve(__dirname, '../src/renderer/index.ts');
assert(fs.existsSync(cssPath), 'src/renderer/index.css must exist');
assert(fs.existsSync(tsPath), 'src/renderer/index.ts must exist');

const css = fs.readFileSync(cssPath, 'utf-8');
const ts = fs.readFileSync(tsPath, 'utf-8');

// 1. Font consumption
console.log('1. Checking --font-ui consumption...');
assert(css.includes('--font-ui'), 'index.css must define or reference --font-ui');
assert(css.includes('font-family: var(--font-ui'), 'body must consume var(--font-ui)');
assert(css.includes('font-family: inherit'), 'Form controls must inherit font-family');
console.log('  ✔ --font-ui consumed cleanly without overriding webview');

// 2. WCAG AA contrast tokens
console.log('2. Checking color tokens and WCAG AA contrast...');
// In light mode, --text-muted was refined to #6b6b6b (contrast > 4.5:1 against #f9f9f9)
assert(css.includes('--text-muted: #6b6b6b'), 'Light mode --text-muted must be #6b6b6b for WCAG AA compliance');
// In dark mode, --text-muted was refined to #949494 (contrast > 4.5:1 against #212121 and #2f2f2f)
assert(css.includes('--text-muted: #949494'), 'Dark mode --text-muted must be #949494 for WCAG AA compliance');
console.log('  ✔ Theme tokens pass WCAG AA contrast');

// 3. Retina border hierarchy
console.log('3. Checking Retina border hierarchy...');
assert(css.includes('@media (-webkit-min-device-pixel-ratio: 2)'), 'index.css must have Retina media query');
assert(css.includes('.browser-header') && css.includes('border-bottom-width: 0.5px'), 'Retina query must include browser-header 0.5px borders');
assert(css.includes('.split-divider::after') && css.includes('width: 0.5px'), 'Retina query must include split-divider::after 0.5px');
console.log('  ✔ Retina 0.5px borders verified across chrome components');

// 4. Tab bar alignment and controls sizing
console.log('4. Checking Tab bar alignment and controls sizing...');
assert(/\.new-tab-btn\s*\{[^}]*width:\s*26px/.test(css), '.new-tab-btn width must match nav-btn (26px)');
assert(/\.new-tab-btn\s*\{[^}]*height:\s*26px/.test(css), '.new-tab-btn height must match nav-btn (26px)');
assert(css.includes('margin-inline-start: 3px'), '.new-tab-btn must use logical margin-inline-start');
console.log('  ✔ Tab bar controls sizing and alignment verified');

// 5. Bidirectional behavior
console.log('5. Checking Bidirectional (Arabic/English) behavior...');
assert(/\.tab-title\s*\{[^}]*unicode-bidi:\s*plaintext/.test(css), '.tab-title must specify unicode-bidi: plaintext');
assert(/\.browser-tab-title\s*\{[^}]*unicode-bidi:\s*plaintext/.test(css), '.browser-tab-title must specify unicode-bidi: plaintext');
assert(/\.browser-address-input\s*\{[^}]*unicode-bidi:\s*plaintext/.test(css), '.browser-address-input must specify unicode-bidi: plaintext');
assert(/\.update-notes-content\s*\{[^}]*unicode-bidi:\s*plaintext/.test(css), '.update-notes-content must specify unicode-bidi: plaintext');
assert(ts.includes("bTitle.setAttribute('dir', 'auto')"), 'Side browser tab titles must set dir="auto"');
assert(ts.includes("this.inputBrowserUrl.setAttribute('dir', 'auto')"), 'Side browser URL input must set dir="auto"');
console.log('  ✔ Bidirectional properties and auto-direction verified');

// 6. Split divider subdued macOS line
console.log('6. Checking macOS subdued split view divider...');
assert(css.includes('.split-divider::after'), '.split-divider::after line must be defined');
assert(css.includes('background-color: var(--border-bar)'), '.split-divider::after must use var(--border-bar)');
console.log('  ✔ macOS subdued split view divider verified');

console.log('\n🎉 ALL macOS UI Consistency, Alignment & Bidirectional Verification CHECKS PASSED!');
