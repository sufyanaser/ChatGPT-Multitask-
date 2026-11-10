import { BrowserWindow, Menu, MenuItemConstructorOptions, app, ipcMain, nativeTheme, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import {
  IPC_CHANNELS,
  ThemeMode,
  ThemeStatePayload,
  TabTypeOverride,
  LayoutMode,
  SPLIT_GUTTER_PX,
  UiStyle,
  UI_STYLES
} from '../common/types';
import { TabManager, TAB_BAR_HEIGHT } from './tab-manager';
import { SideBrowserManager } from './side-browser-manager';
import { SettingsStore } from './settings-store';
import { AppUpdater } from './auto-updater';

const MIN_CONTENT_WIDTH_PX = 240;

/**
 * Tab bar base surface per style, [dark, light]. Used for the window
 * background and the Windows caption-button overlay; must match --bg-bar for
 * the same style in src/renderer/index.css.
 */
const CHROME_COLORS: Record<UiStyle, [string, string]> = {
  classic: ['#181818', '#f3f3f3'],
  glass: ['#12141c', '#e9eef7'],
  aurora: ['#0d1117', '#eef2fb'],
  neumorph: ['#24262b', '#e6e9ef']
};

const UI_STYLE_LABELS: Record<UiStyle, string> = {
  classic: 'Classic',
  glass: 'Glass',
  aurora: 'Aurora',
  neumorph: 'Neumorphism'
};

function chromeColor(isDark: boolean, style: UiStyle): string {
  return (CHROME_COLORS[style] || CHROME_COLORS.classic)[isDark ? 0 : 1];
}

export class WindowManager {
  private window: BrowserWindow | null = null;
  private splitDragging = false;
  private overlayReserveWidth = 0;
  private uiStyle: UiStyle = 'classic';
  private tabManager: TabManager | null = null;
  private sideBrowserManager: SideBrowserManager | null = null;
  private settingsStore: SettingsStore;
  private appUpdater: AppUpdater;

  constructor() {
    this.settingsStore = new SettingsStore();
    // electron-updater registers process-wide listeners, so the updater is shared.
    this.appUpdater = AppUpdater.getInstance();
  }

  public createWindow(): BrowserWindow {
    const isMac = process.platform === 'darwin';
    const savedSettings = this.settingsStore.load();

    // Apply persisted theme mode and visual style
    nativeTheme.themeSource = savedSettings.themeMode;
    this.uiStyle = savedSettings.uiStyle;
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
      backgroundColor: chromeColor(isDark, this.uiStyle),
      icon: iconPath,
      titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
      titleBarOverlay: isMac
        ? undefined
        : {
            color: chromeColor(isDark, this.uiStyle),
            symbolColor: isDark ? '#ffffff' : '#0d0d0d',
            height: TAB_BAR_HEIGHT
          },
      trafficLightPosition: isMac ? { x: 16, y: 15 } : undefined,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    if (!isMac) {
      this.window.setMenuBarVisibility(false);
    }

    this.appUpdater.setMainWindow(this.window);

    this.tabManager = new TabManager(this.window);
    this.tabManager.initZoomFactor(savedSettings.zoomFactor);

    // Save zoom changes
    this.tabManager.setOnZoomChange((zoomFactor: number) => {
      this.settingsStore.save({ zoomFactor });
    });

    // Side browser manager for split-view
    this.sideBrowserManager = new SideBrowserManager(this.window);
    this.sideBrowserManager.initSettings(
      savedSettings.layoutMode || 'chat-only',
      savedSettings.splitRatio || 0.5
    );

    this.sideBrowserManager.setOnLayoutChange((layoutMode, splitRatio) => {
      // Live divider drags emit a ratio per frame; persist once on release.
      if (!this.splitDragging) {
        this.settingsStore.save({ layoutMode, splitRatio });
      }
      this.updateLayoutBounds();
    });

    // Persist tabs/side-browser state before an auto-update restart, so user
    // data and open conversations survive the upgrade.
    this.appUpdater.setBeforeQuitAndInstall(() => {
      this.tabManager?.flushPersistState();
      this.sideBrowserManager?.flushPersistState();
    });

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
      if (this.sideBrowserManager) {
        this.sideBrowserManager.restoreSavedStateOrInit();
      }
      this.updateLayoutBounds();
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

  public getSideBrowserManager(): SideBrowserManager | null {
    return this.sideBrowserManager;
  }

  /**
   * Single layout authority for the tab bar, chat view and side browser.
   * - Views are separated by SPLIT_GUTTER_PX so the renderer divider is hittable.
   * - Views stay attached while the divider is dragged: the renderer holds
   *   mouse capture from the gutter mousedown, so it keeps receiving moves over
   *   the views and both panes resize live.
   * - Root-level overlays (update popover) reserve a right-edge strip.
   */
  public updateLayoutBounds(): void {
    if (!this.window || this.window.isDestroyed()) return;
    const mode = this.sideBrowserManager?.getLayoutMode() || 'chat-only';
    const ratio = this.sideBrowserManager?.getSplitRatio() || 0.5;
    const bounds = this.window.getContentBounds();
    const totalW = bounds.width;
    const totalH = bounds.height;
    const contentH = Math.max(0, totalH - TAB_BAR_HEIGHT);
    const reserved = Math.min(this.overlayReserveWidth, Math.max(0, totalW - MIN_CONTENT_WIDTH_PX));

    const workW = Math.max(0, totalW - reserved);
    this.sideBrowserManager?.setLayoutConstraints(reserved, false);

    if (mode === 'browser-only') {
      this.tabManager?.setActiveViewVisible(false);
      this.sideBrowserManager?.updateActiveViewAttachment();
      return;
    }

    if (mode === 'chat-only') {
      this.tabManager?.setActiveViewVisible(true);
      this.tabManager?.updateActiveViewBounds({
        x: 0,
        y: TAB_BAR_HEIGHT,
        width: workW,
        height: contentH
      });
    } else if (mode === 'split') {
      const splitX = Math.round(workW * ratio);
      this.tabManager?.setActiveViewVisible(true);
      this.tabManager?.updateActiveViewBounds({
        x: 0,
        y: TAB_BAR_HEIGHT,
        width: Math.max(0, splitX - Math.ceil(SPLIT_GUTTER_PX / 2)),
        height: contentH
      });
    }
    this.sideBrowserManager?.updateActiveViewAttachment();
  }

  private beginSplitDrag(): void {
    this.splitDragging = true;
  }

  private endSplitDrag(): void {
    if (!this.splitDragging) return;
    this.splitDragging = false;
    if (this.sideBrowserManager) {
      this.settingsStore.save({
        layoutMode: this.sideBrowserManager.getLayoutMode(),
        splitRatio: this.sideBrowserManager.getSplitRatio()
      });
    }
    this.updateLayoutBounds();
  }

  private setupWindowEvents(): void {
    if (!this.window) return;

    this.window.on('resize', () => {
      this.updateLayoutBounds();
    });

    this.window.on('enter-full-screen', () => {
      this.updateLayoutBounds();
      this.window?.webContents.send(IPC_CHANNELS.FULLSCREEN_UPDATE, true);
    });

    this.window.on('leave-full-screen', () => {
      this.updateLayoutBounds();
      this.window?.webContents.send(IPC_CHANNELS.FULLSCREEN_UPDATE, false);
    });

    this.window.on('close', () => {
      this.tabManager?.flushPersistState();
      this.sideBrowserManager?.flushPersistState();
    });

    this.window.on('closed', () => {
      this.appUpdater.setMainWindow(null);
      this.tabManager?.destroy();
      this.sideBrowserManager?.destroy();
      this.window = null;
      this.tabManager = null;
      this.sideBrowserManager = null;
    });

    // The tab bar shell only ever renders local application content. Block any
    // attempt to navigate it away or to spawn additional BrowserWindows.
    this.window.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    this.window.webContents.on('will-navigate', (event, url) => {
      if (!/^file:\/\//i.test(url)) {
        event.preventDefault();
        if (/^https?:\/\//i.test(url)) {
          shell.openExternal(url);
        }
      }
    });

    // Keyboard shortcuts for tab bar window itself
    this.window.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      const isCtrl = process.platform === 'darwin' ? input.meta : input.control;

      if (isCtrl && (input.key === '=' || input.key === '+')) {
        event.preventDefault();
        this.tabManager?.zoomIn();
      } else if (isCtrl && input.key === '-') {
        event.preventDefault();
        this.tabManager?.zoomOut();
      } else if (isCtrl && input.key === '0') {
        event.preventDefault();
        this.tabManager?.resetZoom();
      } else if (isCtrl && input.key.toLowerCase() === 't') {
        event.preventDefault();
        this.tabManager?.createTab();
      } else if (isCtrl && input.key.toLowerCase() === 'w') {
        event.preventDefault();
        const activeId = this.tabManager?.getActiveTabId();
        if (activeId) this.tabManager?.closeTab(activeId);
      } else if (isCtrl && input.key.toLowerCase() === 'r') {
        event.preventDefault();
        this.tabManager?.reloadTab();
      } else if (isCtrl && input.key === 'Tab') {
        event.preventDefault();
        if (input.shift) {
          this.tabManager?.selectPreviousTab();
        } else {
          this.tabManager?.selectNextTab();
        }
      }
    });
  }

  private updateTitleBarOverlay(): void {
    if (process.platform === 'win32' && this.window && !this.window.isDestroyed()) {
      const isDark = nativeTheme.shouldUseDarkColors;
      try {
        this.window.setTitleBarOverlay({
          color: chromeColor(isDark, this.uiStyle),
          symbolColor: isDark ? '#ffffff' : '#0d0d0d',
          height: TAB_BAR_HEIGHT
        });
      } catch (e) {
        console.error('[WindowManager] Failed to update titleBarOverlay:', e);
      }
    }
  }

  private setupThemeEvents(): void {
    nativeTheme.on('updated', () => {
      if (!this.window || this.window.isDestroyed()) return;
      const isDark = nativeTheme.shouldUseDarkColors;
      this.window.setBackgroundColor(chromeColor(isDark, this.uiStyle));
      this.updateTitleBarOverlay();
      this.notifyThemeChanged();
      this.setupApplicationMenu();
    });
  }

  private getThemePayload(): ThemeStatePayload {
    return {
      themeMode: (nativeTheme.themeSource as ThemeMode) || 'system',
      isDark: nativeTheme.shouldUseDarkColors,
      systemIsDark: nativeTheme.shouldUseDarkColors,
      uiStyle: this.uiStyle
    };
  }

  /** Single entry point for changing light / dark / follow-system. */
  private setThemeMode(mode: ThemeMode): void {
    if (!['system', 'dark', 'light'].includes(mode)) return;
    nativeTheme.themeSource = mode;
    this.settingsStore.save({ themeMode: mode });
    this.applyChromeColors();
    this.notifyThemeChanged();
    this.setupApplicationMenu();
  }

  private setUiStyle(style: UiStyle): void {
    if (!UI_STYLES.includes(style)) return;
    this.uiStyle = style;
    this.settingsStore.save({ uiStyle: style });
    this.applyChromeColors();
    this.notifyThemeChanged();
    this.setupApplicationMenu();
  }

  private applyChromeColors(): void {
    if (!this.window || this.window.isDestroyed()) return;
    this.window.setBackgroundColor(chromeColor(nativeTheme.shouldUseDarkColors, this.uiStyle));
    this.updateTitleBarOverlay();
  }

  private buildAppearanceMenuItems(): MenuItemConstructorOptions[] {
    const mode = nativeTheme.themeSource;
    const modes: Array<[ThemeMode, string]> = [
      ['system', 'Follow System'],
      ['light', 'Light Mode'],
      ['dark', 'Dark Mode']
    ];
    return [
      ...modes.map(([value, label]): MenuItemConstructorOptions => ({
        label,
        type: 'radio',
        checked: mode === value,
        click: () => this.setThemeMode(value)
      })),
      { type: 'separator' },
      ...UI_STYLES.map((style): MenuItemConstructorOptions => ({
        label: `Style: ${UI_STYLE_LABELS[style]}`,
        type: 'radio',
        checked: this.uiStyle === style,
        click: () => this.setUiStyle(style)
      }))
    ];
  }

  /** Native menu, so it is never covered by a WebContentsView. */
  private showAppearanceMenu(): void {
    if (!this.window || this.window.isDestroyed()) return;
    Menu.buildFromTemplate(this.buildAppearanceMenuItems()).popup({ window: this.window });
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
      this.setThemeMode(mode);
    });

    ipcMain.removeAllListeners(IPC_CHANNELS.SET_UI_STYLE);
    ipcMain.on(IPC_CHANNELS.SET_UI_STYLE, (_event, style: UiStyle) => {
      this.setUiStyle(style);
    });

    ipcMain.removeAllListeners(IPC_CHANNELS.SHOW_APPEARANCE_MENU);
    ipcMain.on(IPC_CHANNELS.SHOW_APPEARANCE_MENU, () => {
      this.showAppearanceMenu();
    });

    // Zoom IPC handlers
    ipcMain.removeHandler(IPC_CHANNELS.ZOOM_GET);
    ipcMain.handle(IPC_CHANNELS.ZOOM_GET, () => {
      return this.tabManager?.getZoomFactor() ?? 1.0;
    });

    ipcMain.removeHandler(IPC_CHANNELS.ZOOM_SET);
    ipcMain.handle(IPC_CHANNELS.ZOOM_SET, (_event, factor: number) => {
      const newZoom = this.tabManager?.setZoomFactor(factor) ?? 1.0;
      this.settingsStore.save({ zoomFactor: newZoom });
      return newZoom;
    });

    ipcMain.removeHandler(IPC_CHANNELS.ZOOM_RESET);
    ipcMain.handle(IPC_CHANNELS.ZOOM_RESET, () => {
      const newZoom = this.tabManager?.resetZoom() ?? 1.0;
      this.settingsStore.save({ zoomFactor: newZoom });
      return newZoom;
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

    ipcMain.removeAllListeners(IPC_CHANNELS.TAB_SET_TYPE);
    ipcMain.on(IPC_CHANNELS.TAB_SET_TYPE, (_event, { tabId, typeOverride }: { tabId: string; typeOverride: TabTypeOverride }) => {
      this.tabManager?.setTabTypeOverride(tabId, typeOverride);
    });

    ipcMain.removeAllListeners(IPC_CHANNELS.TAB_SHOW_CONTEXT_MENU);
    ipcMain.on(IPC_CHANNELS.TAB_SHOW_CONTEXT_MENU, (_event, tabId: string) => {
      this.tabManager?.showTabContextMenu(tabId);
    });

    // Side Browser IPC handlers (Gate H)
    ipcMain.removeHandler(IPC_CHANNELS.BROWSER_GET_STATE);
    ipcMain.handle(IPC_CHANNELS.BROWSER_GET_STATE, () => {
      return this.sideBrowserManager?.getStatePayload() ?? {
        tabs: [],
        activeTabId: null,
        layoutMode: 'chat-only',
        splitRatio: 0.5
      };
    });

    ipcMain.removeAllListeners(IPC_CHANNELS.BROWSER_SET_LAYOUT);
    ipcMain.on(IPC_CHANNELS.BROWSER_SET_LAYOUT, (_event, mode: LayoutMode) => {
      this.sideBrowserManager?.setLayoutMode(mode);
    });

    ipcMain.removeAllListeners(IPC_CHANNELS.BROWSER_SET_SPLIT_RATIO);
    ipcMain.on(IPC_CHANNELS.BROWSER_SET_SPLIT_RATIO, (_event, ratio: number) => {
      this.sideBrowserManager?.setSplitRatio(ratio);
    });

    ipcMain.removeAllListeners(IPC_CHANNELS.BROWSER_SPLIT_DRAG_START);
    ipcMain.on(IPC_CHANNELS.BROWSER_SPLIT_DRAG_START, () => {
      this.beginSplitDrag();
    });

    ipcMain.removeAllListeners(IPC_CHANNELS.BROWSER_SPLIT_DRAG_END);
    ipcMain.on(IPC_CHANNELS.BROWSER_SPLIT_DRAG_END, () => {
      this.endSplitDrag();
    });

    ipcMain.removeAllListeners(IPC_CHANNELS.UI_OVERLAY_RESERVE);
    ipcMain.on(IPC_CHANNELS.UI_OVERLAY_RESERVE, (_event, widthPx: unknown) => {
      const next = typeof widthPx === 'number' && Number.isFinite(widthPx) ? Math.max(0, widthPx) : 0;
      if (next === this.overlayReserveWidth) return;
      this.overlayReserveWidth = next;
      this.updateLayoutBounds();
    });

    ipcMain.removeAllListeners(IPC_CHANNELS.BROWSER_TAB_CREATE);
    ipcMain.on(IPC_CHANNELS.BROWSER_TAB_CREATE, (_event, url?: string) => {
      this.sideBrowserManager?.createTab(url);
    });

    ipcMain.removeAllListeners(IPC_CHANNELS.BROWSER_TAB_CLOSE);
    ipcMain.on(IPC_CHANNELS.BROWSER_TAB_CLOSE, (_event, tabId: string) => {
      this.sideBrowserManager?.closeTab(tabId);
    });

    ipcMain.removeAllListeners(IPC_CHANNELS.BROWSER_TAB_SELECT);
    ipcMain.on(IPC_CHANNELS.BROWSER_TAB_SELECT, (_event, tabId: string) => {
      this.sideBrowserManager?.selectTab(tabId);
    });

    ipcMain.removeAllListeners(IPC_CHANNELS.BROWSER_NAVIGATE);
    ipcMain.on(IPC_CHANNELS.BROWSER_NAVIGATE, (_event, { tabId, url }: { tabId?: string; url: string }) => {
      this.sideBrowserManager?.navigate(tabId, url);
    });

    ipcMain.removeAllListeners(IPC_CHANNELS.BROWSER_BACK);
    ipcMain.on(IPC_CHANNELS.BROWSER_BACK, (_event, tabId?: string) => {
      this.sideBrowserManager?.goBack(tabId);
    });

    ipcMain.removeAllListeners(IPC_CHANNELS.BROWSER_FORWARD);
    ipcMain.on(IPC_CHANNELS.BROWSER_FORWARD, (_event, tabId?: string) => {
      this.sideBrowserManager?.goForward(tabId);
    });

    ipcMain.removeAllListeners(IPC_CHANNELS.BROWSER_RELOAD);
    ipcMain.on(IPC_CHANNELS.BROWSER_RELOAD, (_event, tabId?: string) => {
      this.sideBrowserManager?.reload(tabId);
    });

    ipcMain.removeAllListeners(IPC_CHANNELS.BROWSER_TOGGLE);
    ipcMain.on(IPC_CHANNELS.BROWSER_TOGGLE, () => {
      const current = this.sideBrowserManager?.getLayoutMode() || 'chat-only';
      const next: LayoutMode = current === 'chat-only' ? 'split' : 'chat-only';
      this.sideBrowserManager?.setLayoutMode(next);
    });

    // Check for updates IPC handler (UX-008)
    ipcMain.removeHandler(IPC_CHANNELS.CHECK_FOR_UPDATES);
    ipcMain.handle(IPC_CHANNELS.CHECK_FOR_UPDATES, async () => {
      return this.appUpdater.checkForUpdatesManually();
    });

    ipcMain.removeHandler(IPC_CHANNELS.GET_APP_VERSION);
    ipcMain.handle(IPC_CHANNELS.GET_APP_VERSION, () => {
      return app.getVersion();
    });

    // Open external URL safely
    ipcMain.removeHandler(IPC_CHANNELS.OPEN_EXTERNAL);
    ipcMain.handle(IPC_CHANNELS.OPEN_EXTERNAL, async (_event, url: string) => {
      if (/^https?:\/\//i.test(url)) {
        return shell.openExternal(url);
      }
    });

    // Start download IPC handler (supports START_DOWNLOAD / UPDATE_START_DOWNLOAD)
    ipcMain.removeHandler(IPC_CHANNELS.START_DOWNLOAD);
    ipcMain.handle(IPC_CHANNELS.START_DOWNLOAD, async () => {
      return this.appUpdater.startDownload();
    });

    // Cancel download IPC listener (supports CANCEL_DOWNLOAD / UPDATE_CANCEL_DOWNLOAD)
    ipcMain.removeAllListeners(IPC_CHANNELS.CANCEL_DOWNLOAD);
    ipcMain.on(IPC_CHANNELS.CANCEL_DOWNLOAD, () => {
      this.appUpdater.cancelDownload();
    });

    // Quit and install IPC listener (supports QUIT_AND_INSTALL / UPDATE_QUIT_AND_INSTALL)
    ipcMain.removeAllListeners(IPC_CHANNELS.QUIT_AND_INSTALL);
    ipcMain.on(IPC_CHANNELS.QUIT_AND_INSTALL, () => {
      this.appUpdater.quitAndInstall();
    });
  }

  private setupApplicationMenu(): void {
    const isMac = process.platform === 'darwin';
    const template: MenuItemConstructorOptions[] = [
      ...(isMac
        ? [
            {
              label: app.name,
              submenu: [
                { role: 'about' as const },
                { type: 'separator' as const },
                {
                  label: 'Check for Updates...',
                  click: async () => {
                    this.window?.webContents.send(IPC_CHANNELS.OPEN_UPDATE_DIALOG);
                  }
                },
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
            submenu: this.buildAppearanceMenuItems()
          },
          { type: 'separator' },
          {
            label: 'Actual Size',
            accelerator: 'CmdOrCtrl+0',
            click: () => {
              this.tabManager?.resetZoom();
            }
          },
          {
            label: 'Zoom In',
            accelerator: 'CmdOrCtrl+=',
            click: () => {
              this.tabManager?.zoomIn();
            }
          },
          {
            label: 'Zoom Out',
            accelerator: 'CmdOrCtrl+-',
            click: () => {
              this.tabManager?.zoomOut();
            }
          },
          { type: 'separator' },
          {
            label: 'Toggle Side Browser',
            accelerator: 'CmdOrCtrl+\\',
            click: () => {
              const current = this.sideBrowserManager?.getLayoutMode() || 'chat-only';
              const next: LayoutMode = current === 'chat-only' ? 'split' : 'chat-only';
              this.sideBrowserManager?.setLayoutMode(next);
            }
          },
          { type: 'separator' },
          { role: 'togglefullscreen' as const }
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Check for Updates...',
            click: () => {
              this.window?.webContents.send(IPC_CHANNELS.OPEN_UPDATE_DIALOG);
            }
          }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }
}
