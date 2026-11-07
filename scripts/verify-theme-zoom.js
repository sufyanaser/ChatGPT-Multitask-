const { app, BrowserWindow, nativeTheme, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

// Test script for Gate B and Gate C live verification
async function runTest() {
  console.log('=== Starting Theme & Zoom Live Verification ===\n');

  const { WindowManager } = require('../dist/main/window-manager');
  const { SettingsStore } = require('../dist/main/settings-store');
  const { IPC_CHANNELS } = require('../dist/common/types');

  const settingsStore = new SettingsStore();
  const initialSettings = settingsStore.load();
  console.log('Step 1: Loaded settings from SettingsStore:', initialSettings);
  assert(typeof initialSettings.themeMode === 'string');
  assert(typeof initialSettings.zoomFactor === 'number');

  console.log('Step 2: Creating WindowManager & Window...');
  const windowManager = new WindowManager();
  const win = windowManager.createWindow();
  assert(win !== null, 'BrowserWindow must be created');

  await new Promise((resolve) => {
    win.webContents.once('did-finish-load', resolve);
  });
  console.log('Step 3: Tab bar renderer finished loading.');

  const tabManager = windowManager.getTabManager();
  assert(tabManager !== null, 'TabManager must exist');

  // Verify initial zoom
  const currentZoom = tabManager.getZoomFactor();
  console.log(`Step 4: Initial TabManager Zoom Factor: ${currentZoom * 100}%`);

  // Test Zoom In & Out
  console.log('Step 5: Testing Zoom changes...');
  tabManager.setZoomFactor(1.2);
  assert.strictEqual(tabManager.getZoomFactor(), 1.2, 'Zoom factor must be 1.2');

  const activeTab = tabManager.getActiveTab();
  if (activeTab) {
    const webZoom = activeTab.view.webContents.getZoomFactor();
    console.log(`Step 6: Active Tab webContents Zoom Factor: ${Math.round(webZoom * 100)}%`);
    assert.strictEqual(Math.round(webZoom * 10) / 10, 1.2, 'WebContents zoom must match 1.2');
  }

  // Test Zoom boundaries clamping
  console.log('Step 7: Testing Zoom boundary clamping (0.8 to 1.5)...');
  tabManager.setZoomFactor(0.5);
  assert.strictEqual(tabManager.getZoomFactor(), 0.8, 'Zoom must clamp to min 0.8');

  tabManager.setZoomFactor(2.0);
  assert.strictEqual(tabManager.getZoomFactor(), 1.5, 'Zoom must clamp to max 1.5');

  tabManager.resetZoom();
  assert.strictEqual(tabManager.getZoomFactor(), 1.0, 'Zoom must reset to 1.0');

  // Test Theme modes
  console.log('Step 8: Testing Theme Switching on Windows...');
  nativeTheme.themeSource = 'dark';
  assert.strictEqual(nativeTheme.shouldUseDarkColors, true);
  console.log('  ✔ Dark mode set. Background color:', win.getBackgroundColor());

  nativeTheme.themeSource = 'light';
  assert.strictEqual(nativeTheme.shouldUseDarkColors, false);
  console.log('  ✔ Light mode set. Background color:', win.getBackgroundColor());

  nativeTheme.themeSource = 'system';
  console.log('  ✔ System mode restored.');

  // Verify settings persistence
  settingsStore.save({ themeMode: 'dark', zoomFactor: 1.1 });
  const reloaded = settingsStore.load();
  assert.strictEqual(reloaded.themeMode, 'dark');
  assert.strictEqual(reloaded.zoomFactor, 1.1);
  console.log('Step 9: SettingsStore persistence verified:', reloaded);

  // Restore defaults
  settingsStore.save({ themeMode: 'system', zoomFactor: 1.0 });

  console.log('\n🎉 ALL Theme & Zoom Verification Checks PASSED!\n');
  win.close();
  app.quit();
}

app.whenReady().then(runTest).catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
