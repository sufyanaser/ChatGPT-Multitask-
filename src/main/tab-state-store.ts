import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { TabsPersistedState } from '../common/types';

export class TabStateStore {
  private filePath: string;
  private readonly CURRENT_VERSION = 1;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, 'tabs-state.json');
  }

  public load(): TabsPersistedState | null {
    try {
      if (!fs.existsSync(this.filePath)) {
        return null;
      }
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const data = JSON.parse(raw) as TabsPersistedState;
      if (data && Array.isArray(data.tabs) && data.tabs.length > 0) {
        return data;
      }
      return null;
    } catch (err) {
      console.error('[TabStateStore] Failed to load tabs state, resetting to default:', err);
      return null;
    }
  }

  public save(state: TabsPersistedState): void {
    try {
      const payload: TabsPersistedState = {
        version: this.CURRENT_VERSION,
        tabs: state.tabs.map((t: TabsPersistedState['tabs'][number]) => ({
          id: t.id,
          url: t.url,
          title: t.title,
          typeOverride: t.typeOverride,
          conversationType: t.conversationType
        })),
        activeTabId: state.activeTabId
      };
      fs.writeFileSync(this.filePath, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (err) {
      console.error('[TabStateStore] Failed to save tabs state:', err);
    }
  }
}
