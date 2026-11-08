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

// 4. Run tab indicators live verification
console.log('--- Step 4: Tab Indicators & Regression Live Verification ---');
const indicatorRes = spawnSync(electronBin, [path.join(__dirname, 'verify-tab-indicators.js')], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_ENABLE_LOGGING: '1'
  }
});

if (indicatorRes.status !== 0) {
  console.error('Tab Indicators live verification failed with code', indicatorRes.status);
  process.exit(indicatorRes.status || 1);
}

// 5. Run stabilization gate verification
console.log('--- Step 5: Windows Stabilization Gate Verification ---');
const stabRes = spawnSync('node', [path.join(__dirname, 'verify-stabilization.js')], {
  stdio: 'inherit',
  env: process.env
});

if (stabRes.status !== 0) {
  console.error('Stabilization gate verification failed with code', stabRes.status);
  process.exit(stabRes.status || 1);
}

// 6. Run P0 Arabic RTL acceptance
console.log('--- Step 6: P0 Arabic RTL Acceptance ---');
const rtlRes = spawnSync(electronBin, [path.join(__dirname, '../tests/test-arabic-rtl.js')], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_ENABLE_LOGGING: '1'
  }
});

if (rtlRes.status !== 0) {
  console.error('Arabic RTL acceptance failed with code', rtlRes.status);
  process.exit(rtlRes.status || 1);
}

// 7. Run Arabic RTL adversarial stress
console.log('--- Step 7: Arabic RTL Adversarial Stress ---');
const rtlStressRes = spawnSync(electronBin, [path.join(__dirname, '../tests/stress-arabic-rtl.js')], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_ENABLE_LOGGING: '1'
  }
});

if (rtlStressRes.status !== 0) {
  console.error('Arabic RTL adversarial stress failed with code', rtlStressRes.status);
  process.exit(rtlStressRes.status || 1);
}

// 8. Run auto-updater & update popover integrity verification
console.log('--- Step 8: Update Pipeline & Popover Integrity Verification ---');
const m3Res = spawnSync('node', [path.join(__dirname, '../tests/test-m3-verification.js')], {
  stdio: 'inherit',
  env: process.env
});

if (m3Res.status !== 0) {
  console.error('Update pipeline integrity verification failed with code', m3Res.status);
  process.exit(m3Res.status || 1);
}

console.log('\nAll tests passed successfully!');
