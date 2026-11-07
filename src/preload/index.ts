import { contextBridge, ipcRenderer } from 'electron';
import type { TabStatePayload } from '../common/types';

const IPC = {
  TABS_STATE_UPDATE: 'tabs:state-update',
  TAB_CREATE: 'tabs:create',
  TAB_CLOSE: 'tabs:close',
  TAB_SELECT: 'tabs:select',
  TAB_RELOAD: 'tabs:reload',
  TAB_REORDER: 'tabs:reorder',
  TAB_NAVIGATE_BACK: 'tabs:go-back',
  TAB_NAVIGATE_FORWARD: 'tabs:go-forward',
  GET_INITIAL_STATE: 'tabs:get-initial-state',
  THEME_GET: 'theme:get',
  THEME_CHANGED: 'theme:changed'
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
  getInitialState: () => Promise<TabStatePayload>;
  onStateUpdate: (callback: (payload: TabStatePayload) => void) => () => void;
  getTheme: () => Promise<'dark' | 'light'>;
  onThemeUpdate: (callback: (theme: 'dark' | 'light') => void) => () => void;
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

  getTheme: async (): Promise<'dark' | 'light'> => {
    return ipcRenderer.invoke(IPC.THEME_GET);
  },

  onThemeUpdate: (callback: (theme: 'dark' | 'light') => void) => {
    const listener = (_event: Electron.IpcRendererEvent, theme: 'dark' | 'light') => {
      callback(theme);
    };
    ipcRenderer.on(IPC.THEME_CHANGED, listener);

    return () => {
      ipcRenderer.removeListener(IPC.THEME_CHANGED, listener);
    };
  }
};

contextBridge.exposeInMainWorld('api', api);
