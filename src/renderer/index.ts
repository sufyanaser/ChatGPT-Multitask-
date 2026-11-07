import { ElectronTabAPI } from '../preload';
import { TabItem, TabStatePayload } from '../common/types';

declare global {
  interface Window {
    api: ElectronTabAPI;
  }
}

class TabBarController {
  private tabsListEl: HTMLElement;
  private newTabBtn: HTMLElement;
  private btnBack: HTMLButtonElement;
  private btnForward: HTMLButtonElement;
  private btnReload: HTMLButtonElement;
  private draggedTabIndex: number | null = null;

  constructor() {
    this.tabsListEl = document.getElementById('tabs-list')!;
    this.newTabBtn = document.getElementById('btn-new-tab')!;
    this.btnBack = document.getElementById('btn-back') as HTMLButtonElement;
    this.btnForward = document.getElementById('btn-forward') as HTMLButtonElement;
    this.btnReload = document.getElementById('btn-reload') as HTMLButtonElement;

    this.initPlatformStyle();
    this.bindEvents();
    this.listenToStateUpdates();
  }

  private initPlatformStyle(): void {
    if (window.api && window.api.platform === 'darwin') {
      document.body.classList.add('platform-darwin');
    }
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
  }

  private async listenToStateUpdates(): Promise<void> {
    if (!window.api) return;

    // Listen for live updates
    window.api.onStateUpdate((payload: TabStatePayload) => {
      this.renderTabs(payload);
    });

    // Fetch initial state
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
        // Fallback default icon SVG
        iconWrapper.innerHTML = `
          <svg viewBox="0 0 16 16" width="14" height="14" fill="#10a37f">
            <circle cx="8" cy="8" r="7" />
          </svg>
        `;
      };
      iconWrapper.appendChild(icon);
    }

    // Title
    const titleEl = document.createElement('span');
    titleEl.className = 'tab-title';
    titleEl.textContent = tab.title || 'ChatGPT';
    titleEl.title = tab.title || 'ChatGPT';

    // Close Button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close-btn';
    closeBtn.title = 'Close Tab';
    closeBtn.innerHTML = `
      <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
        <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z"/>
      </svg>
    `;

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.api?.closeTab(tab.id);
    });

    tabEl.addEventListener('click', () => {
      window.api?.selectTab(tab.id);
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
