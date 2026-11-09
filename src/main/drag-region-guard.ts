import { WebContents } from 'electron';

/**
 * Web pages may declare `-webkit-app-region: drag` (chatgpt.com does on its
 * header toolbars). In a normal browser tab that property is inert, but inside
 * a WebContentsView of a hidden-titlebar window Electron honours it: the OS
 * treats the area as window caption and never delivers the click to the page,
 * so non-<button> controls in those toolbars appear dead.
 *
 * Hosted content must never own window dragging — only the app's own tab bar
 * does. The rule is selector-agnostic (no dependency on the page's DOM) and is
 * inserted at user origin so it also outranks `!important` author rules.
 */
export const NO_DRAG_REGIONS_CSS =
  '*, *::before, *::after { -webkit-app-region: no-drag !important; }';

export function neutralizeDragRegions(wc: WebContents): void {
  const apply = (): void => {
    if (wc.isDestroyed()) return;
    wc.insertCSS(NO_DRAG_REGIONS_CSS, { cssOrigin: 'user' }).catch(err => {
      console.warn('[DragRegionGuard] Failed to neutralize drag regions:', err);
    });
  };
  // Inserted CSS is per-document, so re-apply for every new document.
  wc.on('dom-ready', apply);
}
