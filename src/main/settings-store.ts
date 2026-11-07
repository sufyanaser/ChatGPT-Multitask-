import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ThemeMode, UserSettings } from '../common/types';

export class SettingsStore {
  private filePath: string;
  private readonly DEFAULT_SETTINGS: UserSettings = {
    themeMode: 'system',
    zoomFactor: 1.0
  };

  constructor() {
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, 'settings.json');
  }

  public load(): UserSettings {
    try {
      if (!fs.existsSync(this.filePath)) {
        return { ...this.DEFAULT_SETTINGS };
      }
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const data = JSON.parse(raw);
      const themeMode: ThemeMode = ['system', 'dark', 'light'].includes(data.themeMode)
        ? data.themeMode
        : 'system';
      const zoom = typeof data.zoomFactor === 'number' && !isNaN(data.zoomFactor)
        ? Math.min(1.5, Math.max(0.8, Math.round(data.zoomFactor * 10) / 10))
        : 1.0;

      return {
        themeMode,
        zoomFactor: zoom
      };
    } catch (err) {
      console.error('[SettingsStore] Failed to load settings, using defaults:', err);
      return { ...this.DEFAULT_SETTINGS };
    }
  }

  public save(settings: Partial<UserSettings>): UserSettings {
    try {
      const current = this.load();
      const updated: UserSettings = {
        themeMode: settings.themeMode ?? current.themeMode,
        zoomFactor: settings.zoomFactor !== undefined
          ? Math.min(1.5, Math.max(0.8, Math.round(settings.zoomFactor * 10) / 10))
          : current.zoomFactor
      };
      fs.writeFileSync(this.filePath, JSON.stringify(updated, null, 2), 'utf-8');
      return updated;
    } catch (err) {
      console.error('[SettingsStore] Failed to save settings:', err);
      return { ...this.DEFAULT_SETTINGS, ...settings };
    }
  }
}
