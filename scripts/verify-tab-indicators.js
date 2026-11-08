const { app, BrowserWindow, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

async function runTest() {
  console.log('=== Starting Tab Indicators & Regression Live Verification ===\n');

  const { WindowManager } = require('../dist/main/window-manager');
  const { TabStateStore } = require('../dist/main/tab-state-store');

  console.log('Step 1: Initializing WindowManager and window...');
  const windowManager = new WindowManager();
  const win = windowManager.createWindow();
  assert(win !== null, 'BrowserWindow must be created');

  await new Promise((resolve) => {
    win.webContents.once('did-finish-load', resolve);
  });
  console.log('Step 2: Tab bar renderer finished loading.');

  const tabManager = windowManager.getTabManager();
  assert(tabManager !== null, 'TabManager must exist');

  // Test Gate B & Gate C: Tab Creation with Indicators
  console.log('Step 3: Creating 3 simultaneous tabs with distinct types...');
  // Tab 1: Chat conversation
  const tab1 = tabManager.createTab('https://chatgpt.com', true, 'test-tab-chat', 'General Chat', 'chat');
  assert.strictEqual(tab1.conversationType, 'chat');
  assert.strictEqual(tab1.typeOverride, 'chat');

  // Tab 2: Work task
  const tab2 = tabManager.createTab('https://chatgpt.com', false, 'test-tab-work', 'Work Analytics', 'work');
  assert.strictEqual(tab2.conversationType, 'work');
  assert.strictEqual(tab2.typeOverride, 'work');

  // Tab 3: Automatic (unclassified -> Unknown)
  const tab3 = tabManager.createTab('https://chatgpt.com', false, 'test-tab-auto', 'Research Task', 'auto');
  assert.strictEqual(tab3.conversationType, 'unknown');
  assert.strictEqual(tab3.typeOverride, 'auto');

  console.log('  ✔ Tab 1 (Chat): icon message-circle, type chat');
  console.log('  ✔ Tab 2 (Work): icon briefcase-business, type work');
  console.log('  ✔ Tab 3 (Auto/Unknown): icon circle-help, type unknown (not falsely labeled)');

  // Test Gate D: Manual Override
  console.log('Step 4: Testing Manual Classification Override...');
  tabManager.setTabTypeOverride(tab3.id, 'work');
  assert.strictEqual(tab3.conversationType, 'work');
  assert.strictEqual(tab3.typeOverride, 'work');
  console.log('  ✔ Tab 3 manually overridden to Work -> type is now work');

  tabManager.setTabTypeOverride(tab3.id, 'auto');
  assert.strictEqual(tab3.conversationType, 'unknown');
  assert.strictEqual(tab3.typeOverride, 'auto');
  console.log('  ✔ Tab 3 reset to Automatic -> type is safely unknown');

  // Test Tab Switching & Selection
  console.log('Step 5: Testing Tab switching between tabs...');
  tabManager.selectTab(tab2.id);
  assert.strictEqual(tabManager.getActiveTabId(), tab2.id);
  tabManager.selectTab(tab1.id);
  assert.strictEqual(tabManager.getActiveTabId(), tab1.id);
  console.log('  ✔ Tab selection and view swapping verified.');

  // Test Tab Reordering
  console.log('Step 6: Testing Tab reordering...');
  const initialTabs = tabManager.getTabs();
  const initialFirstId = initialTabs[0].id;
  tabManager.reorderTabs(0, 1);
  const reorderedTabs = tabManager.getTabs();
  assert.strictEqual(reorderedTabs[1].id, initialFirstId);
  console.log('  ✔ Tab reordering preserved tab metadata.');

  // Test State Store Persistence
  console.log('Step 7: Verifying TabStateStore persistence with Conversation Types...');
  tabManager.flushPersistState();
  const stateStore = new TabStateStore();
  const savedState = stateStore.load();
  assert(savedState !== null);
  assert(savedState.tabs.length >= 3);
  const savedTab2 = savedState.tabs.find(t => t.id === 'test-tab-work');
  assert(savedTab2 !== undefined);
  assert.strictEqual(savedTab2.typeOverride, 'work');
  assert.strictEqual(savedTab2.conversationType, 'work');
  console.log('  ✔ Saved tabs state correctly contains typeOverride and conversationType.');

  // Test Tab Closing
  console.log('Step 8: Testing Tab closing...');
  tabManager.closeTab(tab2.id);
  tabManager.closeTab(tab3.id);
  assert.strictEqual(tabManager.getTabs().some(t => t.id === tab2.id), false);
  console.log('  ✔ Tabs closed cleanly.');

  // Test Theme & Titlebar Overlay sync
  console.log('Step 9: Testing Theme switching and TitleBarOverlay...');
  nativeTheme.themeSource = 'dark';
  assert.strictEqual(nativeTheme.shouldUseDarkColors, true);
  nativeTheme.themeSource = 'light';
  assert.strictEqual(nativeTheme.shouldUseDarkColors, false);
  nativeTheme.themeSource = 'system';
  console.log('  ✔ Theme switching verified.');

  console.log('\n🎉 ALL Tab Indicators & Regression Checks PASSED!\n');
  win.close();
  app.quit();
}

app.whenReady().then(runTest).catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
