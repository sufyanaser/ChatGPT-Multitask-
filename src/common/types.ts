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

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'no-release'
  | 'not-available'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'error';

export interface UpdateDownloadProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface UpdateDownloadedPayload {
  version: string;
  releaseNotes?: string;
}

export interface UpdateErrorPayload {
  message: string;
  code?: string;
}

export interface UpdateDownloadResult {
  success: boolean;
  error?: string;
  message?: string;
  canceled?: boolean;
}

export interface UpdateInfoPayload {
  status: UpdateStatus;
  currentVersion: string;
  latestVersion?: string;
  releaseNotes?: string;
  errorMessage?: string;
  releaseUrl?: string;
  hasUpdate?: boolean;
  checkedAt?: string;
  canAutoDownload?: boolean;
  downloadProgress?: UpdateDownloadProgress;
}

/**
 * Transparent gap between the chat and side-browser WebContentsViews. The
 * renderer divider lives inside this gap, so it is never covered by a view.
 */
export const SPLIT_GUTTER_PX = 6;

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

  // Application Updater & External
  CHECK_FOR_UPDATES: 'app:check-for-updates',
  GET_APP_VERSION: 'app:get-version',
  OPEN_EXTERNAL: 'app:open-external',
  OPEN_UPDATE_DIALOG: 'app:open-update-dialog',

  // Auto-Updater Pipeline
  START_DOWNLOAD: 'updater:start-download',
  CANCEL_DOWNLOAD: 'updater:cancel-download',
  DOWNLOAD_PROGRESS: 'updater:download-progress',
  UPDATE_DOWNLOADED: 'updater:downloaded',
  UPDATE_CANCELED: 'updater:canceled',
  QUIT_AND_INSTALL: 'updater:quit-and-install',
  UPDATE_ERROR: 'updater:error'
} as const;
