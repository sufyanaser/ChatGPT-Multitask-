import { BrowserWindow, Menu, MenuItemConstructorOptions, app, ipcMain, nativeTheme } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { IPC_CHANNELS, ThemeMode, ThemeStatePayload } from '../common/types';
import { TabManager } from './tab-manager';

export class WindowManager {
  private window: BrowserWindow | null = null;
  private tabManager: TabManager | null = null;

  public createWindow(): BrowserWindow {
    const isMac = process.platform === 'darwin';
    nativeTheme.themeSource = 'system';
    const isDark = nativeTheme.shouldUseDarkColors;

    const assetsIcon = process.platform === 'win32'
      ? path.join(__dirname, '../../assets/icon.ico')
      : path.join(__dirname, '../../assets/icon.png');
    const buildIcon = path.join(__dirname, '../../build/icon.png');
    const iconPath = fs.existsSync(assetsIcon) ? assetsIcon : buildIcon;

    this.window = new BrowserWindow({
      width: 1280,
      height: 860,
      minWidth: 800,
      minHeight: 600,
      title: 'ChatGPT Multitask',
      backgroundColor: isDark ? '#212121' : '#f9f9f9',
      icon: iconPath,
      titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
      titleBarOverlay: isMac
        ? undefined
        : {
            color: isDark ? '#212121' : '#f9f9f9',
            symbolColor: isDark ? '#ffffff' : '#0d0d0d',
            height: 44
          },
      trafficLightPosition: isMac ? { x: 16, y: 15 } : undefined,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    this.tabManager = new TabManager(this.window);

    // Load Tab Bar UI
    const rendererPath = path.join(__dirname, '../renderer/index.html');
    this.window.loadFile(rendererPath);

    this.setupWindowEvents();
    this.setupThemeEvents();
    this.setupIpc();
    this.setupApplicationMenu();

    // When the tab bar HTML has finished loading, initialize or restore tabs
    this.window.webContents.once('did-finish-load', () => {
      if (this.tabManager) {
        this.tabManager.restoreSavedStateOrInit();
      }
      this.notifyThemeChanged();
    });

    return this.window;
  }

  public getWindow(): BrowserWindow | null {
    return this.window;
  }

  public getTabManager(): TabManager | null {
    return this.tabManager;
  }

  private setupWindowEvents(): void {
    if (!this.window) return;

    this.window.on('resize', () => {
      this.tabManager?.updateActiveViewBounds();
    });

    this.window.on('enter-full-screen', () => {
      this.tabManager?.updateActiveViewBounds();
      this.window?.webContents.send(IPC_CHANNELS.FULLSCREEN_UPDATE, true);
    });

    this.window.on('leave-full-screen', () => {
      this.tabManager?.updateActiveViewBounds();
      this.window?.webContents.send(IPC_CHANNELS.FULLSCREEN_UPDATE, false);
    });

    this.window.on('closed', () => {
      this.window = null;
      this.tabManager = null;
    });
  }

  private setupThemeEvents(): void {
    nativeTheme.on('updated', () => {
      if (!this.window || this.window.isDestroyed()) return;
      const dark = nativeTheme.shouldUseDarkColors;
      this.window.setBackgroundColor(dark ? '#212121' : '#f9f9f9');

      if (process.platform === 'win32') {
        try {
          this.window.setTitleBarOverlay({
            color: dark ? '#212121' : '#f9f9f9',
            symbolColor: dark ? '#ffffff' : '#0d0d0d',
            height: 44
          });
        } catch (e) {
          console.error('[WindowManager] Failed to update titleBarOverlay:', e);
        }
      }

      this.notifyThemeChanged();
      this.setupApplicationMenu();
    });
  }

  private getThemePayload(): ThemeStatePayload {
    return {
      themeMode: (nativeTheme.themeSource as ThemeMode) || 'system',
      isDark: nativeTheme.shouldUseDarkColors
    };
  }

  private notifyThemeChanged(): void {
    if (!this.window || this.window.isDestroyed()) return;
    const isDark = nativeTheme.shouldUseDarkColors;
    this.window.webContents.send(IPC_CHANNELS.THEME_UPDATE, this.getThemePayload());
    this.window.webContents.send(IPC_CHANNELS.THEME_CHANGED, isDark ? 'dark' : 'light');
  }

  private setupIpc(): void {
    ipcMain.removeHandler(IPC_CHANNELS.GET_INITIAL_STATE);
    ipcMain.handle(IPC_CHANNELS.GET_INITIAL_STATE, () => {
      return this.tabManager?.getStatePayload() ?? { tabs: [], activeTabId: null };
    });

    ipcMain.removeHandler(IPC_CHANNELS.GET_THEME);
    ipcMain.handle(IPC_CHANNELS.GET_THEME, () => {
      return this.getThemePayload();
    });

    ipcMain.removeHandler(IPC_CHANNELS.THEME_GET);
    ipcMain.handle(IPC_CHANNELS.THEME_GET, () => {
      return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    });

    ipcMain.removeAllListeners(IPC_CHANNELS.SET_THEME);
    ipcMain.on(IPC_CHANNELS.SET_THEME, (_event, mode: ThemeMode) => {
      nativeTheme.themeSource = mode;
      this.notifyThemeChanged();
    });

    ipcMain.removeAllListeners(IPC_CHANNELS.TAB_CREATE);
    ipcMain.on(IPC_CHANNELS.TAB_CREATE, (_event, url?: string) => {
      this.tabManager?.createTab(url);
    });

    ipcMain.removeAllListeners(IPC_CHANNELS.TAB_CLOSE);
    ipcMain.on(IPC_CHANNELS.TAB_CLOSE, (_event, tabId: string) => {
      this.tabManager?.closeTab(tabId);
    });

    ipcMain.removeAllListeners(IPC_CHANNELS.TAB_SELECT);
    ipcMain.on(IPC_CHANNELS.TAB_SELECT, (_event, tabId: string) => {
      this.tabManager?.selectTab(tabId);
    });

    ipcMain.removeAllListeners(IPC_CHANNELS.TAB_RELOAD);
    ipcMain.on(IPC_CHANNELS.TAB_RELOAD, (_event, tabId?: string) => {
      this.tabManager?.reloadTab(tabId);
    });

    ipcMain.removeAllListeners(IPC_CHANNELS.TAB_REORDER);
    ipcMain.on(IPC_CHANNELS.TAB_REORDER, (_event, { sourceIndex, targetIndex }: { sourceIndex: number; targetIndex: number }) => {
      this.tabManager?.reorderTabs(sourceIndex, targetIndex);
    });

    ipcMain.removeAllListeners(IPC_CHANNELS.TAB_NAVIGATE_BACK);
    ipcMain.on(IPC_CHANNELS.TAB_NAVIGATE_BACK, (_event, tabId?: string) => {
      this.tabManager?.navigateBack(tabId);
    });

    ipcMain.removeAllListeners(IPC_CHANNELS.TAB_NAVIGATE_FORWARD);
    ipcMain.on(IPC_CHANNELS.TAB_NAVIGATE_FORWARD, (_event, tabId?: string) => {
      this.tabManager?.navigateForward(tabId);
    });
  }

  private setupApplicationMenu(): void {
    const isMac = process.platform === 'darwin';
    const currentMode = nativeTheme.themeSource;

    if (!isMac) {
      Menu.setApplicationMenu(null);
      return;
    }

    const template: MenuItemConstructorOptions[] = [
      ...(isMac
        ? [
            {
              label: app.name,
              submenu: [
                { role: 'about' as const },
                { type: 'separator' as const },
                { role: 'services' as const },
                { type: 'separator' as const },
                { role: 'hide' as const },
                { role: 'hideOthers' as const },
                { role: 'unhide' as const },
                { type: 'separator' as const },
                { role: 'quit' as const }
              ]
            }
          ]
        : []),
      {
        label: 'File',
        submenu: [
          {
            label: 'New Tab',
            accelerator: 'CmdOrCtrl+T',
            click: () => this.tabManager?.createTab()
          },
          {
            label: 'Close Tab',
            accelerator: 'CmdOrCtrl+W',
            click: () => {
              const activeId = this.tabManager?.getActiveTabId();
              if (activeId) this.tabManager?.closeTab(activeId);
            }
          },
          { type: 'separator' },
          isMac ? { role: 'close' as const } : { role: 'quit' as const }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' as const },
          { role: 'redo' as const },
          { type: 'separator' as const },
          { role: 'cut' as const },
          { role: 'copy' as const },
          { role: 'paste' as const },
          { role: 'selectAll' as const }
        ]
      },
      {
        label: 'View',
        submenu: [
          {
            label: 'Reload Active Tab',
            accelerator: 'CmdOrCtrl+R',
            click: () => this.tabManager?.reloadTab()
          },
          {
            label: 'Next Tab',
            accelerator: 'Ctrl+Tab',
            click: () => this.tabManager?.selectNextTab()
          },
          {
            label: 'Previous Tab',
            accelerator: 'Ctrl+Shift+Tab',
            click: () => this.tabManager?.selectPreviousTab()
          },
          { type: 'separator' },
          {
            label: 'Appearance',
            submenu: [
              {
                label: 'Follow System',
                type: 'radio',
                checked: currentMode === 'system',
                click: () => {
                  nativeTheme.themeSource = 'system';
                  this.notifyThemeChanged();
                }
              },
              {
                label: 'Dark Mode',
                type: 'radio',
                checked: currentMode === 'dark',
                click: () => {
                  nativeTheme.themeSource = 'dark';
                  this.notifyThemeChanged();
                }
              },
              {
                label: 'Light Mode',
                type: 'radio',
                checked: currentMode === 'light',
                click: () => {
                  nativeTheme.themeSource = 'light';
                  this.notifyThemeChanged();
                }
              }
            ]
          },
          { type: 'separator' },
          { role: 'resetZoom' as const },
          { role: 'zoomIn' as const },
          { role: 'zoomOut' as const },
          { type: 'separator' },
          { role: 'togglefullscreen' as const }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' as const },
          { role: 'zoom' as const },
          ...(isMac
            ? [
                { type: 'separator' as const },
                { role: 'front' as const },
                { type: 'separator' as const },
                { role: 'window' as const }
              ]
            : [{ role: 'close' as const }])
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }
}
