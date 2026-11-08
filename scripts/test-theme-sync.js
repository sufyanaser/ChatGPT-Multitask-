const { app, BrowserWindow, WebContentsView, nativeTheme } = require('electron');

async function testThemeSync() {
  const win = new BrowserWindow({ width: 800, height: 600, show: false });
  const view = new WebContentsView();
  win.contentView.addChildView(view);
  view.setBounds({ x: 0, y: 0, width: 800, height: 600 });

  await view.webContents.loadURL('data:text/html,<html><body><h1>Test</h1></body></html>');

  console.log('--- Testing prefers-color-scheme propagation to WebContentsView ---');
  
  nativeTheme.themeSource = 'dark';
  let isDarkInWeb = await view.webContents.executeJavaScript("window.matchMedia('(prefers-color-scheme: dark)').matches");
  console.log(`themeSource='dark' -> webContents (prefers-color-scheme: dark): ${isDarkInWeb}`);

  nativeTheme.themeSource = 'light';
  let isLightInWeb = await view.webContents.executeJavaScript("window.matchMedia('(prefers-color-scheme: light)').matches");
  console.log(`themeSource='light' -> webContents (prefers-color-scheme: light): ${isLightInWeb}`);

  nativeTheme.themeSource = 'system';
  let isSystemInWeb = await view.webContents.executeJavaScript("window.matchMedia('(prefers-color-scheme: dark)').matches");
  console.log(`themeSource='system' -> webContents dark match: ${isSystemInWeb}`);

  win.close();
  app.quit();
}

app.whenReady().then(testThemeSync);
