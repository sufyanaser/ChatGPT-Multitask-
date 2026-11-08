import { BrowserWindow, Menu, MenuItemConstructorOptions, WebContents, clipboard } from 'electron';

export interface WebContextMenuOptions {
  getWindow: () => BrowserWindow | null;
  openLinkInNewTab: (url: string) => void;
}

const HTTP_URL = /^https?:\/\//i;

/**
 * Right-click menu for ChatGPT and side-browser WebContentsViews. Electron shows
 * no context menu by default, so without this handler right-click copy/paste is
 * unavailable inside web views. Actions call the right-clicked WebContents
 * directly (not role-based), so they target that view even when another view
 * holds focus. Keyboard shortcuts are untouched: this only listens to the
 * `context-menu` event and never calls preventDefault on key input.
 */
export function buildWebContextMenuTemplate(
  wc: WebContents,
  params: Electron.ContextMenuParams,
  opts: Omit<WebContextMenuOptions, 'getWindow'>
): MenuItemConstructorOptions[] {
  const flags = params.editFlags;
  const items: MenuItemConstructorOptions[] = [];

  if (params.linkURL && HTTP_URL.test(params.linkURL)) {
    const url = params.linkURL;
    items.push({ label: 'Open Link in New Tab', click: () => opts.openLinkInNewTab(url) });
    items.push({ label: 'Copy Link Address', click: () => clipboard.writeText(url) });
    items.push({ type: 'separator' });
  }

  if (params.mediaType === 'image') {
    items.push({
      label: 'Copy Image',
      enabled: !wc.isDestroyed(),
      click: () => { if (!wc.isDestroyed()) wc.copyImageAt(params.x, params.y); }
    });
    if (params.srcURL && HTTP_URL.test(params.srcURL)) {
      const src = params.srcURL;
      items.push({ label: 'Copy Image Address', click: () => clipboard.writeText(src) });
    }
    items.push({ type: 'separator' });
  }

  if (params.isEditable) {
    items.push(
      { label: 'Undo', enabled: flags.canUndo, click: () => wc.undo() },
      { label: 'Redo', enabled: flags.canRedo, click: () => wc.redo() },
      { type: 'separator' },
      { label: 'Cut', enabled: flags.canCut, click: () => wc.cut() },
      { label: 'Copy', enabled: flags.canCopy, click: () => wc.copy() },
      { label: 'Paste', enabled: flags.canPaste, click: () => wc.paste() },
      { type: 'separator' },
      { label: 'Select All', enabled: flags.canSelectAll, click: () => wc.selectAll() }
    );
  } else if (params.selectionText || flags.canCopy) {
    items.push(
      { label: 'Copy', enabled: flags.canCopy, click: () => wc.copy() },
      { type: 'separator' },
      { label: 'Select All', enabled: flags.canSelectAll, click: () => wc.selectAll() }
    );
  } else if (flags.canSelectAll) {
    items.push({ label: 'Select All', click: () => wc.selectAll() });
  }

  // Trim leading/trailing/duplicate separators left by conditional sections.
  return items.filter((item, i, arr) => {
    if (item.type !== 'separator') return true;
    if (i === 0 || i === arr.length - 1) return false;
    return arr[i - 1].type !== 'separator';
  });
}

export function attachWebContextMenu(wc: WebContents, opts: WebContextMenuOptions): void {
  wc.on('context-menu', (_event, params) => {
    if (wc.isDestroyed()) return;
    const template = buildWebContextMenuTemplate(wc, params, opts);
    if (template.length === 0) return;
    const win = opts.getWindow();
    if (!win) return;
    Menu.buildFromTemplate(template).popup({ window: win, x: params.x, y: params.y });
  });
}
