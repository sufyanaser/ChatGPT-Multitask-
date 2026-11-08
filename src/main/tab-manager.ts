import { BrowserWindow, Menu, WebContentsView, shell } from 'electron';
import { randomUUID } from 'crypto';
import { TabItem, TabStatePayload, IPC_CHANNELS, ConversationType, TabTypeOverride } from '../common/types';
import { SessionManager } from './session-manager';
import { TabStateStore } from './tab-state-store';
import { attachWebContextMenu } from './web-context-menu';

export const TAB_BAR_HEIGHT = 44;
const DEFAULT_URL = 'https://chatgpt.com';

/**
 * P0 Scoped Arabic RTL & Bidirectional Layout Engine.
 * High-specificity CSS rules strictly scoped to assistant markdown containers.
 */
export const RTL_SCOPED_CSS = `
/* Scoped Arabic RTL & Bidirectional Layout Engine */
.markdown[dir="rtl"], [data-message-author-role="assistant"] .prose[dir="rtl"] {
  direction: rtl;
  text-align: right;
}
.markdown[dir="rtl"] blockquote {
  border-left: none !important;
  border-right: 3px solid currentColor !important;
  padding-left: 0 !important;
  padding-right: 14px !important;
}
.markdown[dir="rtl"] ul, .markdown[dir="rtl"] ol {
  padding-left: 0 !important;
  padding-right: 24px !important;
  direction: rtl !important;
}
.markdown[dir="ltr"] ul, .markdown[dir="ltr"] ol {
  padding-right: 0 !important;
  padding-left: 24px !important;
  direction: ltr !important;
}
.markdown[dir="rtl"] table th, .markdown[dir="rtl"] table td {
  text-align: right;
}
/* Code blocks and inline code MUST stay strictly LTR */
.markdown pre, .markdown pre code, .markdown .code-block, pre {
  direction: ltr !important;
  text-align: left !important;
  unicode-bidi: isolate !important;
}
.markdown :not(pre) > code {
  unicode-bidi: isolate !important;
  direction: ltr !important;
  display: inline-block;
}
/* Mathematical expressions are always LTR, even inside Arabic turns */
.markdown .katex, .markdown .katex-display, .markdown math {
  direction: ltr !important;
  unicode-bidi: isolate !important;
  text-align: left !important;
}
/* Paragraph & heading level direction for mixed turns */
.markdown p[dir="rtl"], .markdown h1[dir="rtl"], .markdown h2[dir="rtl"], .markdown h3[dir="rtl"], .markdown h4[dir="rtl"], .markdown h5[dir="rtl"], .markdown h6[dir="rtl"],
.markdown li[dir="rtl"], .markdown blockquote[dir="rtl"], .markdown th[dir="rtl"], .markdown td[dir="rtl"] {
  direction: rtl !important;
  text-align: right !important;
  unicode-bidi: isolate !important;
}
.markdown p[dir="ltr"], .markdown h1[dir="ltr"], .markdown h2[dir="ltr"], .markdown h3[dir="ltr"], .markdown h4[dir="ltr"], .markdown h5[dir="ltr"], .markdown h6[dir="ltr"],
.markdown li[dir="ltr"], .markdown blockquote[dir="ltr"], .markdown th[dir="ltr"], .markdown td[dir="ltr"] {
  direction: ltr !important;
  text-align: left !important;
  unicode-bidi: isolate !important;
}
`;

/**
 * P0 Lightweight Idempotent MutationObserver Script.
 * Ensures dynamically rendered and streamed assistant messages receive accurate
 * directionality without being skewed by LTR code samples inside Arabic answers.
 */
export const RTL_OBSERVER_SCRIPT = `
(function() {
  if (window.__chatgptRtlInstalled) return;
  window.__chatgptRtlInstalled = true;

  var ARABIC_REGEX = /[\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF]/g;
  var LATIN_REGEX = /[A-Za-z]/g;
  var SKIP_SELECTOR = 'pre, code, script, style, svg, .katex, .katex-display';
  var SAMPLE_LIMIT = 400;

  function sampleText(el) {
    var text = '';
    try {
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node) {
          var parent = node.parentElement;
          if (!parent || parent.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var node;
      while ((node = walker.nextNode())) {
        text += node.nodeValue;
        if (text.length >= SAMPLE_LIMIT) break;
      }
    } catch (e) {
      text = (el.textContent || '');
    }
    return text.slice(0, SAMPLE_LIMIT);
  }

  function detectDir(text) {
    if (!text) return null;
    var clean = text.trim();
    if (!clean) return null;
    var arCount = (clean.match(ARABIC_REGEX) || []).length;
    if (arCount === 0) return 'ltr';
    var enCount = (clean.match(LATIN_REGEX) || []).length;
    return (arCount >= enCount * 0.3) ? 'rtl' : 'ltr';
  }

  function applyDir(el) {
    if (!el || el.nodeType !== 1) return;
    var dir = detectDir(sampleText(el));
    if (dir && el.getAttribute('dir') !== dir) {
      el.setAttribute('dir', dir);
    }
  }

  function applyRtl() {
    var markdowns = document.querySelectorAll('.markdown, [data-message-author-role="assistant"] .prose');
    for (var i = 0; i < markdowns.length; i++) {
      var md = markdowns[i];
      applyDir(md);
      var blocks = md.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th');
      for (var j = 0; j < blocks.length; j++) {
        applyDir(blocks[j]);
      }
    }
  }

  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    var run = function() {
      scheduled = false;
      try { applyRtl(); } catch (e) { /* never break the host page */ }
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(run);
    } else {
      setTimeout(run, 16);
    }
  }

  applyRtl();
  var observer = new MutationObserver(schedule);
  var target = document.body || document.documentElement;
  if (target) observer.observe(target, { childList: true, subtree: true, characterData: true });
})();
`;


interface ManagedTab {
  id: string;
  view: WebContentsView;
  title: string;
  url: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  favicon?: string;
  conversationType: ConversationType;
  typeOverride: TabTypeOverride;
}

export class TabManager {
  private tabs: ManagedTab[] = [];
  private activeTabId: string | null = null;
  private window: BrowserWindow;
  private sessionManager: SessionManager;
  private stateStore: TabStateStore;
  private zoomFactor: number = 1.0;
  private onZoomChangeCallback?: (zoomFactor: number) => void;
  private persistTimer: NodeJS.Timeout | null = null;
  private customBounds: { x: number; y: number; width: number; height: number } | null = null;
  private isViewAttached: boolean = true;

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

  public resolveConversationType(
    _url: string,
    override: TabTypeOverride,
    _persistedType?: ConversationType
  ): ConversationType {
    if (override === 'chat') return 'chat';
    if (override === 'work') return 'work';
    // Without unsupported scraping or private API sniffing,
    // we return 'unknown' in automatic mode to avoid mislabeling.
    return 'unknown';
  }

  public setTabTypeOverride(tabId: string, override: TabTypeOverride): void {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;
    tab.typeOverride = override;
    tab.conversationType = this.resolveConversationType(tab.url, override);
    this.notifyStateChanged();
    this.persistState();
  }

  public showTabContextMenu(tabId: string): void {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab || this.window.isDestroyed()) return;

    const currentOverride = tab.typeOverride || 'auto';

    const menu = Menu.buildFromTemplate([
      {
        label: 'Set tab type',
        submenu: [
          {
            label: 'Automatic',
            type: 'radio',
            checked: currentOverride === 'auto',
            click: () => this.setTabTypeOverride(tabId, 'auto')
          },
          {
            label: 'Chat',
            type: 'radio',
            checked: currentOverride === 'chat',
            click: () => this.setTabTypeOverride(tabId, 'chat')
          },
          {
            label: 'Work',
            type: 'radio',
            checked: currentOverride === 'work',
            click: () => this.setTabTypeOverride(tabId, 'work')
          }
        ]
      },
      { type: 'separator' },
      {
        label: 'Reload Tab',
        click: () => this.reloadTab(tabId)
      },
      {
        label: 'Close Tab',
        click: () => this.closeTab(tabId)
      }
    ]);

    menu.popup({ window: this.window });
  }

  public createTab(
    url: string = DEFAULT_URL,
    selectAfterCreation: boolean = true,
    customId?: string,
    initialTitle?: string,
    typeOverride: TabTypeOverride = 'auto',
    initialType?: ConversationType
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

    const conversationType = this.resolveConversationType(url, typeOverride, initialType);

    const newTab: ManagedTab = {
      id: tabId,
      view,
      title: initialTitle || 'ChatGPT',
      url,
      isLoading: true,
      canGoBack: false,
      canGoForward: false,
      conversationType,
      typeOverride
    };

    this.setupViewListeners(newTab);
    this.tabs.push(newTab);

    // Load URL
    view.webContents.loadURL(url).catch(err => {
      if (this.isNavigationCanceled(err)) return;
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
    if (this.isViewAttached) {
      try {
        this.window.contentView.addChildView(targetTab.view);
        this.updateActiveViewBounds();
        targetTab.view.webContents.setZoomFactor(this.zoomFactor);
        targetTab.view.webContents.focus();
      } catch (err) {
        console.error('[TabManager] Error attaching active child view:', err);
      }
    }

    this.notifyStateChanged();
    this.persistState();
  }

  public closeTab(tabId: string): void {
    const index = this.tabs.findIndex(t => t.id === tabId);
    if (index === -1) return;

    const tabToClose = this.tabs[index];

    // Detach and destroy the view. Closing a WebContents that is still loading
    // aborts its navigation, which surfaces as ERR_FAILED/ERR_ABORTED — that is
    // expected teardown, not a failure.
    this.destroyTabView(tabToClose);

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

  /**
   * Tears down every tab and leaves the manager empty. Called after the host
   * window has closed so restored tab navigations do not abort noisily.
   */
  public destroy(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    const tabs = this.tabs;
    this.tabs = [];
    this.activeTabId = null;
    for (const tab of tabs) {
      this.destroyTabView(tab);
    }
  }

  private destroyTabView(tab: ManagedTab): void {
    try {
      this.window.contentView.removeChildView(tab.view);
    } catch (err) {
      // Window is already gone during shutdown.
    }
    try {
      const wc = tab.view.webContents;
      if (!wc.isDestroyed()) {
        wc.close({ waitForBeforeUnload: false });
      }
    } catch (err) {
      console.warn('[TabManager] Error closing webContents:', err);
    }
  }

  private isNavigationCanceled(err: any): boolean {
    const code = err?.code || err?.errno || '';
    const message = err?.message || '';
    return (
      code === 'ERR_ABORTED' ||
      code === 'ERR_FAILED' ||
      message.includes('ERR_ABORTED') ||
      message.includes('ERR_FAILED') ||
      message.includes('Object has been destroyed')
    );
  }

  private isHttpUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private openExternalSafely(url: string): void {
    if (!this.isHttpUrl(url)) {
      console.warn(`[TabManager] Blocked external navigation to unsupported scheme: ${url}`);
      return;
    }
    shell.openExternal(url).catch(err => {
      console.warn(`[TabManager] Failed to open external URL: ${url}`, err);
    });
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

  public setActiveViewVisible(visible: boolean): void {
    this.isViewAttached = visible;
    const active = this.getActiveTab();
    if (!active || this.window.isDestroyed()) return;

    if (visible) {
      try {
        this.window.contentView.addChildView(active.view);
        this.updateActiveViewBounds();
      } catch (err) {
        console.warn('[TabManager] Error attaching view:', err);
      }
    } else {
      try {
        this.window.contentView.removeChildView(active.view);
      } catch (err) {
        console.warn('[TabManager] Error detaching view:', err);
      }
    }
  }

  public updateActiveViewBounds(customBounds?: { x: number; y: number; width: number; height: number }): void {
    if (customBounds) {
      this.customBounds = customBounds;
    }
    const active = this.getActiveTab();
    if (!active || this.window.isDestroyed()) return;

    if (this.customBounds) {
      active.view.setBounds(this.customBounds);
      return;
    }

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
        this.createTab(t.url, false, t.id, t.title, t.typeOverride || 'auto', t.conversationType);
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
        favicon: t.favicon,
        conversationType: t.conversationType,
        typeOverride: t.typeOverride
      })),
      activeTabId: this.activeTabId
    };
  }

  private setupViewListeners(tab: ManagedTab): void {
    const wc = tab.view.webContents;

    attachWebContextMenu(wc, {
      getWindow: () => (this.window.isDestroyed() ? null : this.window),
      openLinkInNewTab: (url) => {
        if (this.sessionManager.isUrlAllowed(url)) {
          this.createTab(url, true);
        } else {
          this.openExternalSafely(url);
        }
      }
    });

    // Strict navigation control
    wc.on('will-navigate', (event, url) => {
      if (!this.sessionManager.isUrlAllowed(url)) {
        event.preventDefault();
        this.openExternalSafely(url);
      }
    });

    // UX-002: Optimized window-open & image routing
    wc.setWindowOpenHandler(({ url }) => {
      // Check if the requested window is a direct image asset / file download
      const isImageAsset = /\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i.test(url) ||
                           url.includes('files.oaiusercontent.com') ||
                           url.includes('/files/');

      if (isImageAsset) {
        // Open image asset in external default viewer without spawning a heavy conversation tab
        this.openExternalSafely(url);
        return { action: 'deny' };
      }

      if (this.sessionManager.isUrlAllowed(url)) {
        this.createTab(url, true);
        return { action: 'deny' };
      }
      this.openExternalSafely(url);
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

    // P0: Arabic RTL Answer Rendering support
    const injectRtlSupport = (): void => {
      if (wc.isDestroyed()) return;
      wc.insertCSS(RTL_SCOPED_CSS).catch(err => {
        console.warn(`[TabManager] Failed to insert RTL CSS on tab ${tab.id}:`, err);
      });
      wc.executeJavaScript(RTL_OBSERVER_SCRIPT).catch(err => {
        console.warn(`[TabManager] Failed to inject RTL observer on tab ${tab.id}:`, err);
      });
    };

    wc.on('dom-ready', injectRtlSupport);
    wc.on('did-finish-load', injectRtlSupport);
    wc.on('did-navigate-in-page', injectRtlSupport);

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
      tab.conversationType = this.resolveConversationType(tab.url, tab.typeOverride);
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

  public flushPersistState(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.executePersistState();
  }

  // UX-001: Debounced disk writes (400ms trailing) to eliminate event-loop blocking
  private persistState(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.executePersistState();
    }, 400);
  }

  private executePersistState(): void {
    this.stateStore.save({
      version: 1,
      tabs: this.tabs.map(t => ({
        id: t.id,
        url: t.url,
        title: t.title,
        typeOverride: t.typeOverride,
        conversationType: t.conversationType
      })),
      activeTabId: this.activeTabId
    });
  }
}
