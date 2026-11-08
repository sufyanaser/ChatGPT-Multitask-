type TabItem = import('../common/types').TabItem;
type TabStatePayload = import('../common/types').TabStatePayload;
type ThemeMode = import('../common/types').ThemeMode;
type ThemeStatePayload = import('../common/types').ThemeStatePayload;
type ConversationType = import('../common/types').ConversationType;
type TabTypeOverride = import('../common/types').TabTypeOverride;
type LayoutMode = import('../common/types').LayoutMode;
type BrowserTabItem = import('../common/types').BrowserTabItem;
type BrowserStatePayload = import('../common/types').BrowserStatePayload;
type UpdateInfoPayload = import('../common/types').UpdateInfoPayload;
type UpdateDownloadProgress = import('../common/types').UpdateDownloadProgress;
type UpdateDownloadedPayload = import('../common/types').UpdateDownloadedPayload;
type UpdateErrorPayload = import('../common/types').UpdateErrorPayload;
type ElectronTabAPI = import('../preload').ElectronTabAPI;

interface Window {
  api: ElectronTabAPI;
}

class AppViewController {
  // Chat tabs UI elements
  private tabsListEl: HTMLElement;
  private newTabBtn: HTMLElement;
  private btnBack: HTMLButtonElement;
  private btnForward: HTMLButtonElement;
  private btnReload: HTMLButtonElement;
  private btnTheme: HTMLButtonElement | null;
  private btnZoom: HTMLButtonElement | null;
  private zoomPopover: HTMLElement | null;
  private btnZoomOut: HTMLButtonElement | null;
  private btnZoomReset: HTMLButtonElement | null;
  private btnZoomIn: HTMLButtonElement | null;
  private zoomControlContainer: HTMLElement | null;

  // Side Browser UI elements
  private btnSplitToggle: HTMLButtonElement | null;
  private browserHeader: HTMLElement | null;
  private btnBrowserBack: HTMLButtonElement | null;
  private btnBrowserForward: HTMLButtonElement | null;
  private btnBrowserReload: HTMLButtonElement | null;
  private inputBrowserUrl: HTMLInputElement | null;
  private browserTabsList: HTMLElement | null;
  private btnBrowserNewTab: HTMLButtonElement | null;
  private btnModeChatOnly: HTMLButtonElement | null;
  private btnModeSplit: HTMLButtonElement | null;
  private btnModeBrowserOnly: HTMLButtonElement | null;
  private btnBrowserClose: HTMLButtonElement | null;
  private splitDivider: HTMLElement | null;

  // Updates Popover UI elements (UX-008)
  private btnUpdates: HTMLButtonElement | null;
  private updatePopover: HTMLElement | null;
  private btnPopoverClose: HTMLButtonElement | null;
  private btnUpdateActionPrimary: HTMLButtonElement | null;
  private btnUpdateActionSecondary: HTMLButtonElement | null;
  private statePanels: { [key: string]: HTMLElement | null } = {};
  private currentUpdateState: 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'ready' | 'error' = 'idle';
  private isCheckingUpdates: boolean = false;
  private checkRequestId: number = 0;
  private currentAppVersion: string = '0.2.0';

  // State trackers
  private currentThemeMode: ThemeMode = 'system';
  private currentZoomFactor: number = 1.0;
  private currentLayoutMode: LayoutMode = 'chat-only';
  private currentSplitRatio: number = 0.5;
  private draggedTabIndex: number | null = null;
  private isResizingSplit: boolean = false;
  private isUrlInputFocused: boolean = false;
  private lastCheckedUpdate: UpdateInfoPayload | null = null;

  constructor() {
    // Chat header elements
    this.tabsListEl = document.getElementById('tabs-list')!;
    this.newTabBtn = document.getElementById('btn-new-tab')!;
    this.btnBack = document.getElementById('btn-back') as HTMLButtonElement;
    this.btnForward = document.getElementById('btn-forward') as HTMLButtonElement;
    this.btnReload = document.getElementById('btn-reload') as HTMLButtonElement;
    this.btnTheme = document.getElementById('btn-theme') as HTMLButtonElement | null;

    // Zoom elements
    this.btnZoom = document.getElementById('btn-zoom') as HTMLButtonElement | null;
    this.zoomPopover = document.getElementById('zoom-popover');
    this.btnZoomOut = document.getElementById('btn-zoom-out') as HTMLButtonElement | null;
    this.btnZoomReset = document.getElementById('btn-zoom-reset') as HTMLButtonElement | null;
    this.btnZoomIn = document.getElementById('btn-zoom-in') as HTMLButtonElement | null;
    this.zoomControlContainer = document.getElementById('zoom-control-container');

    // Side browser elements
    this.btnSplitToggle = document.getElementById('btn-split-toggle') as HTMLButtonElement | null;
    this.browserHeader = document.getElementById('browser-header');
    this.btnBrowserBack = document.getElementById('btn-browser-back') as HTMLButtonElement | null;
    this.btnBrowserForward = document.getElementById('btn-browser-forward') as HTMLButtonElement | null;
    this.btnBrowserReload = document.getElementById('btn-browser-reload') as HTMLButtonElement | null;
    this.inputBrowserUrl = document.getElementById('input-browser-url') as HTMLInputElement | null;
    this.browserTabsList = document.getElementById('browser-tabs-list');
    this.btnBrowserNewTab = document.getElementById('btn-browser-new-tab') as HTMLButtonElement | null;
    this.btnModeChatOnly = document.getElementById('btn-mode-chat-only') as HTMLButtonElement | null;
    this.btnModeSplit = document.getElementById('btn-mode-split') as HTMLButtonElement | null;
    this.btnModeBrowserOnly = document.getElementById('btn-mode-full') as HTMLButtonElement | null;
    this.btnBrowserClose = document.getElementById('btn-browser-close') as HTMLButtonElement | null;
    this.splitDivider = document.getElementById('split-divider');

    // Updates popover elements (UX-008)
    this.btnUpdates = document.getElementById('btn-updates') as HTMLButtonElement | null;
    this.updatePopover = document.getElementById('update-popover');
    this.btnPopoverClose = document.getElementById('btn-popover-close') as HTMLButtonElement | null;
    this.btnUpdateActionPrimary = document.getElementById('btn-update-action-primary') as HTMLButtonElement | null;
    this.btnUpdateActionSecondary = document.getElementById('btn-update-action-secondary') as HTMLButtonElement | null;

    this.statePanels = {
      idle: document.getElementById('state-idle'),
      checking: document.getElementById('state-checking'),
      'up-to-date': document.getElementById('state-up-to-date'),
      available: document.getElementById('state-available'),
      downloading: document.getElementById('state-downloading'),
      ready: document.getElementById('state-ready'),
      error: document.getElementById('state-error')
    };

    this.initPlatformStyle();
    this.initThemeAndWindow();
    this.initZoom();
    this.bindChatEvents();
    this.bindBrowserEvents();
    this.bindUpdateEvents();
    this.loadAppVersion();
    this.bindSplitDividerEvents();
    this.listenToStateUpdates();
  }

  // =========================================================================
  // Platform & Theme Initialization
  // =========================================================================

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
      if (isDark) {
        document.body.classList.add('theme-dark');
      } else {
        document.body.classList.add('theme-light');
      }
    }

    if (this.btnTheme) {
      let modeLabel = 'Follow System';
      if (mode === 'dark') modeLabel = 'Dark';
      if (mode === 'light') modeLabel = 'Light';
      this.btnTheme.title = `Appearance: ${modeLabel} (${isDark ? 'Dark' : 'Light'})`;
      this.btnTheme.setAttribute('aria-label', `Appearance: ${modeLabel}`);

      if (mode === 'dark') {
        this.btnTheme.innerHTML = `
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M13.5 9.5A6 6 0 1 1 6.5 2.5a4.8 4.8 0 0 0 7 7z"/>
          </svg>
        `;
      } else if (mode === 'light') {
        this.btnTheme.innerHTML = `
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="8" cy="8" r="3.5"></circle>
            <path d="M8 1v1.5M8 13.5v1.5M1 8h1.5M13.5 8h1.5M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06"/>
          </svg>
        `;
      } else {
        this.btnTheme.innerHTML = `
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="12" height="8" rx="1.5"></rect>
            <line x1="8" y1="11" x2="8" y2="14"></line>
            <line x1="5.5" y1="14" x2="10.5" y2="14"></line>
          </svg>
        `;
      }
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

  // =========================================================================
  // Zoom Controls
  // =========================================================================

  private applyZoom(factor: number): void {
    const clamped = Math.min(1.5, Math.max(0.8, Math.round(factor * 10) / 10));
    this.currentZoomFactor = clamped;
    const percentStr = `${Math.round(clamped * 100)}%`;

    if (this.btnZoomReset) {
      this.btnZoomReset.textContent = percentStr;
    }
    if (this.btnZoom) {
      this.btnZoom.title = `Text Size & Zoom (${percentStr})`;
    }
    if (this.btnZoomOut) {
      this.btnZoomOut.disabled = clamped <= 0.81;
    }
    if (this.btnZoomIn) {
      this.btnZoomIn.disabled = clamped >= 1.49;
    }
  }

  private initZoom(): void {
    if (!window.api) return;

    if (window.api.getZoom) {
      window.api.getZoom().then((factor: number) => {
        this.applyZoom(factor);
      }).catch((err: any) => {
        console.warn('Failed to get initial zoom:', err);
        this.applyZoom(1.0);
      });
    }

    if (window.api.onZoomUpdate) {
      window.api.onZoomUpdate((factor: number) => {
        this.applyZoom(factor);
      });
    }
  }

  private closeZoomPopover(): void {
    if (this.zoomPopover && !this.zoomPopover.classList.contains('hidden')) {
      this.zoomPopover.classList.add('hidden');
      if (this.btnZoom) {
        this.btnZoom.setAttribute('aria-expanded', 'false');
      }
    }
  }

  private toggleZoomPopover(): void {
    if (!this.zoomPopover) return;
    const isHidden = this.zoomPopover.classList.toggle('hidden');
    if (this.btnZoom) {
      this.btnZoom.setAttribute('aria-expanded', isHidden ? 'false' : 'true');
    }
  }

  // =========================================================================
  // Event Bindings
  // =========================================================================

  private bindChatEvents(): void {
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

    if (this.btnZoom) {
      this.btnZoom.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleZoomPopover();
      });
    }

    if (this.btnZoomOut) {
      this.btnZoomOut.addEventListener('click', (e) => {
        e.stopPropagation();
        const nextZoom = Math.max(0.8, Math.round((this.currentZoomFactor - 0.1) * 10) / 10);
        window.api?.setZoom?.(nextZoom);
      });
    }

    if (this.btnZoomIn) {
      this.btnZoomIn.addEventListener('click', (e) => {
        e.stopPropagation();
        const nextZoom = Math.min(1.5, Math.round((this.currentZoomFactor + 0.1) * 10) / 10);
        window.api?.setZoom?.(nextZoom);
      });
    }

    if (this.btnZoomReset) {
      this.btnZoomReset.addEventListener('click', (e) => {
        e.stopPropagation();
        window.api?.resetZoom?.();
      });
    }

    document.addEventListener('click', (e) => {
      if (this.zoomControlContainer && !this.zoomControlContainer.contains(e.target as Node)) {
        this.closeZoomPopover();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeZoomPopover();
      }
    });
  }

  private bindBrowserEvents(): void {
    // Split toggle in main header
    if (this.btnSplitToggle) {
      this.btnSplitToggle.addEventListener('click', () => {
        window.api?.toggleBrowser?.();
      });
    }

    // Side browser navigation
    if (this.btnBrowserBack) {
      this.btnBrowserBack.addEventListener('click', () => {
        window.api?.navigateBrowserBack?.();
      });
    }

    if (this.btnBrowserForward) {
      this.btnBrowserForward.addEventListener('click', () => {
        window.api?.navigateBrowserForward?.();
      });
    }

    if (this.btnBrowserReload) {
      this.btnBrowserReload.addEventListener('click', () => {
        window.api?.reloadBrowser?.();
      });
    }

    // Side browser URL input
    if (this.inputBrowserUrl) {
      this.inputBrowserUrl.addEventListener('focus', () => {
        this.isUrlInputFocused = true;
        this.inputBrowserUrl?.select();
      });

      this.inputBrowserUrl.addEventListener('blur', () => {
        this.isUrlInputFocused = false;
      });

      this.inputBrowserUrl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          let target = this.inputBrowserUrl?.value.trim() || '';
          if (target) {
            window.api?.navigateBrowser?.(target);
            this.inputBrowserUrl?.blur();
          }
        } else if (e.key === 'Escape') {
          this.inputBrowserUrl?.blur();
        }
      });
    }

    // Side browser new tab
    if (this.btnBrowserNewTab) {
      this.btnBrowserNewTab.addEventListener('click', () => {
        window.api?.createBrowserTab?.();
      });
    }

    // Layout mode switcher buttons
    if (this.btnModeChatOnly) {
      this.btnModeChatOnly.addEventListener('click', () => {
        window.api?.setLayoutMode?.('chat-only');
      });
    }

    if (this.btnModeSplit) {
      this.btnModeSplit.addEventListener('click', () => {
        window.api?.setLayoutMode?.('split');
      });
    }

    if (this.btnModeBrowserOnly) {
      this.btnModeBrowserOnly.addEventListener('click', () => {
        window.api?.setLayoutMode?.('browser-only');
      });
    }

    if (this.btnBrowserClose) {
      this.btnBrowserClose.addEventListener('click', () => {
        window.api?.setLayoutMode?.('chat-only');
      });
    }
  }

  private bindSplitDividerEvents(): void {
    if (!this.splitDivider) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isResizingSplit) return;
      const winWidth = window.innerWidth;
      if (winWidth <= 0) return;

      const rawRatio = e.clientX / winWidth;
      const clampedRatio = Math.max(0.2, Math.min(0.8, Math.round(rawRatio * 1000) / 1000));
      this.currentSplitRatio = clampedRatio;

      document.documentElement.style.setProperty('--split-x', `${clampedRatio * 100}%`);
      window.api?.setSplitRatio?.(clampedRatio);
    };

    const onMouseUp = () => {
      if (this.isResizingSplit) {
        this.isResizingSplit = false;
        document.body.classList.remove('is-resizing');
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      }
    };

    this.splitDivider.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.isResizingSplit = true;
      document.body.classList.add('is-resizing');
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  // =========================================================================
  // UX-008: Native Anchored Update Popover Controller & State Machine
  // =========================================================================

  private bindUpdateEvents(): void {
    if (this.btnUpdates) {
      this.btnUpdates.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleUpdatePopover();
      });
    }

    if (this.btnPopoverClose) {
      this.btnPopoverClose.addEventListener('click', () => {
        this.closeUpdatePopover();
        this.btnUpdates?.focus();
      });
    }

    // Dismissal: Click-Outside
    document.addEventListener('pointerdown', (e: MouseEvent) => {
      if (!this.updatePopover || this.updatePopover.classList.contains('hidden')) return;
      const target = e.target as Node;
      if (!this.updatePopover.contains(target) && !this.btnUpdates?.contains(target)) {
        this.closeUpdatePopover();
      }
    });

    // Dismissal: Escape Key (restores focus to #btn-updates)
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.updatePopover && !this.updatePopover.classList.contains('hidden')) {
        this.closeUpdatePopover();
        this.btnUpdates?.focus();
      }
    });

    // Dynamic Viewport Adjustment on Window Resize
    window.addEventListener('resize', () => {
      if (this.updatePopover && !this.updatePopover.classList.contains('hidden')) {
        this.updatePopoverPosition();
      }
    });

    // External Trigger (App Menu / IPC)
    if (window.api?.onOpenUpdateDialog) {
      window.api.onOpenUpdateDialog(() => {
        this.openUpdatePopover();
      });
    }

    // Authentic IPC Progress & Downloaded Event Subscriptions
    if (window.api?.onDownloadProgress) {
      window.api.onDownloadProgress((progress: UpdateDownloadProgress) => {
        if (this.lastCheckedUpdate) {
          this.lastCheckedUpdate.downloadProgress = progress;
        }
        if (this.currentUpdateState === 'downloading') {
          this.handleDownloadProgress(progress);
        }
      });
    }

    if (window.api?.onUpdateDownloaded) {
      window.api.onUpdateDownloaded((info: UpdateDownloadedPayload) => {
        this.setUpdateState('ready', info);
      });
    }

    if (window.api?.onUpdateError) {
      window.api.onUpdateError((err: UpdateErrorPayload) => {
        this.setUpdateState('error', {
          errorMessage: err.message,
          releaseUrl: this.lastCheckedUpdate?.releaseUrl
        });
      });
    }

    // A canceled download is a user choice, never an error. Return to the
    // "available" view so the update can be retried.
    if (window.api?.onUpdateCanceled) {
      window.api.onUpdateCanceled(() => {
        if (this.currentUpdateState === 'downloading') {
          this.setUpdateState('available', this.lastCheckedUpdate);
        }
      });
    }
  }

  private toggleUpdatePopover(): void {
    if (!this.updatePopover) return;
    if (this.updatePopover.classList.contains('hidden')) {
      this.openUpdatePopover();
    } else {
      this.closeUpdatePopover();
    }
  }

  private openUpdatePopover(): void {
    if (!this.updatePopover) return;

    this.updatePopover.classList.remove('hidden');
    this.btnUpdates?.setAttribute('aria-expanded', 'true');
    this.updatePopoverPosition();

    // If never checked before, trigger update check; otherwise restore current state
    if (this.currentUpdateState === 'idle' && !this.isCheckingUpdates) {
      this.checkForUpdates();
    } else {
      this.setUpdateState(this.currentUpdateState, this.lastCheckedUpdate);
    }
  }

  private closeUpdatePopover(): void {
    if (!this.updatePopover || this.updatePopover.classList.contains('hidden')) return;
    this.updatePopover.classList.add('hidden');
    this.btnUpdates?.setAttribute('aria-expanded', 'false');
  }

  /**
   * Calculates popover position anchored directly beneath #btn-updates
   * Clamped with minimum 8px viewport margins on narrow windows.
   */
  private updatePopoverPosition(): void {
    if (!this.updatePopover || !this.btnUpdates) return;

    const btnRect = this.btnUpdates.getBoundingClientRect();
    const popoverWidth = 320;
    const margin = 8;
    const topOffset = btnRect.bottom + 6;

    let rightOffset = window.innerWidth - btnRect.right - 4;
    if (rightOffset < margin) rightOffset = margin;
    if (window.innerWidth - rightOffset - popoverWidth < margin) {
      rightOffset = Math.max(margin, window.innerWidth - popoverWidth - margin);
    }

    // Vertical clamp: on short windows the popover must stay fully inside the
    // viewport instead of being clipped below the fold. Measured after the
    // panel becomes visible so offsetHeight reflects the active state.
    const popoverHeight = this.updatePopover.offsetHeight || 0;
    const maxTop = window.innerHeight - popoverHeight - margin;
    const top = popoverHeight > 0 ? Math.max(margin, Math.min(topOffset, maxTop)) : topOffset;

    this.updatePopover.style.top = `${top}px`;
    this.updatePopover.style.right = `${rightOffset}px`;
  }

  /**
   * 7-State Finite State Machine for UX-008
   */
  private setUpdateState(state: 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'ready' | 'error', data?: any): void {
    this.currentUpdateState = state;

    // Toggle panels
    Object.keys(this.statePanels).forEach((panelKey) => {
      const el = this.statePanels[panelKey];
      if (el) {
        if (panelKey === state) {
          el.classList.remove('hidden');
        } else {
          el.classList.add('hidden');
        }
      }
    });

    const primaryBtn = this.btnUpdateActionPrimary;
    const secondaryBtn = this.btnUpdateActionSecondary;

    switch (state) {
      case 'idle': {
        if (data?.currentVersion) {
          this.bindCurrentVersion(data.currentVersion);
        }
        if (primaryBtn) {
          primaryBtn.classList.remove('hidden');
          primaryBtn.textContent = 'Check for Updates';
          primaryBtn.disabled = false;
          primaryBtn.onclick = () => {
            this.checkForUpdates();
          };
        }
        if (secondaryBtn) {
          secondaryBtn.classList.add('hidden');
          secondaryBtn.onclick = null;
        }
        break;
      }

      case 'checking': {
        if (primaryBtn) {
          primaryBtn.classList.remove('hidden');
          primaryBtn.textContent = 'Checking...';
          primaryBtn.disabled = true;
          primaryBtn.onclick = null;
        }
        if (secondaryBtn) {
          secondaryBtn.classList.remove('hidden');
          secondaryBtn.textContent = 'Cancel';
          secondaryBtn.onclick = () => {
            this.checkRequestId++;
            this.isCheckingUpdates = false;
            this.setUpdateState('idle', this.lastCheckedUpdate);
          };
        }
        break;
      }

      case 'up-to-date': {
        const verEl = document.getElementById('uptodate-version');
        const tsEl = document.getElementById('uptodate-timestamp');
        const headingEl = document.querySelector('#state-up-to-date .update-state-heading');
        const descEl = document.querySelector('#state-up-to-date .update-state-desc');
        const iconContainer = document.querySelector('#state-up-to-date .update-state-icon-row');

        if (data?.status === 'no-release') {
          // Distinct presentation for GitHub 404 (no published releases found)
          if (headingEl) headingEl.textContent = 'No Published Releases';
          if (descEl) descEl.textContent = 'No official releases have been published yet on GitHub. You are running local development build.';
          if (iconContainer) {
            iconContainer.classList.remove('update-status-emerald');
            iconContainer.classList.add('update-status-blue');
          }
          if (tsEl) {
            const dateStr = data?.checkedAt ? new Date(data.checkedAt).toLocaleTimeString() : new Date().toLocaleTimeString();
            tsEl.textContent = `Checked today at ${dateStr}`;
          }
          if (primaryBtn) {
            primaryBtn.classList.remove('hidden');
            primaryBtn.textContent = 'Done';
            primaryBtn.disabled = false;
            primaryBtn.onclick = () => {
              this.closeUpdatePopover();
            };
          }
          if (secondaryBtn) {
            secondaryBtn.classList.remove('hidden');
            secondaryBtn.textContent = 'View on GitHub';
            secondaryBtn.onclick = () => {
              window.api?.openExternal?.(data?.releaseUrl || 'https://github.com/sufyanaser/ChatGPT-Multitask-/releases');
            };
          }
        } else {
          // Valid comparison against a release succeeded
          if (headingEl) headingEl.textContent = "You're Up to Date";
          if (descEl) {
            descEl.innerHTML = `ChatGPT Multitask <strong id="uptodate-version">v${data?.latestVersion || data?.currentVersion || this.currentAppVersion}</strong> is currently the newest version available.`;
          }
          if (iconContainer) {
            iconContainer.classList.add('update-status-emerald');
            iconContainer.classList.remove('update-status-blue');
          }
          if (verEl) {
            verEl.textContent = `v${data?.latestVersion || data?.currentVersion || this.currentAppVersion}`;
          }
          if (tsEl) {
            const dateStr = data?.checkedAt ? new Date(data.checkedAt).toLocaleTimeString() : new Date().toLocaleTimeString();
            tsEl.textContent = `Checked today at ${dateStr}`;
          }
          if (primaryBtn) {
            primaryBtn.classList.remove('hidden');
            primaryBtn.textContent = 'Done';
            primaryBtn.disabled = false;
            primaryBtn.onclick = () => {
              this.closeUpdatePopover();
            };
          }
          if (secondaryBtn) {
            secondaryBtn.classList.add('hidden');
            secondaryBtn.onclick = null;
          }
        }
        break;
      }

      case 'available': {
        const currEl = document.getElementById('diff-current-ver');
        const latestEl = document.getElementById('diff-latest-ver');
        const notesEl = document.getElementById('update-release-notes');

        const currentVer = data?.currentVersion || this.currentAppVersion;
        const latestVer = data?.latestVersion || '0.2.0';

        if (currEl) currEl.textContent = `v${currentVer}`;
        if (latestEl) latestEl.textContent = `v${latestVer}`;
        if (notesEl) notesEl.textContent = data?.releaseNotes || 'New stable release available on GitHub.';

        if (primaryBtn) {
          primaryBtn.classList.remove('hidden');
          primaryBtn.textContent = 'Download Update';
          primaryBtn.disabled = false;
          primaryBtn.onclick = () => {
            this.startDownload(data);
          };
        }
        if (secondaryBtn) {
          secondaryBtn.classList.remove('hidden');
          secondaryBtn.textContent = 'View on GitHub';
          secondaryBtn.onclick = () => {
            const url = data?.releaseUrl || 'https://github.com/sufyanaser/ChatGPT-Multitask-/releases/latest';
            window.api?.openExternal?.(url);
          };
        }
        break;
      }

      case 'downloading': {
        if (primaryBtn) {
          primaryBtn.classList.add('hidden');
          primaryBtn.onclick = null;
        }
        if (secondaryBtn) {
          secondaryBtn.classList.remove('hidden');
          secondaryBtn.textContent = 'Cancel';
          secondaryBtn.onclick = () => {
            window.api?.cancelDownload?.();
            this.setUpdateState('available', this.lastCheckedUpdate);
          };
        }
        if (data?.downloadProgress) {
          this.handleDownloadProgress(data.downloadProgress);
        }
        break;
      }

      case 'ready': {
        if (primaryBtn) {
          primaryBtn.classList.remove('hidden');
          primaryBtn.textContent = 'Restart & Install';
          primaryBtn.disabled = false;
          primaryBtn.onclick = () => {
            this.restartAndInstall();
          };
        }
        if (secondaryBtn) {
          secondaryBtn.classList.remove('hidden');
          secondaryBtn.textContent = 'Later';
          secondaryBtn.onclick = () => {
            this.closeUpdatePopover();
          };
        }
        break;
      }

      case 'error': {
        const errEl = document.getElementById('update-error-message');
        if (errEl) {
          errEl.textContent = data?.errorMessage || 'Unable to connect to update server.';
        }

        if (primaryBtn) {
          primaryBtn.classList.remove('hidden');
          primaryBtn.textContent = 'Try Again';
          primaryBtn.disabled = false;
          primaryBtn.onclick = () => {
            this.checkForUpdates();
          };
        }
        if (secondaryBtn) {
          secondaryBtn.classList.remove('hidden');
          secondaryBtn.textContent = 'View on GitHub';
          secondaryBtn.onclick = () => {
            const url = data?.releaseUrl || 'https://github.com/sufyanaser/ChatGPT-Multitask-/releases';
            window.api?.openExternal?.(url);
          };
        }
        break;
      }
    }

    // Reposition popover on content/state change to guarantee bounds
    this.updatePopoverPosition();
  }

  private bindCurrentVersion(version?: string): void {
    if (!version) return;
    const clean = version.trim().replace(/^[vV]/, '');
    // Ignore Electron's development placeholder so the UI always shows a
    // real product version.
    if (!clean || clean === '0.0' || clean === '0.0.0') return;
    this.currentAppVersion = clean;
    const badge = document.getElementById('update-current-version-badge');
    if (badge) badge.textContent = `v${clean}`;
    const metaVer = document.querySelector('.update-meta-version');
    if (metaVer) metaVer.textContent = `v${clean}`;
  }

  /**
   * Fetch the packaged application version from the main process so the badge
   * never shows a stale hardcoded value.
   */
  private async loadAppVersion(): Promise<void> {
    try {
      const version = await window.api?.getAppVersion?.();
      this.bindCurrentVersion(version);
    } catch (err) {
      console.warn('Unable to read application version:', err);
    }
  }

  private checkForUpdates(): void {
    if (this.isCheckingUpdates) return;
    const reqId = ++this.checkRequestId;
    this.isCheckingUpdates = true;
    this.setUpdateState('checking');

    window.api?.checkForUpdates?.()
      .then((info: UpdateInfoPayload) => {
        if (reqId !== this.checkRequestId) {
          return; // Request was canceled or superseded
        }
        this.isCheckingUpdates = false;
        this.lastCheckedUpdate = info;

        if (info.currentVersion) {
          this.bindCurrentVersion(info.currentVersion);
        }

        if (info.hasUpdate && info.latestVersion) {
          this.setUpdateState('available', info);
        } else if (info.status === 'error') {
          this.setUpdateState('error', info);
        } else {
          // 'no-release', 'not-available', or 'up-to-date'
          this.setUpdateState('up-to-date', info);
        }
      })
      .catch((err: any) => {
        if (reqId !== this.checkRequestId) return;
        this.isCheckingUpdates = false;
        this.setUpdateState('error', {
          errorMessage: err?.message || 'Network error connecting to update server.',
          releaseUrl: 'https://github.com/sufyanaser/ChatGPT-Multitask-/releases'
        });
      });
  }

  private handleDownloadProgress(progress: UpdateDownloadProgress): void {
    const progressBar = document.getElementById('update-progress-bar');
    const percentLabel = document.getElementById('download-progress-percent');
    const bytesLabel = document.getElementById('download-progress-bytes');

    const pct = Math.max(0, Math.min(100, Math.round((progress.percent || 0) * 10) / 10));
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (percentLabel) percentLabel.textContent = `${pct}%`;

    if (bytesLabel) {
      if (progress.total && progress.total > 0) {
        const transMB = ((progress.transferred || 0) / (1024 * 1024)).toFixed(1);
        const totalMB = (progress.total / (1024 * 1024)).toFixed(1);
        bytesLabel.textContent = `${transMB} MB / ${totalMB} MB`;
      } else if (progress.transferred && progress.transferred > 0) {
        const transMB = ((progress.transferred || 0) / (1024 * 1024)).toFixed(1);
        bytesLabel.textContent = `${transMB} MB`;
      } else {
        bytesLabel.textContent = 'Downloading...';
      }
    }
  }

  private startDownload(payload?: UpdateInfoPayload): void {
    this.setUpdateState('downloading', payload);
    const progressBar = document.getElementById('update-progress-bar');
    const percentLabel = document.getElementById('download-progress-percent');
    const bytesLabel = document.getElementById('download-progress-bytes');

    if (progressBar) progressBar.style.width = '0%';
    if (percentLabel) percentLabel.textContent = '0%';
    if (bytesLabel) bytesLabel.textContent = 'Connecting...';

    const downloadPromise = window.api?.startDownload ? window.api.startDownload() : window.api?.startDownloadUpdate?.();
    if (downloadPromise && typeof downloadPromise.then === 'function') {
      downloadPromise.then((res: any) => {
        if (res && !res.success) {
          if (res.canceled) {
            // User-initiated cancellation: not a failure.
            this.setUpdateState('available', this.lastCheckedUpdate || payload);
            return;
          }
          this.setUpdateState('error', {
            errorMessage: res.error || res.message || 'Unable to download update automatically.',
            releaseUrl: payload?.releaseUrl
          });
        }
      }).catch((err: any) => {
        this.setUpdateState('error', {
          errorMessage: err?.message || 'Error connecting to download service.',
          releaseUrl: payload?.releaseUrl
        });
      });
    }
  }

  private restartAndInstall(): void {
    this.closeUpdatePopover();
    window.api?.quitAndInstall?.();
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // =========================================================================
  // State Updates & Reconciled Rendering
  // =========================================================================

  private async listenToStateUpdates(): Promise<void> {
    if (!window.api) return;

    // Chat tabs updates
    window.api.onStateUpdate((payload: TabStatePayload) => {
      this.renderTabs(payload);
    });

    try {
      const initialState = await window.api.getInitialState();
      this.renderTabs(initialState);
    } catch (err) {
      console.error('Failed to get initial tabs state:', err);
    }

    // Side browser updates
    if (window.api.onBrowserStateUpdate) {
      window.api.onBrowserStateUpdate((payload: BrowserStatePayload) => {
        this.renderBrowserState(payload);
      });
    }

    try {
      if (window.api.getBrowserState) {
        const initialBrowser = await window.api.getBrowserState();
        this.renderBrowserState(initialBrowser);
      }
    } catch (err) {
      console.error('Failed to get initial browser state:', err);
    }
  }

  /**
   * Reconciled Tab Rendering (UX-001 Performance Optimization)
   * Avoids destructive innerHTML = '' rebuilds on every title/loading event.
   */
  private renderTabs(state: TabStatePayload): void {
    const { tabs, activeTabId } = state;

    // Update navigation buttons
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab) {
      this.btnBack.disabled = !activeTab.canGoBack;
      this.btnForward.disabled = !activeTab.canGoForward;
    } else {
      this.btnBack.disabled = true;
      this.btnForward.disabled = true;
    }

    // Keyed reconciliation
    const existingElements = new Map<string, HTMLElement>();
    const childNodes = Array.from(this.tabsListEl.children) as HTMLElement[];
    childNodes.forEach(child => {
      const tabId = child.dataset.tabId;
      if (tabId) {
        existingElements.set(tabId, child);
      }
    });

    const activeIdSet = new Set(tabs.map(t => t.id));

    // Remove defunct tabs
    childNodes.forEach(child => {
      const tabId = child.dataset.tabId;
      if (tabId && !activeIdSet.has(tabId)) {
        this.tabsListEl.removeChild(child);
      }
    });

    // Update or insert tabs
    tabs.forEach((tab, index) => {
      const isActive = tab.id === activeTabId;
      let tabEl = existingElements.get(tab.id);

      if (!tabEl) {
        // Create new tab element
        tabEl = this.createTabElement(tab, index, isActive);
        this.tabsListEl.appendChild(tabEl);
      } else {
        // In-place patch existing element
        this.updateTabElement(tabEl, tab, index, isActive);
        // Ensure DOM ordering
        const currentPosChild = this.tabsListEl.children[index];
        if (currentPosChild !== tabEl) {
          this.tabsListEl.insertBefore(tabEl, currentPosChild || null);
        }
      }
    });
  }

  private updateTabElement(tabEl: HTMLElement, tab: TabItem, index: number, isActive: boolean): void {
    tabEl.dataset.index = index.toString();
    tabEl.setAttribute('aria-selected', isActive ? 'true' : 'false');
    if (isActive) {
      tabEl.classList.add('active');
    } else {
      tabEl.classList.remove('active');
    }

    tabEl.title = tab.title || 'ChatGPT';

    // Update title text if changed
    const titleEl = tabEl.querySelector('.tab-title') as HTMLElement | null;
    if (titleEl && titleEl.textContent !== (tab.title || 'ChatGPT')) {
      titleEl.textContent = tab.title || 'ChatGPT';
      titleEl.title = tab.title || 'ChatGPT';
    }

    // Update icon wrapper
    const iconWrapper = tabEl.querySelector('.tab-icon-wrapper') as HTMLElement | null;
    if (iconWrapper) {
      this.renderTabIconContent(iconWrapper, tab);
    }
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

    // Compact 14x14 SVG Indicator / Spinner
    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'tab-icon-wrapper';
    this.renderTabIconContent(iconWrapper, tab);

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

    // Right-click context menu (Set tab type -> Chat / Work / Automatic)
    tabEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.api?.showTabContextMenu?.(tab.id);
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

  /**
   * Tab icon rendering with UX-006 Neutral Outline Icon for Unclassified Conversations
   */
  private renderTabIconContent(iconWrapper: HTMLElement, tab: TabItem): void {
    if (tab.isLoading) {
      if (!iconWrapper.querySelector('.tab-spinner')) {
        iconWrapper.innerHTML = '<div class="tab-spinner" title="Loading..."></div>';
        iconWrapper.title = 'Loading...';
        iconWrapper.setAttribute('aria-label', 'Loading');
      }
      return;
    }

    const convType: ConversationType = tab.conversationType || 'unknown';
    let currentType = iconWrapper.dataset.convType;
    if (currentType === convType && !iconWrapper.querySelector('.tab-spinner')) {
      return; // Already rendered correctly
    }

    iconWrapper.dataset.convType = convType;
    let svgHtml = '';
    let tooltip = 'Conversation (Automatic)';

    if (convType === 'chat') {
      tooltip = 'Chat conversation';
      svgHtml = `
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="tab-type-icon tab-type-chat" aria-hidden="true">
          <path d="M14 8a6 6 0 0 1-6 6c-1.1 0-2.1-.3-3-.8L2 14l.8-3A6 6 0 1 1 14 8z"/>
        </svg>
      `;
    } else if (convType === 'work') {
      tooltip = 'Work task';
      svgHtml = `
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="tab-type-icon tab-type-work" aria-hidden="true">
          <rect x="2" y="5" width="12" height="9" rx="1.5"/>
          <path d="M5.5 5V3.5a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5V5"/>
          <path d="M2 9h12"/>
        </svg>
      `;
    } else {
      // UX-006: Calm, neutral conversation outline (no alarming question mark)
      tooltip = 'Conversation (Automatic)';
      svgHtml = `
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="tab-type-icon tab-type-unknown" aria-hidden="true">
          <path d="M13.5 10.5a2 2 0 0 1-2 2H5.5L2.5 14.5v-10a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2z"/>
        </svg>
      `;
    }

    iconWrapper.innerHTML = svgHtml.trim();
    iconWrapper.title = tooltip;
    iconWrapper.setAttribute('aria-label', tooltip);
  }

  // =========================================================================
  // Side Browser State Rendering
  // =========================================================================

  private renderBrowserState(state: BrowserStatePayload): void {
    const { layoutMode, splitRatio, tabs, activeTabId, visible } = state;
    this.currentLayoutMode = layoutMode;
    this.currentSplitRatio = splitRatio;

    // Update body classes
    document.body.classList.remove('layout-chat-only', 'layout-split', 'layout-browser-only');
    document.body.classList.add(`layout-${layoutMode}`);

    // Update CSS variable for divider position
    document.documentElement.style.setProperty('--split-x', `${splitRatio * 100}%`);

    // Update Split Toggle Button State in main header
    if (this.btnSplitToggle) {
      if (layoutMode === 'chat-only') {
        this.btnSplitToggle.classList.remove('active');
        this.btnSplitToggle.title = 'Open Side Browser (Ctrl+\\)';
      } else {
        this.btnSplitToggle.classList.add('active');
        this.btnSplitToggle.title = `Side Browser: ${layoutMode} (Ctrl+\\)`;
      }
    }

    // Update mode buttons in browser header
    if (this.btnModeChatOnly) {
      this.btnModeChatOnly.classList.toggle('active', layoutMode === 'chat-only');
    }
    if (this.btnModeSplit) {
      this.btnModeSplit.classList.toggle('active', layoutMode === 'split');
    }
    if (this.btnModeBrowserOnly) {
      this.btnModeBrowserOnly.classList.toggle('active', layoutMode === 'browser-only');
    }

    // Show/hide split divider
    if (this.splitDivider) {
      this.splitDivider.style.display = layoutMode === 'split' ? 'block' : 'none';
    }

    // Show/hide browser header
    if (this.browserHeader) {
      this.browserHeader.style.display = visible ? 'flex' : 'none';
      this.browserHeader.className = `browser-header layout-${layoutMode}`;
    }

    const activeTab = tabs.find(t => t.id === activeTabId);

    // Update Browser Navigation Buttons
    if (this.btnBrowserBack) {
      this.btnBrowserBack.disabled = !activeTab?.canGoBack;
    }
    if (this.btnBrowserForward) {
      this.btnBrowserForward.disabled = !activeTab?.canGoForward;
    }

    // Update URL Input (only when user is not actively editing)
    if (this.inputBrowserUrl && !this.isUrlInputFocused) {
      this.inputBrowserUrl.value = activeTab?.url || '';
    }

    // Render Browser Tabs Strip
    if (this.browserTabsList) {
      this.browserTabsList.innerHTML = '';
      tabs.forEach(tab => {
        const isTabActive = tab.id === activeTabId;
        const bTabEl = document.createElement('div');
        bTabEl.className = `browser-tab-item ${isTabActive ? 'active' : ''}`;
        bTabEl.title = tab.title || tab.url || 'New Tab';

        const bTitle = document.createElement('span');
        bTitle.className = 'browser-tab-title';
        bTitle.textContent = tab.title || (tab.url.replace(/^https?:\/\//, '') || 'New Tab');

        const bClose = document.createElement('button');
        bClose.className = 'browser-tab-close';
        bClose.title = 'Close Tab';
        bClose.innerHTML = `
          <svg viewBox="0 0 16 16" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="3" y1="3" x2="13" y2="13"></line>
            <line x1="13" y1="3" x2="3" y2="13"></line>
          </svg>
        `;

        bClose.addEventListener('click', (e) => {
          e.stopPropagation();
          window.api?.closeBrowserTab?.(tab.id);
        });

        bTabEl.addEventListener('click', () => {
          window.api?.selectBrowserTab?.(tab.id);
        });

        bTabEl.appendChild(bTitle);
        bTabEl.appendChild(bClose);
        this.browserTabsList!.appendChild(bTabEl);
      });
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new AppViewController();
});
