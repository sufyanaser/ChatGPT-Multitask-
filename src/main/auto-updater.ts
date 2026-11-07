import { app } from 'electron';
import { autoUpdater } from 'electron-updater';

export class AppUpdater {
  constructor() {
    if (!app.isPackaged) {
      console.log('[AppUpdater] Skipping update check in development mode');
      return;
    }

    // Never force download without integrity checks and user notification
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

    // Perform check after application has settled
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(err => {
        console.warn('[AppUpdater] Update verification deferred:', err?.message || err);
      });
    }, 6000);
  }
}
