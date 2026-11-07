const { spawnSync } = require('child_process');
const path = require('path');

console.log('Running test suite for ChatGPT Multitask...\n');

// 1. Run unit tests
console.log('--- Step 1: Unit Tests ---');
const unitRes = spawnSync('node', [path.join(__dirname, '../tests/unit-tests.js')], {
  stdio: 'inherit',
  env: process.env
});

if (unitRes.status !== 0) {
  console.error('Unit tests failed with code', unitRes.status);
  process.exit(unitRes.status || 1);
}

// 2. Run electron smoke test
console.log('--- Step 2: Electron Integration & Smoke Test ---');
const electronBin = require('electron');
const smokeRes = spawnSync(electronBin, [path.join(__dirname, '../tests/electron-smoke.js')], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_ENABLE_LOGGING: '1'
  }
});

if (smokeRes.status !== 0) {
  console.error('Electron smoke test failed with code', smokeRes.status);
  process.exit(smokeRes.status || 1);
}

// 3. Run theme & zoom live verification
console.log('--- Step 3: Theme & Zoom Live Verification ---');
const zoomRes = spawnSync(electronBin, [path.join(__dirname, 'verify-theme-zoom.js')], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_ENABLE_LOGGING: '1'
  }
});

if (zoomRes.status !== 0) {
  console.error('Theme & Zoom live verification failed with code', zoomRes.status);
  process.exit(zoomRes.status || 1);
}

console.log('\nAll tests passed successfully!');
