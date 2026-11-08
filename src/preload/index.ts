import { contextBridge, ipcRenderer } from 'electron';
import type {
  TabItem,
  TabStatePayload,
  ThemeMode,
  ThemeStatePayload,
  TabTypeOverride,
  LayoutMode,
  BrowserStatePayload,
  UpdateInfoPayload,
  UpdateDownloadProgress,
  UpdateDownloadedPayload,
  UpdateErrorPayload,
  UpdateDownloadResult
} from '../common/types';

/**
 * Sandboxed preload scripts cannot require local modules, so the channel
 * contract is mirrored here as string literals. Keep this map in sync with
 * IPC_CHANNELS in src/common/types.ts (unit tests assert both surfaces).
 */
const IPC = {
  TABS_STATE_UPDATE: 'tabs:state-update',
  THEME_UPDATE: 'theme:update',
  THEME_CHANGED: 'theme:changed',
  FULLSCREEN_UPDATE: 'window:fullscreen-update',
  ZOOM_UPDATE: 'zoom:update',
  BROWSER_STATE_UPDATE: 'browser:state-update',

  TAB_CREATE: 'tabs:create',
  TAB_CLOSE: 'tabs:close',
  TAB_SELECT: 'tabs:select',
  TAB_RELOAD: 'tabs:reload',
  TAB_REORDER: 'tabs:reorder',
  TAB_NAVIGATE_BACK: 'tabs:go-back',
  TAB_NAVIGATE_FORWARD: 'tabs:go-forward',
  TAB_SET_TYPE: 'tabs:set-type',
  TAB_SHOW_CONTEXT_MENU: 'tabs:show-context-menu',
  GET_INITIAL_STATE: 'tabs:get-initial-state',

  GET_THEME: 'theme:get',
  SET_THEME: 'theme:set',

  ZOOM_GET: 'zoom:get',
  ZOOM_SET: 'zoom:set',
  ZOOM_RESET: 'zoom:reset',

  BROWSER_TOGGLE: 'browser:toggle',
  BROWSER_GET_STATE: 'browser:get-state',
  BROWSER_SET_LAYOUT: 'browser:set-layout',
  BROWSER_SET_SPLIT_RATIO: 'browser:set-split-ratio',
  BROWSER_SPLIT_DRAG_START: 'browser:split-drag-start',
  BROWSER_SPLIT_DRAG_END: 'browser:split-drag-end',
  UI_OVERLAY_RESERVE: 'ui:overlay-reserve',
  BROWSER_TAB_CREATE: 'browser:tab-create',
  BROWSER_TAB_CLOSE: 'browser:tab-close',
  BROWSER_TAB_SELECT: 'browser:tab-select',
  BROWSER_NAVIGATE: 'browser:navigate',
  BROWSER_BACK: 'browser:back',
  BROWSER_FORWARD: 'browser:forward',
  BROWSER_RELOAD: 'browser:reload',

  CHECK_FOR_UPDATES: 'app:check-for-updates',
  GET_APP_VERSION: 'app:get-version',
  OPEN_EXTERNAL: 'app:open-external',
  OPEN_UPDATE_DIALOG: 'app:open-update-dialog',

  START_DOWNLOAD: 'updater:start-download',
  CANCEL_DOWNLOAD: 'updater:cancel-download',
  DOWNLOAD_PROGRESS: 'updater:download-progress',
  UPDATE_DOWNLOADED: 'updater:downloaded',
  UPDATE_CANCELED: 'updater:canceled',
  QUIT_AND_INSTALL: 'updater:quit-and-install',
  UPDATE_ERROR: 'updater:error'
} as const;

export interface ElectronTabAPI {
  platform: string;
  createTab: (url?: string) => void;
  closeTab: (tabId: string) => void;
  selectTab: (tabId: string) => void;
  reloadTab: (tabId?: string) => void;
  reorderTabs: (sourceIndex: number, targetIndex: number) => void;
  navigateBack: (tabId?: string) => void;
  navigateForward: (tabId?: string) => void;
  setTabType: (tabId: string, typeOverride: TabTypeOverride) => void;
  showTabContextMenu: (tabId: string) => void;
  getInitialState: () => Promise<TabStatePayload>;
  onStateUpdate: (callback: (payload: TabStatePayload) => void) => () => void;
  getTheme: () => Promise<ThemeStatePayload | 'dark' | 'light'>;
  setTheme: (mode: ThemeMode) => void;
  onThemeUpdate: (callback: (themeOrPayload: any) => void) => () => void;
  onFullscreenUpdate: (callback: (isFullscreen: boolean) => void) => () => void;
  getZoom: () => Promise<number>;
  setZoom: (zoomFactor: number) => Promise<number>;
  resetZoom: () => Promise<number>;
  onZoomUpdate: (callback: (zoomFactor: number) => void) => () => void;

  // Side Browser API
  toggleBrowser: () => void;
  getBrowserState: () => Promise<BrowserStatePayload>;
  setLayoutMode: (mode: LayoutMode) => void;
  setSplitRatio: (ratio: number) => void;
  splitDragStart: () => void;
  splitDragEnd: () => void;
  setOverlayReserve: (widthPx: number) => void;
  createBrowserTab: (url?: string) => void;
  closeBrowserTab: (tabId: string) => void;
  selectBrowserTab: (tabId: string) => void;
  navigateBrowser: (urlOrTabId: string, maybeUrl?: string) => void;
  navigateBrowserBack: (tabId?: string) => void;
  navigateBrowserForward: (tabId?: string) => void;
  reloadBrowser: (tabId?: string) => void;
  browserBack: (tabId?: string) => void;
  browserForward: (tabId?: string) => void;
  browserReload: (tabId?: string) => void;
  onBrowserStateUpdate: (callback: (payload: BrowserStatePayload) => void) => () => void;

  // Updater API & External
  checkForUpdates: () => Promise<UpdateInfoPayload>;
  getAppVersion: () => Promise<string>;
  startDownload: () => Promise<UpdateDownloadResult>;
  startDownloadUpdate: () => Promise<UpdateDownloadResult>;
  cancelDownload: () => void;
  quitAndInstall: () => void;
  onDownloadProgress: (callback: (progress: UpdateDownloadProgress) => void) => () => void;
  onUpdateDownloadProgress: (callback: (progress: UpdateDownloadProgress) => void) => () => void;
  onUpdateDownloaded: (callback: (payload: UpdateDownloadedPayload) => void) => () => void;
  onUpdateCanceled: (callback: () => void) => () => void;
  onUpdateError: (callback: (payload: UpdateErrorPayload) => void) => () => void;
  openExternal: (url: string) => Promise<void>;
  onOpenUpdateDialog: (callback: () => void) => () => void;
}

const api: ElectronTabAPI = {
  platform: process.platform,

  createTab: (url?: string) => {
    ipcRenderer.send(IPC.TAB_CREATE, url);
  },

  closeTab: (tabId: string) => {
    ipcRenderer.send(IPC.TAB_CLOSE, tabId);
  },

  selectTab: (tabId: string) => {
    ipcRenderer.send(IPC.TAB_SELECT, tabId);
  },

  reloadTab: (tabId?: string) => {
    ipcRenderer.send(IPC.TAB_RELOAD, tabId);
  },

  reorderTabs: (sourceIndex: number, targetIndex: number) => {
    ipcRenderer.send(IPC.TAB_REORDER, { sourceIndex, targetIndex });
  },

  navigateBack: (tabId?: string) => {
    ipcRenderer.send(IPC.TAB_NAVIGATE_BACK, tabId);
  },

  navigateForward: (tabId?: string) => {
    ipcRenderer.send(IPC.TAB_NAVIGATE_FORWARD, tabId);
  },

  setTabType: (tabId: string, typeOverride: TabTypeOverride) => {
    ipcRenderer.send(IPC.TAB_SET_TYPE, { tabId, typeOverride });
  },

  showTabContextMenu: (tabId: string) => {
    ipcRenderer.send(IPC.TAB_SHOW_CONTEXT_MENU, tabId);
  },

  getInitialState: async (): Promise<TabStatePayload> => {
    return ipcRenderer.invoke(IPC.GET_INITIAL_STATE);
  },

  onStateUpdate: (callback: (payload: TabStatePayload) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: TabStatePayload) => {
      callback(payload);
    };
    ipcRenderer.on(IPC.TABS_STATE_UPDATE, listener);

    return () => {
      ipcRenderer.removeListener(IPC.TABS_STATE_UPDATE, listener);
    };
  },

  getTheme: async (): Promise<ThemeStatePayload | 'dark' | 'light'> => {
    return ipcRenderer.invoke(IPC.GET_THEME);
  },

  setTheme: (mode: ThemeMode) => {
    ipcRenderer.send(IPC.SET_THEME, mode);
  },

  onThemeUpdate: (callback: (themeOrPayload: any) => void) => {
    const updateListener = (_event: Electron.IpcRendererEvent, payload: ThemeStatePayload) => {
      callback(payload);
    };
    const changedListener = (_event: Electron.IpcRendererEvent, theme: 'dark' | 'light') => {
      callback(theme);
    };
    ipcRenderer.on(IPC.THEME_UPDATE, updateListener);
    ipcRenderer.on(IPC.THEME_CHANGED, changedListener);

    return () => {
      ipcRenderer.removeListener(IPC.THEME_UPDATE, updateListener);
      ipcRenderer.removeListener(IPC.THEME_CHANGED, changedListener);
    };
  },

  onFullscreenUpdate: (callback: (isFullscreen: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, isFullscreen: boolean) => {
      callback(isFullscreen);
    };
    ipcRenderer.on(IPC.FULLSCREEN_UPDATE, listener);

    return () => {
      ipcRenderer.removeListener(IPC.FULLSCREEN_UPDATE, listener);
    };
  },

  getZoom: async (): Promise<number> => {
    return ipcRenderer.invoke(IPC.ZOOM_GET);
  },

  setZoom: async (zoomFactor: number): Promise<number> => {
    return ipcRenderer.invoke(IPC.ZOOM_SET, zoomFactor);
  },

  resetZoom: async (): Promise<number> => {
    return ipcRenderer.invoke(IPC.ZOOM_RESET);
  },

  onZoomUpdate: (callback: (zoomFactor: number) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, factor: number) => {
      callback(factor);
    };
    ipcRenderer.on(IPC.ZOOM_UPDATE, listener);

    return () => {
      ipcRenderer.removeListener(IPC.ZOOM_UPDATE, listener);
    };
  },

  // Side Browser methods
  toggleBrowser: () => {
    ipcRenderer.send(IPC.BROWSER_TOGGLE);
  },

  getBrowserState: async (): Promise<BrowserStatePayload> => {
    return ipcRenderer.invoke(IPC.BROWSER_GET_STATE);
  },

  setLayoutMode: (mode: LayoutMode) => {
    ipcRenderer.send(IPC.BROWSER_SET_LAYOUT, mode);
  },

  setSplitRatio: (ratio: number) => {
    ipcRenderer.send(IPC.BROWSER_SET_SPLIT_RATIO, ratio);
  },

  splitDragStart: () => {
    ipcRenderer.send(IPC.BROWSER_SPLIT_DRAG_START);
  },

  splitDragEnd: () => {
    ipcRenderer.send(IPC.BROWSER_SPLIT_DRAG_END);
  },

  // Width of the right-hand strip the update popover occupies. The views shrink
  // by this amount so the root-level popover is not covered by a WebContentsView.
  setOverlayReserve: (widthPx: number) => {
    ipcRenderer.send(IPC.UI_OVERLAY_RESERVE, widthPx);
  },

  createBrowserTab: (url?: string) => {
    ipcRenderer.send(IPC.BROWSER_TAB_CREATE, url);
  },

  closeBrowserTab: (tabId: string) => {
    ipcRenderer.send(IPC.BROWSER_TAB_CLOSE, tabId);
  },

  selectBrowserTab: (tabId: string) => {
    ipcRenderer.send(IPC.BROWSER_TAB_SELECT, tabId);
  },

  navigateBrowser: (urlOrTabId: string, maybeUrl?: string) => {
    if (maybeUrl) {
      ipcRenderer.send(IPC.BROWSER_NAVIGATE, { tabId: urlOrTabId, url: maybeUrl });
    } else {
      ipcRenderer.send(IPC.BROWSER_NAVIGATE, { url: urlOrTabId });
    }
  },

  navigateBrowserBack: (tabId?: string) => {
    ipcRenderer.send(IPC.BROWSER_BACK, tabId);
  },

  navigateBrowserForward: (tabId?: string) => {
    ipcRenderer.send(IPC.BROWSER_FORWARD, tabId);
  },

  reloadBrowser: (tabId?: string) => {
    ipcRenderer.send(IPC.BROWSER_RELOAD, tabId);
  },

  browserBack: (tabId?: string) => {
    ipcRenderer.send(IPC.BROWSER_BACK, tabId);
  },

  browserForward: (tabId?: string) => {
    ipcRenderer.send(IPC.BROWSER_FORWARD, tabId);
  },

  browserReload: (tabId?: string) => {
    ipcRenderer.send(IPC.BROWSER_RELOAD, tabId);
  },

  onBrowserStateUpdate: (callback: (payload: BrowserStatePayload) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: BrowserStatePayload) => {
      callback(payload);
    };
    ipcRenderer.on(IPC.BROWSER_STATE_UPDATE, listener);

    return () => {
      ipcRenderer.removeListener(IPC.BROWSER_STATE_UPDATE, listener);
    };
  },

  // Updater methods
  checkForUpdates: async (): Promise<UpdateInfoPayload> => {
    return ipcRenderer.invoke(IPC.CHECK_FOR_UPDATES);
  },

  getAppVersion: async (): Promise<string> => {
    return ipcRenderer.invoke(IPC.GET_APP_VERSION);
  },

  startDownload: async (): Promise<UpdateDownloadResult> => {
    return ipcRenderer.invoke(IPC.START_DOWNLOAD);
  },

  startDownloadUpdate: async (): Promise<UpdateDownloadResult> => {
    return api.startDownload();
  },

  cancelDownload: (): void => {
    ipcRenderer.send(IPC.CANCEL_DOWNLOAD);
  },

  quitAndInstall: (): void => {
    ipcRenderer.send(IPC.QUIT_AND_INSTALL);
  },

  onDownloadProgress: (callback: (progress: UpdateDownloadProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: UpdateDownloadProgress) => {
      callback(progress);
    };
    ipcRenderer.on(IPC.DOWNLOAD_PROGRESS, listener);
    return () => {
      ipcRenderer.removeListener(IPC.DOWNLOAD_PROGRESS, listener);
    };
  },

  onUpdateDownloadProgress: (callback: (progress: UpdateDownloadProgress) => void) => {
    return api.onDownloadProgress(callback);
  },

  onUpdateDownloaded: (callback: (payload: UpdateDownloadedPayload) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: UpdateDownloadedPayload) => {
      callback(payload);
    };
    ipcRenderer.on(IPC.UPDATE_DOWNLOADED, listener);
    return () => {
      ipcRenderer.removeListener(IPC.UPDATE_DOWNLOADED, listener);
    };
  },

  onUpdateCanceled: (callback: () => void) => {
    const listener = () => {
      callback();
    };
    ipcRenderer.on(IPC.UPDATE_CANCELED, listener);
    return () => {
      ipcRenderer.removeListener(IPC.UPDATE_CANCELED, listener);
    };
  },

  onUpdateError: (callback: (payload: UpdateErrorPayload) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: UpdateErrorPayload) => {
      callback(payload);
    };
    ipcRenderer.on(IPC.UPDATE_ERROR, listener);
    return () => {
      ipcRenderer.removeListener(IPC.UPDATE_ERROR, listener);
    };
  },

  openExternal: async (url: string): Promise<void> => {
    return ipcRenderer.invoke(IPC.OPEN_EXTERNAL, url);
  },

  onOpenUpdateDialog: (callback: () => void) => {
    const listener = () => {
      callback();
    };
    ipcRenderer.on(IPC.OPEN_UPDATE_DIALOG, listener);

    return () => {
      ipcRenderer.removeListener(IPC.OPEN_UPDATE_DIALOG, listener);
    };
  }
};

contextBridge.exposeInMainWorld('api', api);
