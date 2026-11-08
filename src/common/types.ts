export type LayoutMode = 'chat-only' | 'split' | 'browser-only';

export type ThemeMode = 'system' | 'dark' | 'light';

export interface ThemeStatePayload {
  themeMode: ThemeMode;
  isDark: boolean;
  systemIsDark: boolean;
}

export interface UserSettings {
  themeMode: ThemeMode;
  zoomFactor: number;
  layoutMode: LayoutMode;
  splitRatio: number;
}

export type TabTypeOverride = 'auto' | 'chat' | 'work';
export type ConversationType = 'chat' | 'work' | 'unknown';

export interface TabItem {
  id: string;
  url: string;
  title: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  favicon?: string;
  typeOverride?: TabTypeOverride;
  conversationType?: ConversationType;
}

export interface TabStatePayload {
  tabs: TabItem[];
  activeTabId: string | null;
}

export interface TabsPersistedState {
  version: number;
  tabs: {
    id: string;
    url: string;
    title: string;
    typeOverride?: TabTypeOverride;
    conversationType?: ConversationType;
  }[];
  activeTabId: string | null;
}

export interface BrowserTabItem {
  id: string;
  url: string;
  title: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  favicon?: string;
}

export interface BrowserPersistedState {
  tabs: { id: string; url: string; title: string }[];
  activeTabId: string | null;
  layoutMode: LayoutMode;
  splitRatio: number;
}

export interface BrowserStatePayload {
  tabs: BrowserTabItem[];
  activeTabId: string | null;
  layoutMode: LayoutMode;
  splitRatio: number;
  visible?: boolean;
}

export interface UpdateInfoPayload {
  status: 'checking' | 'available' | 'not-available' | 'error';
  currentVersion: string;
  latestVersion?: string;
  releaseNotes?: string;
  errorMessage?: string;
  releaseUrl?: string;
  hasUpdate?: boolean;
  checkedAt?: string;
}

export const IPC_CHANNELS = {
  // Main -> Renderer
  TABS_STATE_UPDATE: 'tabs:state-update',
  THEME_UPDATE: 'theme:update',
  THEME_CHANGED: 'theme:changed',
  FULLSCREEN_UPDATE: 'window:fullscreen-update',
  ZOOM_UPDATE: 'zoom:update',
  BROWSER_STATE_UPDATE: 'browser:state-update',
  
  // Renderer -> Main (ChatGPT Tabs)
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

  // Theme Sync
  THEME_GET: 'theme:get',
  GET_THEME: 'theme:get',
  SET_THEME: 'theme:set',

  // Zoom Sync
  ZOOM_GET: 'zoom:get',
  ZOOM_SET: 'zoom:set',
  ZOOM_RESET: 'zoom:reset',

  // Side Browser Split-View
  BROWSER_TOGGLE: 'browser:toggle',
  BROWSER_GET_STATE: 'browser:get-state',
  BROWSER_SET_LAYOUT: 'browser:set-layout',
  BROWSER_SET_SPLIT_RATIO: 'browser:set-split-ratio',
  BROWSER_TAB_CREATE: 'browser:tab-create',
  BROWSER_TAB_CLOSE: 'browser:tab-close',
  BROWSER_TAB_SELECT: 'browser:tab-select',
  BROWSER_NAVIGATE: 'browser:navigate',
  BROWSER_BACK: 'browser:back',
  BROWSER_FORWARD: 'browser:forward',
  BROWSER_RELOAD: 'browser:reload',

  // Application Updater & External
  CHECK_FOR_UPDATES: 'app:check-for-updates',
  OPEN_EXTERNAL: 'app:open-external'
} as const;
