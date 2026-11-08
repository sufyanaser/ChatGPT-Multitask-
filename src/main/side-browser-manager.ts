import { BrowserWindow, WebContentsView, session, shell, Session } from 'electron';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import {
  BrowserTabItem,
  BrowserStatePayload,
  BrowserPersistedState,
  LayoutMode,
  IPC_CHANNELS
} from '../common/types';

const DEFAULT_BROWSER_URL = 'https://www.google.com';
const BROWSER_HEADER_HEIGHT = 38;
const TAB_BAR_HEIGHT = 44;

/**
 * ERR_ABORTED / ERR_FAILED(-2) rejections from loadURL are the normal result of
 * stopping a navigation because its view was closed, replaced, or the app is
 * shutting down. They are teardown cancellations, not navigation failures.
 */
function isExpectedNavigationCancellation(err: unknown, destroyed: boolean): boolean {
  if (destroyed) return true;
  const message = String((err as any)?.message || err || '');
  return /ERR_ABORTED|ERR_FAILED\s*\(-2\)|stopped loading|aborted/i.test(message);
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

interface ManagedBrowserTab {
  id: string;
  view: WebContentsView;
  title: string;
  url: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  favicon?: string;
}

export class SideBrowserManager {
  private tabs: ManagedBrowserTab[] = [];
  private activeTabId: string | null = null;
  private window: BrowserWindow;
  private browserSession: Session;
  private layoutMode: LayoutMode = 'chat-only';
  private splitRatio: number = 0.5;
  private storePath: string;
  private persistTimer: NodeJS.Timeout | null = null;
  private onLayoutChangeCallback?: (mode: LayoutMode, ratio: number) => void;
  private isDestroyed = false;

  constructor(window: BrowserWindow) {
    this.window = window;
    this.browserSession = session.fromPartition('persist:sidebrowser');
    this.configureSession(this.browserSession);
    const userData = app.getPath('userData');
    this.storePath = path.join(userData, 'browser-state.json');
  }

  public setOnLayoutChange(callback: (mode: LayoutMode, ratio: number) => void): void {
    this.onLayoutChangeCallback = callback;
  }

  public getLayoutMode(): LayoutMode {
    return this.layoutMode;
  }

  public getSplitRatio(): number {
    return this.splitRatio;
  }

  public setLayoutMode(mode: LayoutMode): void {
    if (this.layoutMode === mode) return;
    this.layoutMode = mode;
    this.onLayoutChangeCallback?.(this.layoutMode, this.splitRatio);
    this.updateActiveViewAttachment();
    this.notifyStateChanged();
    this.persistState();
  }

  public setSplitRatio(ratio: number): void {
    const clamped = Math.min(0.8, Math.max(0.2, Math.round(ratio * 100) / 100));
    if (this.splitRatio === clamped) return;
    this.splitRatio = clamped;
    this.onLayoutChangeCallback?.(this.layoutMode, this.splitRatio);
    this.updateActiveViewBounds();
    this.notifyStateChanged();
    this.persistState();
  }

  public initSettings(mode: LayoutMode, ratio: number): void {
    this.layoutMode = mode;
    this.splitRatio = Math.min(0.8, Math.max(0.2, ratio));
  }

  public getActiveTab(): ManagedBrowserTab | null {
    if (!this.activeTabId) return null;
    return this.tabs.find(t => t.id === this.activeTabId) || null;
  }

  public getTabs(): ManagedBrowserTab[] {
    return [...this.tabs];
  }

  public createTab(url: string = DEFAULT_BROWSER_URL, selectAfterCreation: boolean = true, customId?: string, initialTitle?: string): ManagedBrowserTab {
    const tabId = customId || randomUUID();

    const view = new WebContentsView({
      webPreferences: {
        session: this.browserSession,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        spellcheck: true
      }
    });

    const newTab: ManagedBrowserTab = {
      id: tabId,
      view,
      title: initialTitle || 'Browser',
      url,
      isLoading: true,
      canGoBack: false,
      canGoForward: false
    };

    this.setupViewListeners(newTab);
    this.tabs.push(newTab);

    // Format & load initial URL
    const targetUrl = this.formatNavigationUrl(url);
    view.webContents.loadURL(targetUrl).catch(err => {
      if (!isExpectedNavigationCancellation(err, this.isDestroyed)) {
        console.warn(`[SideBrowserManager] Failed to load ${targetUrl}:`, err?.message || err);
      }
    });

    if (selectAfterCreation || this.tabs.length === 1) {
      this.selectTab(tabId);
    } else {
      this.notifyStateChanged();
      this.persistState();
    }

    return newTab;
  }

  public selectTab(tabId: string): void {
    if (this.activeTabId === tabId) {
      const active = this.getActiveTab();
      if (active && (this.layoutMode === 'split' || this.layoutMode === 'browser-only')) {
        active.view.webContents.focus();
      }
      return;
    }

    const targetTab = this.tabs.find(t => t.id === tabId);
    if (!targetTab) return;

    const previous = this.getActiveTab();
    if (previous) {
      try {
        this.window.contentView.removeChildView(previous.view);
      } catch (err) {
        console.warn('[SideBrowserManager] Error removing child view:', err);
      }
    }

    this.activeTabId = tabId;
    this.updateActiveViewAttachment();

    this.notifyStateChanged();
    this.persistState();
  }

  public closeTab(tabId: string): void {
    const index = this.tabs.findIndex(t => t.id === tabId);
    if (index === -1) return;

    const toClose = this.tabs[index];
    try {
      if (this.activeTabId === tabId) {
        this.window.contentView.removeChildView(toClose.view);
      }
    } catch (err) {
      console.warn('[SideBrowserManager] Error detaching closed view:', err);
    }
    this.destroyView(toClose);

    this.tabs.splice(index, 1);

    if (this.activeTabId === tabId) {
      if (this.tabs.length > 0) {
        const nextIdx = Math.min(index, this.tabs.length - 1);
        this.activeTabId = null;
        this.selectTab(this.tabs[nextIdx].id);
      } else {
        this.activeTabId = null;
        this.createTab(DEFAULT_BROWSER_URL, true);
        return;
      }
    }

    this.notifyStateChanged();
    this.persistState();
  }

  /** Releases listeners and the WebContents for a tab that is being removed. */
  private destroyView(tab: ManagedBrowserTab): void {
    const wc = tab.view.webContents;
    try {
      if (!wc.isDestroyed()) {
        wc.close({ waitForBeforeUnload: false });
      }
    } catch (err) {
      console.warn('[SideBrowserManager] Error releasing webContents:', err);
    }
  }

  /** Persists state immediately (used before quit/update restart). */
  public flushPersistState(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.writePersistedState();
  }

  /** Tears down every tab and pending timer. Safe to call more than once. */
  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    for (const tab of this.tabs) {
      this.destroyView(tab);
    }
    this.tabs = [];
    this.activeTabId = null;
  }

  public navigate(tabId: string | undefined, inputUrl: string): void {
    const tab = tabId ? this.tabs.find(t => t.id === tabId) : this.getActiveTab();
    if (!tab) return;

    const targetUrl = this.formatNavigationUrl(inputUrl);
    tab.view.webContents.loadURL(targetUrl).catch(err => {
      if (!isExpectedNavigationCancellation(err, this.isDestroyed)) {
        console.warn(`[SideBrowserManager] Failed to navigate to ${targetUrl}:`, err);
      }
    });
  }

  public goBack(tabId?: string): void {
    const tab = tabId ? this.tabs.find(t => t.id === tabId) : this.getActiveTab();
    if (tab && tab.view.webContents.canGoBack()) {
      tab.view.webContents.goBack();
    }
  }

  public goForward(tabId?: string): void {
    const tab = tabId ? this.tabs.find(t => t.id === tabId) : this.getActiveTab();
    if (tab && tab.view.webContents.canGoForward()) {
      tab.view.webContents.goForward();
    }
  }

  public reload(tabId?: string): void {
    const tab = tabId ? this.tabs.find(t => t.id === tabId) : this.getActiveTab();
    if (tab) {
      tab.view.webContents.reload();
    }
  }

  public updateActiveViewAttachment(): void {
    const active = this.getActiveTab();
    if (!active || this.window.isDestroyed()) return;

    const shouldAttach = this.layoutMode === 'split' || this.layoutMode === 'browser-only';
    const isAttached = this.window.contentView.children.includes(active.view);

    if (shouldAttach) {
      if (!isAttached) {
        try {
          this.window.contentView.addChildView(active.view);
          active.view.webContents.focus();
        } catch (err) {
          console.error('[SideBrowserManager] Failed to attach child view:', err);
        }
      }
      this.updateActiveViewBounds();
    } else {
      if (isAttached) {
        try {
          this.window.contentView.removeChildView(active.view);
        } catch (err) {
          console.warn('[SideBrowserManager] Failed to detach child view:', err);
        }
      }
    }
  }

  public updateActiveViewBounds(): void {
    const active = this.getActiveTab();
    if (!active || this.window.isDestroyed()) return;

    if (this.layoutMode === 'chat-only') {
      return;
    }

    const bounds = this.window.getContentBounds();
    const totalW = bounds.width;
    const totalH = bounds.height;
    const contentH = Math.max(0, totalH - TAB_BAR_HEIGHT - BROWSER_HEADER_HEIGHT);

    if (this.layoutMode === 'browser-only') {
      active.view.setBounds({
        x: 0,
        y: TAB_BAR_HEIGHT + BROWSER_HEADER_HEIGHT,
        width: totalW,
        height: contentH
      });
    } else if (this.layoutMode === 'split') {
      const splitX = Math.round(totalW * this.splitRatio);
      const browserW = Math.max(0, totalW - splitX);
      active.view.setBounds({
        x: splitX,
        y: TAB_BAR_HEIGHT + BROWSER_HEADER_HEIGHT,
        width: browserW,
        height: contentH
      });
    }
  }

  public getStatePayload(): BrowserStatePayload {
    return {
      tabs: this.tabs.map(t => ({
        id: t.id,
        url: t.url,
        title: t.title,
        isLoading: t.isLoading,
        canGoBack: t.canGoBack,
        canGoForward: t.canGoForward,
        favicon: t.favicon
      })),
      activeTabId: this.activeTabId,
      layoutMode: this.layoutMode,
      splitRatio: this.splitRatio,
      visible: this.layoutMode !== 'chat-only'
    };
  }

  public restoreSavedStateOrInit(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        const raw = fs.readFileSync(this.storePath, 'utf-8');
        const data = JSON.parse(raw) as BrowserPersistedState;
        if (data && Array.isArray(data.tabs) && data.tabs.length > 0) {
          this.layoutMode = data.layoutMode || this.layoutMode;
          this.splitRatio = typeof data.splitRatio === 'number' ? data.splitRatio : this.splitRatio;

          for (const t of data.tabs) {
            this.createTab(t.url, false, t.id, t.title);
          }
          const initialId = (data.activeTabId && this.tabs.some(t => t.id === data.activeTabId))
            ? data.activeTabId
            : this.tabs[0].id;
          this.selectTab(initialId);
          return;
        }
      }
    } catch (err) {
      console.warn('[SideBrowserManager] Error loading browser state, initializing defaults:', err);
    }

    this.createTab(DEFAULT_BROWSER_URL, true);
  }

  private setupViewListeners(tab: ManagedBrowserTab): void {
    const wc = tab.view.webContents;

    wc.on('will-navigate', (event, url) => {
      if (!isHttpUrl(url)) {
        event.preventDefault();
        // Only well-known external schemes are handed to the OS.
        if (/^(mailto|tel|sms):/i.test(url)) {
          shell.openExternal(url);
        }
      }
    });

    wc.setWindowOpenHandler(({ url }) => {
      if (isHttpUrl(url)) {
        this.createTab(url, true);
        return { action: 'deny' };
      }
      if (/^(mailto|tel|sms):/i.test(url)) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    wc.on('page-title-updated', (_event, title) => {
      tab.title = title || 'Browser';
      this.notifyStateChanged();
      this.persistState();
    });

    const onNavigated = () => {
      tab.url = wc.getURL();
      tab.canGoBack = wc.canGoBack();
      tab.canGoForward = wc.canGoForward();
      this.notifyStateChanged();
      this.persistState();
    };

    wc.on('did-navigate', onNavigated);
    wc.on('did-navigate-in-page', onNavigated);

    wc.on('did-start-loading', () => {
      tab.isLoading = true;
      this.notifyStateChanged();
    });

    wc.on('did-stop-loading', () => {
      tab.isLoading = false;
      tab.canGoBack = wc.canGoBack();
      tab.canGoForward = wc.canGoForward();
      this.notifyStateChanged();
    });

    wc.on('page-favicon-updated', (_event, favicons) => {
      if (favicons && favicons.length > 0) {
        tab.favicon = favicons[0];
        this.notifyStateChanged();
      }
    });
  }

  private formatNavigationUrl(input: string): string {
    const trimmed = (input || '').trim();
    if (!trimmed) return DEFAULT_BROWSER_URL;

    // Explicit schemes: only HTTP(S) may be loaded inside the browser view.
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) {
      if (isHttpUrl(trimmed)) {
        return trimmed;
      }
      // Unknown or dangerous schemes are treated as a search query rather than
      // being passed to the privileged loadURL API.
      return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
    }

    // Check if it's a domain name (e.g. github.com, docs.python.org, localhost:3000)
    if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/.test(trimmed) || /^localhost(:\d+)?(\/.*)?$/.test(trimmed)) {
      return `https://${trimmed}`;
    }

    // Search query fallback
    return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
  }

  private configureSession(sess: Session): void {
    sess.setPermissionRequestHandler((_webContents, permission, callback) => {
      const allowed = ['clipboard-read', 'clipboard-sanitized-write', 'fullscreen'];
      callback(allowed.includes(permission));
    });
  }

  private notifyStateChanged(): void {
    if (this.isDestroyed || this.window.isDestroyed()) return;
    this.window.webContents.send(IPC_CHANNELS.BROWSER_STATE_UPDATE, this.getStatePayload());
  }

  private persistState(): void {
    if (this.isDestroyed) return;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.writePersistedState();
    }, 400);
  }

  private writePersistedState(): void {
    try {
      const payload: BrowserPersistedState = {
        tabs: this.tabs.map(t => ({ id: t.id, url: t.url, title: t.title })),
        activeTabId: this.activeTabId,
        layoutMode: this.layoutMode,
        splitRatio: this.splitRatio
      };
      fs.writeFileSync(this.storePath, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[SideBrowserManager] Failed to persist browser state:', err);
    }
  }
}
