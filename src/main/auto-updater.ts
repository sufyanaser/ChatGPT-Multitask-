import { app, BrowserWindow } from 'electron';
import {
  autoUpdater,
  ProgressInfo,
  UpdateDownloadedEvent,
  CancellationToken
} from 'electron-updater';
import * as https from 'https';
import type { IncomingMessage } from 'http';
import {
  IPC_CHANNELS,
  UpdateInfoPayload,
  UpdateDownloadProgress,
  UpdateDownloadedPayload,
  UpdateErrorPayload
} from '../common/types';

const REPOSITORY = 'sufyanaser/ChatGPT-Multitask-';
const RELEASES_URL = `https://github.com/${REPOSITORY}/releases`;

/**
 * Compares two semantic version strings (e.g. "0.2.0", "v0.1.0", "1.0.0-beta.1").
 * Conforms strictly to SemVer 2.0.0 Rule 11:
 * - Compares major, minor, patch numerically.
 * - When major, minor and patch are equal, a normal version has higher precedence
 *   than a pre-release version.
 * - Compares dot-separated pre-release identifiers according to SemVer precedence.
 */
export function compareSemver(v1: string, v2: string): number {
  if (!v1 && !v2) return 0;
  if (!v1) return -1;
  if (!v2) return 1;

  const parse = (v: string): { core: number[]; pre: string[] | null } => {
    const trimmed = v.trim().replace(/^[vV]/, '').split('+')[0]; // Strip build metadata
    const [coreStr, ...preParts] = trimmed.split('-');
    const pre = preParts.length > 0 ? preParts.join('-').split('.') : null;
    const core = coreStr.split('.').map(n => parseInt(n, 10) || 0);
    while (core.length < 3) core.push(0);
    return { core: core.slice(0, 3), pre };
  };

  const p1 = parse(v1);
  const p2 = parse(v2);

  for (let i = 0; i < 3; i++) {
    if (p1.core[i] !== p2.core[i]) {
      return p1.core[i] - p2.core[i];
    }
  }

  if (!p1.pre && !p2.pre) return 0;
  if (!p1.pre && p2.pre) return 1; // Normal version is newer than pre-release
  if (p1.pre && !p2.pre) return -1; // Pre-release is older than normal version

  const len = Math.max(p1.pre!.length, p2.pre!.length);
  for (let i = 0; i < len; i++) {
    const id1 = p1.pre![i];
    const id2 = p2.pre![i];
    if (id1 === undefined) return -1; // Larger identifier set has higher precedence
    if (id2 === undefined) return 1;
    if (id1 === id2) continue;

    const num1 = parseInt(id1, 10);
    const num2 = parseInt(id2, 10);
    const isNum1 = !isNaN(num1) && String(num1) === id1;
    const isNum2 = !isNaN(num2) && String(num2) === id2;

    if (isNum1 && isNum2) {
      if (num1 !== num2) return num1 - num2;
    } else if (isNum1 && !isNum2) {
      return -1; // Numeric identifiers have lower precedence than alphanumeric
    } else if (!isNum1 && isNum2) {
      return 1;
    } else {
      return id1.localeCompare(id2);
    }
  }

  return 0;
}

type GitHubLookup =
  | { kind: 'ok'; version: string; notes?: string; url: string }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string };

type DownloadResult = {
  success: boolean;
  error?: string;
  message?: string;
  canceled?: boolean;
};

/**
 * Owns the single electron-updater instance for the process.
 *
 * The updater is a singleton: electron-updater registers process-wide event
 * listeners, so creating one AppUpdater per window would duplicate every
 * download event and progress payload.
 */
export class AppUpdater {
  private static instance: AppUpdater | null = null;

  private mainWindow: BrowserWindow | null = null;
  private cancellationToken: CancellationToken | null = null;
  private isDownloading = false;
  private isCanceled = false;
  private suppressErrorEvents = false;
  private pendingVersion: string | null = null;
  private downloadedVersion: string | null = null;
  private beforeQuitAndInstall?: () => void;

  private constructor() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowPrerelease = false; // Stable release channel only
    autoUpdater.logger = console;

    autoUpdater.on('checking-for-update', () => {
      console.log('[AppUpdater] Checking published release metadata...');
    });

    autoUpdater.on('update-available', (info) => {
      console.log(`[AppUpdater] Release metadata reports available version: v${info.version}`);
    });

    autoUpdater.on('update-not-available', () => {
      console.log('[AppUpdater] Published release metadata is not newer than the installed version.');
    });

    autoUpdater.on('error', (err) => {
      if (this.suppressErrorEvents || this.isCanceled) {
        console.log(`[AppUpdater] Ignored updater error during check/cancel: ${err?.message || err}`);
        return;
      }
      console.warn('[AppUpdater] Update error:', err?.message || err);
      this.isDownloading = false;
      const errorPayload: UpdateErrorPayload = {
        message: this.toUserFacingError(err)
      };
      this.forwardToRenderer(IPC_CHANNELS.UPDATE_ERROR, errorPayload);
    });

    // Genuine progress events from electron-updater (never synthesised).
    autoUpdater.on('download-progress', (progressObj: ProgressInfo) => {
      const payload: UpdateDownloadProgress = {
        percent: Math.round(progressObj.percent * 10) / 10,
        bytesPerSecond: progressObj.bytesPerSecond || 0,
        transferred: progressObj.transferred || 0,
        total: progressObj.total || 0
      };
      this.forwardToRenderer(IPC_CHANNELS.DOWNLOAD_PROGRESS, payload);
    });

    autoUpdater.on('update-downloaded', (info: UpdateDownloadedEvent) => {
      console.log(`[AppUpdater] Update downloaded and verified: v${info.version}`);
      this.isDownloading = false;
      this.downloadedVersion = info.version;
      const payload: UpdateDownloadedPayload = {
        version: info.version,
        releaseNotes: this.formatReleaseNotes(info.releaseNotes)
      };
      this.forwardToRenderer(IPC_CHANNELS.UPDATE_DOWNLOADED, payload);
    });
  }

  public static getInstance(): AppUpdater {
    if (!AppUpdater.instance) {
      AppUpdater.instance = new AppUpdater();
    }
    return AppUpdater.instance;
  }

  public setMainWindow(win: BrowserWindow | null): void {
    this.mainWindow = win;
  }

  /** Registers a callback that flushes user data before an update restart. */
  public setBeforeQuitAndInstall(callback: () => void): void {
    this.beforeQuitAndInstall = callback;
  }

  private forwardToRenderer(channel: string, ...args: unknown[]): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, ...args);
    }
  }

  private get currentVersion(): string {
    return app.getVersion();
  }

  private basePayload(checkedAt: string): UpdateInfoPayload {
    return {
      status: 'idle',
      currentVersion: this.currentVersion,
      releaseUrl: RELEASES_URL,
      canAutoDownload: app.isPackaged,
      checkedAt
    };
  }

  /**
   * Downloads the update that the most recent successful check discovered.
   * Requires a packaged build: electron-updater needs the app-update.yml feed
   * configuration that electron-builder embeds in production packages.
   */
  public async downloadUpdate(): Promise<DownloadResult> {
    return this.startDownload();
  }

  public async startDownload(): Promise<DownloadResult> {
    if (this.downloadedVersion) {
      return { success: true, message: 'Update is already downloaded and ready to install.' };
    }

    if (!app.isPackaged) {
      const msg =
        'In-app background download is only available in an installed release build. ' +
        'Use "View Release" to download the installer from GitHub.';
      this.forwardToRenderer(IPC_CHANNELS.UPDATE_ERROR, { message: msg } as UpdateErrorPayload);
      return { success: false, error: msg, message: msg };
    }

    if (!this.pendingVersion) {
      const msg = 'No verified update is available to download. Check for updates first.';
      return { success: false, error: msg, message: msg };
    }

    if (this.isDownloading) {
      return { success: true, message: 'Download already in progress.' };
    }

    this.isCanceled = false;
    this.isDownloading = true;
    this.cancellationToken = new CancellationToken();

    try {
      await autoUpdater.downloadUpdate(this.cancellationToken);
      return { success: true };
    } catch (err: any) {
      this.isDownloading = false;
      if (this.isCanceled || this.isCancellationError(err)) {
        this.isCanceled = false;
        this.forwardToRenderer(IPC_CHANNELS.UPDATE_CANCELED, {});
        return { success: false, error: 'canceled', message: 'Download canceled.', canceled: true };
      }
      const message = this.toUserFacingError(err);
      console.warn('[AppUpdater] downloadUpdate failed:', err?.message || err);
      this.forwardToRenderer(IPC_CHANNELS.UPDATE_ERROR, { message } as UpdateErrorPayload);
      return { success: false, error: message, message };
    }
  }

  public cancelDownload(): void {
    if (this.cancellationToken) {
      this.isCanceled = true;
      this.cancellationToken.cancel();
      this.cancellationToken = null;
    }
    this.isDownloading = false;
  }

  public quitAndInstall(): void {
    if (!this.downloadedVersion) {
      console.warn('[AppUpdater] quitAndInstall ignored: no downloaded update is pending.');
      return;
    }
    try {
      this.beforeQuitAndInstall?.();
    } catch (err) {
      console.warn('[AppUpdater] Pre-install state flush failed:', err);
    }
    console.log(`[AppUpdater] Restarting to install v${this.downloadedVersion}...`);
    autoUpdater.quitAndInstall(false, true);
  }

  /**
   * Authoritative update check.
   *
   * Packaged builds use electron-updater's published metadata (the same feed
   * used for downloading, so the version that is announced is the version that
   * can actually be downloaded). Development builds, which have no embedded
   * feed configuration, fall back to the public GitHub Releases API.
   *
   * A missing release, HTTP 404 or an authentication/rate-limit failure is
   * never reported as "up to date".
   */
  public async checkForUpdatesManually(): Promise<UpdateInfoPayload> {
    const checkedAt = new Date().toISOString();
    this.pendingVersion = null;
    this.downloadedVersion = null;

    if (!app.isPackaged) {
      return this.checkViaGitHubApi(checkedAt, 'Development build (no embedded update feed).');
    }

    this.suppressErrorEvents = true;
    try {
      const result = await autoUpdater.checkForUpdates();
      if (!result) {
        return {
          ...this.basePayload(checkedAt),
          status: 'error',
          hasUpdate: false,
          errorMessage: 'An update check is already in progress. Please wait and try again.'
        };
      }

      const latestVersion = String(result.updateInfo.version || '').trim().replace(/^[vV]/, '');
      const comparison = compareSemver(latestVersion, this.currentVersion);

      if (comparison > 0) {
        this.pendingVersion = latestVersion;
        const notes =
          this.formatReleaseNotes(result.updateInfo.releaseNotes) ||
          (await this.fetchReleaseNotes(latestVersion));
        return {
          ...this.basePayload(checkedAt),
          status: 'available',
          hasUpdate: true,
          latestVersion,
          releaseNotes: notes || 'A new stable release is available on GitHub.',
          releaseUrl: `${RELEASES_URL}/tag/v${latestVersion}`
        };
      }

      return {
        ...this.basePayload(checkedAt),
        status: 'not-available',
        hasUpdate: false,
        latestVersion: latestVersion || this.currentVersion,
        releaseNotes: 'Published release metadata confirms this is the newest stable version.'
      };
    } catch (err: any) {
      console.warn('[AppUpdater] Primary update check failed:', err?.message || err);
      return this.resolveCheckFailure(err, checkedAt);
    } finally {
      this.suppressErrorEvents = false;
    }
  }

  /**
   * Resolves a failed electron-updater check without ever guessing that the
   * application is current. GitHub Releases is consulted to distinguish
   * "no release published" from "network/auth failure" and to surface a
   * manual download path when feed metadata is missing.
   */
  private async resolveCheckFailure(err: any, checkedAt: string): Promise<UpdateInfoPayload> {
    const updaterMessage = this.toUserFacingError(err);
    const lookup = await this.queryGitHubLatestRelease();

    if (lookup.kind === 'not-found') {
      return {
        ...this.basePayload(checkedAt),
        status: 'no-release',
        hasUpdate: false,
        latestVersion: this.currentVersion,
        releaseNotes:
          'No published GitHub release was found. Automatic updates stay disabled until an official release exists.',
        errorMessage: updaterMessage
      };
    }

    if (lookup.kind === 'ok') {
      if (compareSemver(lookup.version, this.currentVersion) > 0) {
        return {
          ...this.basePayload(checkedAt),
          status: 'error',
          hasUpdate: false,
          latestVersion: lookup.version,
          releaseNotes: lookup.notes,
          releaseUrl: lookup.url,
          errorMessage:
            `GitHub lists v${lookup.version}, but the automatic update feed could not be verified ` +
            `(${updaterMessage}). Download the installer from GitHub instead.`
        };
      }
      return {
        ...this.basePayload(checkedAt),
        status: 'not-available',
        hasUpdate: false,
        latestVersion: lookup.version,
        releaseNotes: 'The latest published GitHub release matches or predates the installed version.',
        releaseUrl: lookup.url
      };
    }

    return {
      ...this.basePayload(checkedAt),
      status: 'error',
      hasUpdate: false,
      errorMessage: `Unable to verify updates. ${updaterMessage} ${lookup.message}`.trim()
    };
  }

  private async checkViaGitHubApi(checkedAt: string, context: string): Promise<UpdateInfoPayload> {
    const lookup = await this.queryGitHubLatestRelease();

    if (lookup.kind === 'not-found') {
      // Distinct from "up to date": no official release exists yet.
      return {
        ...this.basePayload(checkedAt),
        status: 'no-release',
        hasUpdate: false,
        latestVersion: this.currentVersion,
        releaseNotes: 'No official releases have been published on GitHub yet.'
      };
    }

    if (lookup.kind === 'error') {
      return {
        ...this.basePayload(checkedAt),
        status: 'error',
        hasUpdate: false,
        errorMessage: lookup.message
      };
    }

    if (compareSemver(lookup.version, this.currentVersion) > 0) {
      return {
        ...this.basePayload(checkedAt),
        status: 'available',
        hasUpdate: true,
        latestVersion: lookup.version,
        releaseNotes: lookup.notes || 'A new stable release is available on GitHub.',
        releaseUrl: lookup.url
      };
    }

    return {
      ...this.basePayload(checkedAt),
      status: 'not-available',
      hasUpdate: false,
      latestVersion: lookup.version,
      releaseNotes: `Latest published release is v${lookup.version}. ${context}`,
      releaseUrl: lookup.url
    };
  }

  /** Queries the public GitHub Releases API. Never authenticates with a token. */
  private queryGitHubLatestRelease(): Promise<GitHubLookup> {
    return new Promise<GitHubLookup>((resolve) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${REPOSITORY}/releases/latest`,
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': `ChatGPT-Multitask-Updater/${this.currentVersion}`
        },
        timeout: 6000
      };

      let settled = false;
      const finish = (result: GitHubLookup): void => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      const req = https.get(options, (res: IncomingMessage) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          data += chunk;
          if (data.length > 512 * 1024) {
            req.destroy();
            finish({ kind: 'error', message: 'GitHub release response was unexpectedly large.' });
          }
        });
        res.on('end', () => {
          if (res.statusCode === 404) {
            finish({ kind: 'not-found' });
            return;
          }
          if (res.statusCode !== 200) {
            const detail = res.statusCode === 403
              ? 'GitHub API rate limit or access restriction (HTTP 403).'
              : `GitHub API returned HTTP ${res.statusCode}.`;
            finish({ kind: 'error', message: detail });
            return;
          }
          try {
            const release = JSON.parse(data);
            const tagName = String(release.tag_name || '').trim();
            if (!tagName) {
              finish({ kind: 'error', message: 'GitHub release metadata is missing a version tag.' });
              return;
            }
            if (release.draft) {
              finish({ kind: 'not-found' });
              return;
            }
            const version = tagName.replace(/^[vV]/, '');
            finish({
              kind: 'ok',
              version,
              notes: typeof release.body === 'string' ? release.body.slice(0, 6000) : undefined,
              url: release.html_url || `${RELEASES_URL}/latest`
            });
          } catch (e) {
            console.warn('[AppUpdater] Failed to parse GitHub release JSON:', e);
            finish({ kind: 'error', message: 'Unable to parse release metadata from GitHub.' });
          }
        });
      });

      req.on('error', (err) => {
        console.warn('[AppUpdater] Network error during update check:', err.message);
        finish({
          kind: 'error',
          message: 'Unable to reach GitHub Releases. Please verify your internet connection.'
        });
      });

      req.on('timeout', () => {
        req.destroy();
        finish({ kind: 'error', message: 'The update check timed out. Please try again later.' });
      });
    });
  }

  private async fetchReleaseNotes(version: string): Promise<string | undefined> {
    try {
      const lookup = await this.queryGitHubLatestRelease();
      if (lookup.kind === 'ok' && compareSemver(lookup.version, version) === 0) {
        return lookup.notes;
      }
    } catch (err) {
      console.warn('[AppUpdater] Could not fetch release notes:', err);
    }
    return undefined;
  }

  private formatReleaseNotes(notes: unknown): string | undefined {
    if (typeof notes === 'string') {
      return notes.trim().slice(0, 6000) || undefined;
    }
    if (Array.isArray(notes)) {
      const text = notes
        .map((entry: any) => (entry && typeof entry.note === 'string' ? entry.note : ''))
        .filter(Boolean)
        .join('\n\n')
        .trim();
      return text ? text.slice(0, 6000) : undefined;
    }
    return undefined;
  }

  private isCancellationError(err: any): boolean {
    const name = String(err?.name || '');
    const message = String(err?.message || '');
    return /cancell?ed/i.test(name) || /cancell?ed|cancellation/i.test(message);
  }

  private toUserFacingError(err: any): string {
    const raw = String(err?.message || err || 'Update operation failed.');
    if (/net::|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|socket hang up/i.test(raw)) {
      return 'Network error while contacting the update server. Please check your connection and try again.';
    }
    if (/404|cannot find latest|latest\.ya?ml|no such file/i.test(raw)) {
      return 'The published release is missing its update metadata (latest.yml/latest-mac.yml).';
    }
    if (/403|401|token|authentication|authorization/i.test(raw)) {
      return 'The update server rejected the request (authentication or rate limit).';
    }
    if (/sha512|checksum|integrity|signature/i.test(raw)) {
      return `The downloaded update failed integrity verification: ${raw}`;
    }
    if (/5\d\d/.test(raw)) {
      return 'The update server returned a temporary server error. Please try again later.';
    }
    return raw;
  }
}
