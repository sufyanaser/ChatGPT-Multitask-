import { app } from 'electron';
import { autoUpdater } from 'electron-updater';

export class AppUpdater {
  constructor() {
    if (!app.isPackaged) {
      console.log('[AppUpdater] Skipping update check in development mode');
      return;
    }

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      console.log('[AppUpdater] Checking for release updates from GitHub...');
    });

    autoUpdater.on('update-available', (info) => {
      console.log(`[AppUpdater] Verified update available: v${info.version}`);
    });

    autoUpdater.on('update-not-available', () => {
      console.log('[AppUpdater] Application is running latest verified release.');
    });

    autoUpdater.on('error', (err) => {
      console.warn('[AppUpdater] Update check notice:', err?.message || err);
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log(`[AppUpdater] Update downloaded: version ${info.version}`);
    });

    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(err => {
        console.warn('[AppUpdater] Update verification deferred:', err?.message || err);
      });
    }, 6000);
  }
}

export class UpdateService {
  private static instance: UpdateService;
  private updater?: AppUpdater;

  private constructor() {
    this.updater = new AppUpdater();
  }

  public static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  public checkForUpdates(): void {
    if (!app.isPackaged) {
      console.log('[UpdateService] Skipping update check in development mode.');
      return;
    }
    autoUpdater.checkForUpdates().catch(err => {
      console.warn('[UpdateService] Update check failed:', err);
    });
  }
}
