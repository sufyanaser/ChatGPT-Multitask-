type TabItem = import('../common/types').TabItem;
type TabStatePayload = import('../common/types').TabStatePayload;
type ThemeMode = import('../common/types').ThemeMode;
type ThemeStatePayload = import('../common/types').ThemeStatePayload;
type ElectronTabAPI = import('../preload').ElectronTabAPI;

interface Window {
  api: ElectronTabAPI;
}

class TabBarController {
  private tabsListEl: HTMLElement;
  private newTabBtn: HTMLElement;
  private btnBack: HTMLButtonElement;
  private btnForward: HTMLButtonElement;
  private btnReload: HTMLButtonElement;
  private btnTheme: HTMLButtonElement | null;
  private currentThemeMode: ThemeMode = 'system';
  private draggedTabIndex: number | null = null;

  constructor() {
    this.tabsListEl = document.getElementById('tabs-list')!;
    this.newTabBtn = document.getElementById('btn-new-tab')!;
    this.btnBack = document.getElementById('btn-back') as HTMLButtonElement;
    this.btnForward = document.getElementById('btn-forward') as HTMLButtonElement;
    this.btnReload = document.getElementById('btn-reload') as HTMLButtonElement;
    this.btnTheme = document.getElementById('btn-theme') as HTMLButtonElement | null;

    this.initPlatformStyle();
    this.initThemeAndWindow();
    this.bindEvents();
    this.listenToStateUpdates();
  }

  private initPlatformStyle(): void {
    const platform = window.api?.platform || 'win32';
    if (platform === 'darwin') {
      document.body.classList.add('platform-darwin');
    } else {
      document.body.classList.add('platform-win32');
    }
  }

  private applyTheme(themeOrPayload: ThemeStatePayload | 'dark' | 'light'): void {
    let mode: ThemeMode = 'system';
    let isDark = false;

    if (typeof themeOrPayload === 'string') {
      isDark = themeOrPayload === 'dark';
      mode = isDark ? 'dark' : 'light';
    } else if (themeOrPayload && typeof themeOrPayload === 'object') {
      mode = themeOrPayload.themeMode || 'system';
      isDark = themeOrPayload.isDark ?? (mode === 'dark');
    }

    this.currentThemeMode = mode;
    document.body.classList.remove('theme-dark', 'theme-light');

    if (mode === 'dark') {
      document.body.classList.add('theme-dark');
    } else if (mode === 'light') {
      document.body.classList.add('theme-light');
    } else {
      // System mode
      if (isDark) {
        document.body.classList.add('theme-dark');
      } else {
        document.body.classList.add('theme-light');
      }
    }

    if (this.btnTheme) {
      this.btnTheme.title = `Theme: ${mode.toUpperCase()} (${isDark ? 'Dark' : 'Light'})`;
    }
  }

  private async initThemeAndWindow(): Promise<void> {
    if (!window.api) return;

    try {
      if (window.api.getTheme) {
        const theme = await window.api.getTheme();
        this.applyTheme(theme);
      }
    } catch (err) {
      console.warn('Failed to get initial theme:', err);
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.applyTheme(isDark ? 'dark' : 'light');
    }

    if (window.api.onThemeUpdate) {
      window.api.onThemeUpdate((payload: any) => {
        this.applyTheme(payload);
      });
    }

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    mql.addEventListener('change', (e) => {
      if (this.currentThemeMode === 'system') {
        this.applyTheme(e.matches ? 'dark' : 'light');
      }
    });

    if (window.api.onFullscreenUpdate) {
      window.api.onFullscreenUpdate((isFullscreen: boolean) => {
        if (isFullscreen) {
          document.body.classList.add('fullscreen-active');
        } else {
          document.body.classList.remove('fullscreen-active');
        }
      });
    }
  }

  private cycleTheme(): void {
    const sequence: ThemeMode[] = ['system', 'dark', 'light'];
    const nextIdx = (sequence.indexOf(this.currentThemeMode) + 1) % sequence.length;
    const nextMode = sequence[nextIdx];
    this.currentThemeMode = nextMode;
    window.api?.setTheme?.(nextMode);
  }

  private bindEvents(): void {
    this.newTabBtn.addEventListener('click', () => {
      window.api?.createTab();
    });

    this.btnBack.addEventListener('click', () => {
      window.api?.navigateBack();
    });

    this.btnForward.addEventListener('click', () => {
      window.api?.navigateForward();
    });

    this.btnReload.addEventListener('click', () => {
      window.api?.reloadTab();
    });

    if (this.btnTheme) {
      this.btnTheme.addEventListener('click', () => {
        this.cycleTheme();
      });
    }
  }

  private async listenToStateUpdates(): Promise<void> {
    if (!window.api) return;

    window.api.onStateUpdate((payload: TabStatePayload) => {
      this.renderTabs(payload);
    });

    try {
      const initialState = await window.api.getInitialState();
      this.renderTabs(initialState);
    } catch (err) {
      console.error('Failed to get initial tabs state:', err);
    }
  }

  private renderTabs(state: TabStatePayload): void {
    const { tabs, activeTabId } = state;
    this.tabsListEl.innerHTML = '';

    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab) {
      this.btnBack.disabled = !activeTab.canGoBack;
      this.btnForward.disabled = !activeTab.canGoForward;
    } else {
      this.btnBack.disabled = true;
      this.btnForward.disabled = true;
    }

    tabs.forEach((tab, index) => {
      const tabEl = this.createTabElement(tab, index, tab.id === activeTabId);
      this.tabsListEl.appendChild(tabEl);
    });
  }

  private createTabElement(tab: TabItem, index: number, isActive: boolean): HTMLElement {
    const tabEl = document.createElement('div');
    tabEl.className = `tab-item ${isActive ? 'active' : ''}`;
    tabEl.draggable = true;
    tabEl.dataset.tabId = tab.id;
    tabEl.dataset.index = index.toString();
    tabEl.setAttribute('role', 'tab');
    tabEl.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tabEl.setAttribute('tabindex', '0');
    tabEl.title = tab.title || 'ChatGPT';

    // Icon / Spinner
    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'tab-icon-wrapper';

    if (tab.isLoading) {
      const spinner = document.createElement('div');
      spinner.className = 'tab-spinner';
      iconWrapper.appendChild(spinner);
    } else {
      const icon = document.createElement('img');
      icon.className = 'tab-icon';
      icon.src = tab.favicon || 'https://chatgpt.com/favicon.ico';
      icon.alt = 'ChatGPT';
      icon.onerror = () => {
        // Fallback OpenAI SVG spiral
        iconWrapper.innerHTML = `
          <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" opacity="0.85">
            <path d="M14.017 6.13a3.52 3.52 0 0 0-.317-2.69 3.595 3.595 0 0 0-2.361-1.748 3.623 3.623 0 0 0-3.32.748 3.535 3.535 0 0 0-2.433-.284 3.6 3.6 0 0 0-2.247 1.896 3.636 3.636 0 0 0-.435 3.396 3.553 3.553 0 0 0-1.738 2.057 3.61 3.61 0 0 0 .285 3.364 3.633 3.633 0 0 0 2.65 1.57c.13.435.358.835.67 1.173a3.61 3.61 0 0 0 2.923 1.258 3.627 3.627 0 0 0 2.99-1.579 3.536 3.536 0 0 0 2.457.26 3.6 3.6 0 0 0 2.222-1.92 3.637 3.637 0 0 0 .416-3.398 3.55 3.55 0 0 0 1.736-2.055 3.611 3.611 0 0 0-.287-3.364 3.63 3.63 0 0 0-2.65-1.57z"/>
          </svg>
        `;
      };
      iconWrapper.appendChild(icon);
    }

    // Title with RTL & Arabic/English auto-direction
    const titleEl = document.createElement('span');
    titleEl.className = 'tab-title';
    titleEl.textContent = tab.title || 'ChatGPT';
    titleEl.title = tab.title || 'ChatGPT';
    titleEl.setAttribute('dir', 'auto');

    // Close Button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close-btn';
    closeBtn.title = 'Close Tab';
    closeBtn.setAttribute('aria-label', `Close ${tab.title || 'tab'}`);
    closeBtn.innerHTML = `
      <svg viewBox="0 0 16 16" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="3" y1="3" x2="13" y2="13"></line>
        <line x1="13" y1="3" x2="3" y2="13"></line>
      </svg>
    `;

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.api?.closeTab(tab.id);
    });

    tabEl.addEventListener('click', () => {
      window.api?.selectTab(tab.id);
    });

    // Keyboard activation
    tabEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        window.api?.selectTab(tab.id);
      }
    });

    // Middle click to close
    tabEl.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        window.api?.closeTab(tab.id);
      }
    });

    // Drag and Drop Tab Reordering
    tabEl.addEventListener('dragstart', (e) => {
      this.draggedTabIndex = index;
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index.toString());
      }
    });

    tabEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }
      tabEl.classList.add('drag-over');
    });

    tabEl.addEventListener('dragleave', () => {
      tabEl.classList.remove('drag-over');
    });

    tabEl.addEventListener('drop', (e) => {
      e.preventDefault();
      tabEl.classList.remove('drag-over');
      if (this.draggedTabIndex !== null && this.draggedTabIndex !== index) {
        window.api?.reorderTabs(this.draggedTabIndex, index);
      }
      this.draggedTabIndex = null;
    });

    tabEl.appendChild(iconWrapper);
    tabEl.appendChild(titleEl);
    tabEl.appendChild(closeBtn);

    return tabEl;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new TabBarController();
});
