export interface TabItem {
  id: string;
  title: string;
  url: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  favicon?: string;
}

export interface TabPersistedData {
  id: string;
  url: string;
  title: string;
}

export interface TabsPersistedState {
  version: number;
  tabs: TabPersistedData[];
  activeTabId: string | null;
}

export interface TabStatePayload {
  tabs: TabItem[];
  activeTabId: string | null;
}

export type ThemeMode = 'system' | 'dark' | 'light';

export interface ThemeStatePayload {
  themeMode: ThemeMode;
  isDark: boolean;
}

export const IPC_CHANNELS = {
  // Main -> Renderer
  TABS_STATE_UPDATE: 'tabs:state-update',
  THEME_UPDATE: 'theme:update',
  THEME_CHANGED: 'theme:changed',
  FULLSCREEN_UPDATE: 'window:fullscreen-update',
  
  // Renderer -> Main
  TAB_CREATE: 'tabs:create',
  TAB_CLOSE: 'tabs:close',
  TAB_SELECT: 'tabs:select',
  TAB_RELOAD: 'tabs:reload',
  TAB_REORDER: 'tabs:reorder',
  TAB_NAVIGATE_BACK: 'tabs:go-back',
  TAB_NAVIGATE_FORWARD: 'tabs:go-forward',
  GET_INITIAL_STATE: 'tabs:get-initial-state',

  // Theme Sync
  THEME_GET: 'theme:get',
  GET_THEME: 'theme:get',
  SET_THEME: 'theme:set'
} as const;
