import { BrowserWindow, WebContentsView, shell } from 'electron';
import { randomUUID } from 'crypto';
import { TabItem, TabStatePayload, IPC_CHANNELS } from '../common/types';
import { SessionManager } from './session-manager';
import { TabStateStore } from './tab-state-store';

export const TAB_BAR_HEIGHT = 44;
const DEFAULT_URL = 'https://chatgpt.com';

interface ManagedTab {
  id: string;
  view: WebContentsView;
  title: string;
  url: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  favicon?: string;
}

export class TabManager {
  private tabs: ManagedTab[] = [];
  private activeTabId: string | null = null;
  private window: BrowserWindow;
  private sessionManager: SessionManager;
  private stateStore: TabStateStore;
  private zoomFactor: number = 1.0;
  private onZoomChangeCallback?: (zoomFactor: number) => void;

  constructor(window: BrowserWindow) {
    this.window = window;
    this.sessionManager = SessionManager.getInstance();
    this.stateStore = new TabStateStore();
  }

  public getActiveTab(): ManagedTab | null {
    if (!this.activeTabId) return null;
    return this.tabs.find(t => t.id === this.activeTabId) || null;
  }

  public getTabs(): ManagedTab[] {
    return [...this.tabs];
  }

  public getActiveTabId(): string | null {
    return this.activeTabId;
  }

  public setOnZoomChange(callback: (zoomFactor: number) => void): void {
    this.onZoomChangeCallback = callback;
  }

  public initZoomFactor(factor: number): void {
    if (typeof factor === 'number' && !isNaN(factor)) {
      this.zoomFactor = Math.min(1.5, Math.max(0.8, Math.round(factor * 10) / 10));
    }
  }

  public getZoomFactor(): number {
    return this.zoomFactor;
  }

  public setZoomFactor(factor: number): number {
    const clamped = Math.min(1.5, Math.max(0.8, Math.round(factor * 10) / 10));
    this.zoomFactor = clamped;
    for (const tab of this.tabs) {
      try {
        tab.view.webContents.setZoomFactor(clamped);
      } catch (err) {
        console.warn(`[TabManager] Error setting zoom on tab ${tab.id}:`, err);
      }
    }
    this.onZoomChangeCallback?.(this.zoomFactor);
    this.notifyZoomChanged();
    return this.zoomFactor;
  }

  public zoomIn(): number {
    return this.setZoomFactor(this.zoomFactor + 0.1);
  }

  public zoomOut(): number {
    return this.setZoomFactor(this.zoomFactor - 0.1);
  }

  public resetZoom(): number {
    return this.setZoomFactor(1.0);
  }

  public createTab(
    url: string = DEFAULT_URL,
    selectAfterCreation: boolean = true,
    customId?: string,
    initialTitle?: string
  ): ManagedTab {
    const tabId = customId || randomUUID();
    const session = this.sessionManager.getSession();

    const view = new WebContentsView({
      webPreferences: {
        session,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        spellcheck: true
      }
    });

    try {
      view.webContents.setZoomFactor(this.zoomFactor);
    } catch (err) {
      console.warn('[TabManager] Initial zoom set error:', err);
    }

    const newTab: ManagedTab = {
      id: tabId,
      view,
      title: initialTitle || 'ChatGPT',
      url,
      isLoading: true,
      canGoBack: false,
      canGoForward: false
    };

    this.setupViewListeners(newTab);
    this.tabs.push(newTab);

    // Load URL
    view.webContents.loadURL(url).catch(err => {
      console.warn(`[TabManager] Failed to load URL ${url}:`, err);
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
      // Already active, just focus
      const active = this.getActiveTab();
      if (active) active.view.webContents.focus();
      return;
    }

    const targetTab = this.tabs.find(t => t.id === tabId);
    if (!targetTab) return;

    const previousActive = this.getActiveTab();
    if (previousActive) {
      try {
        this.window.contentView.removeChildView(previousActive.view);
      } catch (err) {
        console.warn('[TabManager] Error removing child view:', err);
      }
    }

    this.activeTabId = tabId;
    try {
      this.window.contentView.addChildView(targetTab.view);
      this.updateActiveViewBounds();
      targetTab.view.webContents.setZoomFactor(this.zoomFactor);
      targetTab.view.webContents.focus();
    } catch (err) {
      console.error('[TabManager] Error attaching active child view:', err);
    }

    this.notifyStateChanged();
    this.persistState();
  }

  public closeTab(tabId: string): void {
    const index = this.tabs.findIndex(t => t.id === tabId);
    if (index === -1) return;

    const tabToClose = this.tabs[index];

    // Detach and destroy view
    try {
      if (this.activeTabId === tabId) {
        this.window.contentView.removeChildView(tabToClose.view);
      }
      (tabToClose.view.webContents as any).close?.();
    } catch (err) {
      console.warn('[TabManager] Error closing webContents:', err);
    }

    this.tabs.splice(index, 1);

    // If active tab was closed, switch to adjacent tab
    if (this.activeTabId === tabId) {
      if (this.tabs.length > 0) {
        const nextIndex = Math.min(index, this.tabs.length - 1);
        this.activeTabId = null;
        this.selectTab(this.tabs[nextIndex].id);
      } else {
        this.activeTabId = null;
        // Keep at least one tab open
        this.createTab(DEFAULT_URL, true);
        return;
      }
    }

    this.notifyStateChanged();
    this.persistState();
  }

  public reorderTabs(sourceIndex: number, targetIndex: number): void {
    if (
      sourceIndex < 0 ||
      sourceIndex >= this.tabs.length ||
      targetIndex < 0 ||
      targetIndex >= this.tabs.length ||
      sourceIndex === targetIndex
    ) {
      return;
    }

    const [movedTab] = this.tabs.splice(sourceIndex, 1);
    this.tabs.splice(targetIndex, 0, movedTab);

    this.notifyStateChanged();
    this.persistState();
  }

  public reloadTab(tabId?: string): void {
    const target = tabId ? this.tabs.find(t => t.id === tabId) : this.getActiveTab();
    if (target) {
      target.view.webContents.reload();
    }
  }

  public navigateBack(tabId?: string): void {
    const target = tabId ? this.tabs.find(t => t.id === tabId) : this.getActiveTab();
    if (!target) return;
    const wc = target.view.webContents;
    const canBack = wc.navigationHistory ? wc.navigationHistory.canGoBack() : wc.canGoBack();
    if (canBack) {
      if (wc.navigationHistory) {
        wc.navigationHistory.goBack();
      } else {
        wc.goBack();
      }
    }
  }

  public navigateForward(tabId?: string): void {
    const target = tabId ? this.tabs.find(t => t.id === tabId) : this.getActiveTab();
    if (!target) return;
    const wc = target.view.webContents;
    const canForward = wc.navigationHistory ? wc.navigationHistory.canGoForward() : wc.canGoForward();
    if (canForward) {
      if (wc.navigationHistory) {
        wc.navigationHistory.goForward();
      } else {
        wc.goForward();
      }
    }
  }

  public selectNextTab(): void {
    if (this.tabs.length <= 1) return;
    const currentIndex = this.tabs.findIndex(t => t.id === this.activeTabId);
    const nextIndex = (currentIndex + 1) % this.tabs.length;
    this.selectTab(this.tabs[nextIndex].id);
  }

  public selectPreviousTab(): void {
    if (this.tabs.length <= 1) return;
    const currentIndex = this.tabs.findIndex(t => t.id === this.activeTabId);
    const prevIndex = (currentIndex - 1 + this.tabs.length) % this.tabs.length;
    this.selectTab(this.tabs[prevIndex].id);
  }

  public selectTabByIndex(index: number): void {
    if (index >= 0 && index < this.tabs.length) {
      this.selectTab(this.tabs[index].id);
    }
  }

  public updateActiveViewBounds(): void {
    const active = this.getActiveTab();
    if (!active || this.window.isDestroyed()) return;

    const bounds = this.window.getContentBounds();
    active.view.setBounds({
      x: 0,
      y: TAB_BAR_HEIGHT,
      width: bounds.width,
      height: Math.max(0, bounds.height - TAB_BAR_HEIGHT)
    });
  }

  public restoreSavedStateOrInit(): void {
    const saved = this.stateStore.load();
    if (saved && saved.tabs.length > 0) {
      console.log(`[TabManager] Restoring ${saved.tabs.length} tabs from saved state`);
      for (const t of saved.tabs) {
        this.createTab(t.url, false, t.id, t.title);
      }
      const initialTabId = (saved.activeTabId && this.tabs.some(t => t.id === saved.activeTabId))
        ? saved.activeTabId
        : this.tabs[0].id;
      this.selectTab(initialTabId);
    } else {
      console.log('[TabManager] Initializing default tab');
      this.createTab(DEFAULT_URL, true);
    }
  }

  public getStatePayload(): TabStatePayload {
    return {
      tabs: this.tabs.map(t => ({
        id: t.id,
        title: t.title,
        url: t.url,
        isLoading: t.isLoading,
        canGoBack: t.canGoBack,
        canGoForward: t.canGoForward,
        favicon: t.favicon
      })),
      activeTabId: this.activeTabId
    };
  }

  private setupViewListeners(tab: ManagedTab): void {
    const wc = tab.view.webContents;

    // Strict navigation control
    wc.on('will-navigate', (event, url) => {
      if (!this.sessionManager.isUrlAllowed(url)) {
        event.preventDefault();
        shell.openExternal(url);
      }
    });

    wc.setWindowOpenHandler(({ url }) => {
      if (this.sessionManager.isUrlAllowed(url)) {
        this.createTab(url, true);
        return { action: 'deny' };
      }
      shell.openExternal(url);
      return { action: 'deny' };
    });

    // Ensure zoom is applied when content finishes loading
    wc.on('did-finish-load', () => {
      try {
        wc.setZoomFactor(this.zoomFactor);
      } catch (err) {
        console.warn(`[TabManager] Failed to apply zoom to tab ${tab.id}:`, err);
      }
    });

    // Keyboard shortcuts forwarded from webview content
    wc.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      const isCtrl = process.platform === 'darwin' ? input.meta : input.control;

      if (isCtrl && (input.key === '=' || input.key === '+')) {
        event.preventDefault();
        this.zoomIn();
      } else if (isCtrl && input.key === '-') {
        event.preventDefault();
        this.zoomOut();
      } else if (isCtrl && input.key === '0') {
        event.preventDefault();
        this.resetZoom();
      } else if (isCtrl && input.key.toLowerCase() === 't') {
        event.preventDefault();
        this.createTab();
      } else if (isCtrl && input.key.toLowerCase() === 'w') {
        event.preventDefault();
        this.closeTab(tab.id);
      } else if (isCtrl && input.key.toLowerCase() === 'r') {
        event.preventDefault();
        this.reloadTab(tab.id);
      } else if (isCtrl && input.key === 'Tab') {
        event.preventDefault();
        if (input.shift) {
          this.selectPreviousTab();
        } else {
          this.selectNextTab();
        }
      }
    });

    // Title tracking
    wc.on('page-title-updated', (_event, rawTitle) => {
      let cleanTitle = (rawTitle || '').replace(/\s*-\s*ChatGPT\s*$/i, '').trim();
      if (!cleanTitle || cleanTitle.toLowerCase() === 'chatgpt') {
        cleanTitle = 'ChatGPT';
      }
      tab.title = cleanTitle;
      this.notifyStateChanged();
      this.persistState();
    });

    // Navigation tracking
    const onNavigated = () => {
      tab.url = wc.getURL();
      tab.canGoBack = wc.navigationHistory ? wc.navigationHistory.canGoBack() : wc.canGoBack();
      tab.canGoForward = wc.navigationHistory ? wc.navigationHistory.canGoForward() : wc.canGoForward();
      this.notifyStateChanged();
      this.persistState();
    };

    wc.on('did-navigate', onNavigated);
    wc.on('did-navigate-in-page', onNavigated);

    // Loading states
    wc.on('did-start-loading', () => {
      tab.isLoading = true;
      this.notifyStateChanged();
    });

    wc.on('did-stop-loading', () => {
      tab.isLoading = false;
      tab.canGoBack = wc.navigationHistory ? wc.navigationHistory.canGoBack() : wc.canGoBack();
      tab.canGoForward = wc.navigationHistory ? wc.navigationHistory.canGoForward() : wc.canGoForward();
      this.notifyStateChanged();
    });

    // Favicon
    wc.on('page-favicon-updated', (_event, favicons) => {
      if (favicons && favicons.length > 0) {
        tab.favicon = favicons[0];
        this.notifyStateChanged();
      }
    });
  }

  private notifyStateChanged(): void {
    if (this.window.isDestroyed()) return;
    const payload = this.getStatePayload();
    this.window.webContents.send(IPC_CHANNELS.TABS_STATE_UPDATE, payload);
  }

  private notifyZoomChanged(): void {
    if (this.window.isDestroyed()) return;
    this.window.webContents.send(IPC_CHANNELS.ZOOM_UPDATE, this.zoomFactor);
  }

  private persistState(): void {
    this.stateStore.save({
      version: 1,
      tabs: this.tabs.map(t => ({
        id: t.id,
        url: t.url,
        title: t.title
      })),
      activeTabId: this.activeTabId
    });
  }
}
