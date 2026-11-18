const fs = require('fs');
const path = require('path');

console.log('--- Typography & Font Verification ---');

// Check font files in src/renderer/fonts and dist/renderer/fonts
const requiredFiles = [
  'IBMPlexSansArabic-Regular.ttf',
  'IBMPlexSansArabic-Medium.ttf',
  'IBMPlexSansArabic-SemiBold.ttf',
  'IBMPlexSansArabic-Bold.ttf',
  'LICENSE.txt',
  'fonts.css'
];

for (const dir of ['src/renderer/fonts', 'dist/renderer/fonts']) {
  console.log('Checking directory:', dir);
  for (const file of requiredFiles) {
    const fullPath = path.join(dir, file);
    if (!fs.existsSync(fullPath)) {
      console.error('FAIL: Missing', fullPath);
      process.exit(1);
    }
    const stat = fs.statSync(fullPath);
    console.log('  ✔', file, 'size:', stat.size, 'bytes');
  }
}

// Verify copy-assets.js
const copyAssets = fs.readFileSync('scripts/copy-assets.js', 'utf8');
if (!copyAssets.includes('.ttf') || !copyAssets.includes('.woff') || !copyAssets.includes('.woff2')) {
  console.error('FAIL: copy-assets.js does not include font extensions');
  process.exit(1);
}
console.log('✔ copy-assets.js includes .ttf, .woff, .woff2');

// Verify fonts.css
const fontsCss = fs.readFileSync('src/renderer/fonts/fonts.css', 'utf8');
if (!fontsCss.includes('font-display: swap')) {
  console.error('FAIL: fonts.css missing font-display: swap');
  process.exit(1);
}
for (const w of ['400', '500', '600', '700']) {
  if (!fontsCss.includes('font-weight: ' + w)) {
    console.error('FAIL: fonts.css missing font-weight ' + w);
    process.exit(1);
  }
}
if (!fontsCss.includes("--font-ui: 'IBM Plex Sans Arabic', 'IBM Plex Sans'")) {
  console.error('FAIL: fonts.css missing --font-ui custom property');
  process.exit(1);
}
console.log('✔ fonts.css has non-blocking font-display: swap, all 4 weights, and --font-ui definition');

// Verify index.html
const indexHtml = fs.readFileSync('src/renderer/index.html', 'utf8');
if (!indexHtml.includes('href="fonts/fonts.css"')) {
  console.error('FAIL: index.html does not link fonts/fonts.css');
  process.exit(1);
}
console.log('✔ index.html links fonts/fonts.css');

// Verify LICENSE.txt
const license = fs.readFileSync('src/renderer/fonts/LICENSE.txt', 'utf8');
if (!license.includes('SIL OPEN FONT LICENSE Version 1.1')) {
  console.error('FAIL: LICENSE.txt does not document SIL OFL 1.1');
  process.exit(1);
}
console.log('✔ LICENSE.txt documents SIL OFL 1.1');

console.log('All typography verification checks PASSED!');
