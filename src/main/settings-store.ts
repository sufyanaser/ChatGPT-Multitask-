import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ThemeMode, UserSettings, LayoutMode, UiStyle, UI_STYLES, LEGACY_UI_STYLES } from '../common/types';

export class SettingsStore {
  private filePath: string;
  private readonly DEFAULT_SETTINGS: UserSettings = {
    themeMode: 'system',
    uiStyle: 'classic',
    zoomFactor: 1.0,
    layoutMode: 'chat-only',
    splitRatio: 0.5
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
      const uiStyle: UiStyle = UI_STYLES.includes(data.uiStyle)
        ? data.uiStyle
        : (typeof data.uiStyle === 'string' && LEGACY_UI_STYLES[data.uiStyle]) || 'classic';
      const zoom = typeof data.zoomFactor === 'number' && !isNaN(data.zoomFactor)
        ? Math.min(1.5, Math.max(0.8, Math.round(data.zoomFactor * 10) / 10))
        : 1.0;
      const layoutMode: LayoutMode = ['chat-only', 'split', 'browser-only'].includes(data.layoutMode)
        ? data.layoutMode
        : 'chat-only';
      const splitRatio = typeof data.splitRatio === 'number' && !isNaN(data.splitRatio)
        ? Math.min(0.8, Math.max(0.2, data.splitRatio))
        : 0.5;

      return {
        themeMode,
        uiStyle,
        zoomFactor: zoom,
        layoutMode,
        splitRatio
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
        uiStyle: settings.uiStyle && UI_STYLES.includes(settings.uiStyle) ? settings.uiStyle : current.uiStyle,
        zoomFactor: settings.zoomFactor !== undefined
          ? Math.min(1.5, Math.max(0.8, Math.round(settings.zoomFactor * 10) / 10))
          : current.zoomFactor,
        layoutMode: settings.layoutMode ?? current.layoutMode,
        splitRatio: settings.splitRatio !== undefined
          ? Math.min(0.8, Math.max(0.2, settings.splitRatio))
          : current.splitRatio
      };
      fs.writeFileSync(this.filePath, JSON.stringify(updated, null, 2), 'utf-8');
      return updated;
    } catch (err) {
      console.error('[SettingsStore] Failed to save settings:', err);
      return { ...this.DEFAULT_SETTINGS, ...settings };
    }
  }
}
