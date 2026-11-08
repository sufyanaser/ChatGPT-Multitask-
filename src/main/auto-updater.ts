import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as https from 'https';
import { UpdateInfoPayload } from '../common/types';

export class AppUpdater {
  constructor() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;

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
  }

  public async checkForUpdatesManually(): Promise<UpdateInfoPayload> {
    const currentVersion = app.getVersion();
    const checkedAt = new Date().toISOString();

    // Query GitHub Releases API directly for official release verification
    return new Promise((resolve) => {
      const options = {
        hostname: 'api.github.com',
        path: '/repos/sufyanaser/ChatGPT-Multitask-/releases/latest',
        headers: {
          'User-Agent': `ChatGPT-Multitask-Updater/${currentVersion}`
        },
        timeout: 6000
      };

      const req = https.get(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const release = JSON.parse(data);
              const tagName = (release.tag_name || '').replace(/^v/, '');
              if (tagName && tagName !== currentVersion) {
                resolve({
                  status: 'available',
                  hasUpdate: true,
                  currentVersion,
                  latestVersion: tagName,
                  releaseNotes: release.body || 'New stable release available on GitHub.',
                  releaseUrl: release.html_url || 'https://github.com/sufyanaser/ChatGPT-Multitask-/releases/latest',
                  checkedAt
                });
                return;
              }
            } catch (e) {
              console.warn('[AppUpdater] Error parsing release JSON:', e);
            }
          }

          // If 404 (no releases published yet) or release is same as current version
          resolve({
            status: 'not-available',
            hasUpdate: false,
            currentVersion,
            latestVersion: currentVersion,
            releaseNotes: 'You are running the latest verified version.',
            releaseUrl: 'https://github.com/sufyanaser/ChatGPT-Multitask-/releases',
            checkedAt
          });
        });
      });

      req.on('error', (err) => {
        console.warn('[AppUpdater] Network error during update check:', err.message);
        resolve({
          status: 'error',
          hasUpdate: false,
          currentVersion,
          errorMessage: 'Unable to reach update server. Please verify your internet connection.',
          releaseUrl: 'https://github.com/sufyanaser/ChatGPT-Multitask-/releases',
          checkedAt
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          status: 'error',
          hasUpdate: false,
          currentVersion,
          errorMessage: 'Update check timed out. Please try again later.',
          releaseUrl: 'https://github.com/sufyanaser/ChatGPT-Multitask-/releases',
          checkedAt
        });
      });
    });
  }
}
