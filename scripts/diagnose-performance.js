const { app, BrowserWindow, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

// Measure baseline performance metrics
async function runDiagnostics() {
  const t0 = performance.now();
  console.log('=== Performance Diagnostics & Baseline Measurements ===\n');

  const { WindowManager } = require('../dist/main/window-manager');
  const { TabStateStore } = require('../dist/main/tab-state-store');

  const tInitStart = performance.now();
  const windowManager = new WindowManager();
  const win = windowManager.createWindow();
  const tWindowCreated = performance.now();
  console.log(`[Metric] Window creation latency: ${(tWindowCreated - tInitStart).toFixed(2)} ms`);

  await new Promise((resolve) => {
    win.webContents.once('did-finish-load', resolve);
  });
  const tRendererLoaded = performance.now();
  console.log(`[Metric] Tab bar renderer finish-load latency: ${(tRendererLoaded - tWindowCreated).toFixed(2)} ms`);

  const tabManager = windowManager.getTabManager();
  assert(tabManager !== null);

  // Measure tab switching latency
  const tTabCreate1 = performance.now();
  const tab1 = tabManager.createTab('https://chatgpt.com', true, 'perf-tab-1', 'Tab 1');
  const tTabCreate2 = performance.now();
  const tab2 = tabManager.createTab('https://chatgpt.com', false, 'perf-tab-2', 'Tab 2');
  const tTabCreate3 = performance.now();
  const tab3 = tabManager.createTab('https://chatgpt.com', false, 'perf-tab-3', 'Tab 3');
  const tTabsCreated = performance.now();

  console.log(`[Metric] 3 WebContentsViews creation: ${(tTabsCreated - tTabCreate1).toFixed(2)} ms (avg ${((tTabsCreated - tTabCreate1)/3).toFixed(2)} ms/tab)`);

  // Measure tab switching
  const switchTimes = [];
  for (let i = 0; i < 5; i++) {
    const sStart = performance.now();
    tabManager.selectTab(tab2.id);
    const sMid = performance.now();
    tabManager.selectTab(tab1.id);
    const sEnd = performance.now();
    switchTimes.push(sMid - sStart);
    switchTimes.push(sEnd - sMid);
  }
  const avgSwitch = switchTimes.reduce((a, b) => a + b, 0) / switchTimes.length;
  console.log(`[Metric] Tab switching latency (10 switches): avg ${avgSwitch.toFixed(2)} ms (min ${Math.min(...switchTimes).toFixed(2)} ms, max ${Math.max(...switchTimes).toFixed(2)} ms)`);

  // Measure memory
  const memMetrics = app.getAppMetrics();
  console.log(`\n[Resource Usage] Active processes: ${memMetrics.length}`);
  let totalMemoryKB = 0;
  for (const m of memMetrics) {
    totalMemoryKB += m.memory.workingSetSize;
    console.log(` - Process PID ${m.pid} (${m.type}): WorkingSet=${(m.memory.workingSetSize / 1024).toFixed(2)} MB, CPU=${m.cpu.percentCPUUsage.toFixed(1)}%`);
  }
  console.log(`[Resource Usage] Total WorkingSet: ${(totalMemoryKB / 1024).toFixed(2)} MB`);

  // Test Theme propagation to WebContentsView
  console.log('\n[Theme Diagnostics]');
  console.log(` - Initial nativeTheme.themeSource: ${nativeTheme.themeSource}`);
  console.log(` - nativeTheme.shouldUseDarkColors: ${nativeTheme.shouldUseDarkColors}`);
  
  // Clean up
  tabManager.closeTab(tab1.id);
  tabManager.closeTab(tab2.id);
  tabManager.closeTab(tab3.id);
  win.close();

  const tTotal = performance.now() - t0;
  console.log(`\nTotal diagnostics run time: ${tTotal.toFixed(2)} ms`);
  console.log('=== Diagnostics Completed ===\n');
  app.quit();
}

app.whenReady().then(runDiagnostics).catch(err => {
  console.error('Diagnostics failed:', err);
  process.exit(1);
});
