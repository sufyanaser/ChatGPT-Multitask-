import { contextBridge, ipcRenderer } from 'electron';
import type { TabStatePayload, ThemeMode, ThemeStatePayload, TabTypeOverride } from '../common/types';

const IPC = {
  TABS_STATE_UPDATE: 'tabs:state-update',
  THEME_UPDATE: 'theme:update',
  THEME_CHANGED: 'theme:changed',
  FULLSCREEN_UPDATE: 'window:fullscreen-update',
  ZOOM_UPDATE: 'zoom:update',
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
  THEME_GET: 'theme:get',
  GET_THEME: 'theme:get',
  SET_THEME: 'theme:set',
  ZOOM_GET: 'zoom:get',
  ZOOM_SET: 'zoom:set',
  ZOOM_RESET: 'zoom:reset'
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
  }
};

contextBridge.exposeInMainWorld('api', api);
