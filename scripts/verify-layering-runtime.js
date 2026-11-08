'use strict';
/**
 * Runtime verification for WebContentsView layering (BUG-02, BUG-04, BUG-05).
 *
 * Boots the real built app (dist/main/index.js) and drives it with X11 pointer
 * events via xdotool, so hit-testing is performed by the OS window stack exactly
 * as for a user. Requires an X display (use xvfb-run on headless Linux).
 *
 *   xvfb-run -a -s "-screen 0 1600x1000x24" \
 *     node_modules/electron/dist/electron --no-sandbox --disable-gpu \
 *     scripts/verify-layering-runtime.js
 */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { app, BrowserWindow, Menu } = require('electron');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const xdo = (...args) => execFileSync('xdotool', args.map(String));
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

// Record native context-menu popups (and their item labels) instead of showing them.
let popupCount = 0;
let lastMenuLabels = [];
const origBuildFromTemplate = Menu.buildFromTemplate;
Menu.buildFromTemplate = function buildRecorded(template) {
  lastMenuLabels = template.map((i) => i.label || i.type || '');
  return origBuildFromTemplate.call(this, template);
};
Menu.prototype.popup = function popupRecorded() {
  popupCount++;
};

async function waitFor(fn, timeoutMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (_) { /* retry */ }
    await sleep(150);
  }
  throw new Error('waitFor timeout');
}

require(path.join(__dirname, '../dist/main/index.js'));

app.whenReady().then(async () => {
  const win = await waitFor(() => BrowserWindow.getAllWindows()[0]);
  await waitFor(() => win.webContents.getURL().startsWith('file:') && !win.webContents.isLoading());
  await sleep(800);

  win.setBounds({ x: 0, y: 0, width: 1200, height: 800 });
  await sleep(500);

  const root = win.webContents;
  // Force one layout pass at the final size (no WM under Xvfb may not deliver a
  // resize event for setBounds). Mode toggles run updateLayoutBounds.
  await root.executeJavaScript(`window.api.setLayoutMode('chat-only')`);
  await sleep(300);
  const exec = (code) => root.executeJavaScript(code);
  const views = () => win.contentView.children;
  const origin = () => win.getContentBounds();
  const at = (cx, cy) => {
    const o = origin();
    return [o.x + Math.round(cx), o.y + Math.round(cy)];
  };
  const click = (cx, cy, button = 1) => {
    const [x, y] = at(cx, cy);
    xdo('mousemove', '--sync', x, y);
    xdo('click', button);
  };
  const rectOf = (id) => exec(`(() => { const r = document.getElementById('${id}').getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; })()`);

  // ---- Split layout geometry (BUG-02) -------------------------------------
  await exec(`window.api.setLayoutMode('split')`);
  await exec(`window.api.setSplitRatio(0.5)`);
  await sleep(700);
  const W = origin().width;
  const splitX = Math.round(W * 0.5);
  let chatB = null;
  let sideB = null;
  for (const v of views()) {
    const b = v.getBounds();
    if (b.x === 0) chatB = b;
    else sideB = b;
  }
  check('split: two views attached', views().length === 2, `attached=${views().length}`);
  check('split: chat ends 3px before split line', !!chatB && chatB.x + chatB.width === splitX - 3,
    chatB ? `chat right=${chatB.x + chatB.width}, expected ${splitX - 3}` : 'no chat view');
  check('split: browser starts 3px after split line', !!sideB && sideB.x === splitX + 3,
    sideB ? `browser x=${sideB.x}, expected ${splitX + 3}` : 'no browser view');

  // ---- Divider drag through the real gutter (BUG-02) ----------------------
  const divRect = await rectOf('split-divider');
  check('divider: sits over the uncovered gutter', Math.abs((divRect.x + divRect.w / 2) - splitX) <= 1,
    `divider centre=${divRect.x + divRect.w / 2}, split=${splitX}`);

  const [gx, gy] = at(splitX, 400);
  xdo('mousemove', '--sync', gx, gy);
  xdo('mousedown', 1);
  await sleep(200);
  const isDragging = await exec(`document.body.classList.contains('is-resizing')`);
  check('drag: pointer on gutter reaches renderer divider', isDragging === true);

  const [tx] = at(800, 400);
  for (let x = gx; x <= tx; x += 20) {
    xdo('mousemove', '--sync', x, gy);
    await sleep(20);
  }
  check('drag: views detached while dragging', views().length === 0, `attached=${views().length}`);

  xdo('mouseup', 1);
  await sleep(600);
  const state = await exec(`window.api.getBrowserState().then(s => ({ r: s.splitRatio, m: s.layoutMode }))`);
  check('drag: released at ~0.667 ratio', Math.abs(state.r - 0.667) < 0.01, `ratio=${state.r}`);
  check('drag: views re-attached after release', views().length === 2, `attached=${views().length}`);
  const newSplit = Math.round(W * state.r);
  const chat2 = views().map((v) => v.getBounds()).find((b) => b.x === 0);
  check('drag: chat width follows new ratio', !!chat2 && chat2.x + chat2.width === newSplit - 3,
    chat2 ? `chat right=${chat2.x + chat2.width}, expected ${newSplit - 3}` : 'no chat view');

  // Persistence: the ratio must be written to disk on release.
  const userData = app.getPath('userData');
  const saved = fs.readdirSync(userData)
    .filter((f) => f.endsWith('.json'))
    .some((f) => {
      try {
        const txt = fs.readFileSync(path.join(userData, f), 'utf8');
        const m = txt.match(/"splitRatio"\s*:\s*([0-9.]+)/);
        return !!m && Math.abs(Number(m[1]) - state.r) < 0.001;
      } catch (_) { return false; }
    });
  check('persist: split ratio saved to settings after release', saved);

  // ---- Update popover above WebContentsView (BUG-04) ----------------------
  const btn = await rectOf('btn-updates');
  click(btn.cx, btn.cy);
  await sleep(500);
  const popOpen = await exec(`!document.getElementById('update-popover').classList.contains('hidden')`);
  check('popover: opens from update button', popOpen === true);

  const pr = await rectOf('update-popover');
  const maxRight = Math.max(...views().map((v) => { const b = v.getBounds(); return b.x + b.width; }));
  check('popover: views reserve strip under popover', maxRight <= pr.x,
    `views right=${maxRight}, popover left=${pr.x}`);

  // The popover body sits below the tab strip, where a view would cover it. A
  // click there must reach the root document (captured pointerdown inside the popover).
  await exec(`window.__popPtr = []; window.addEventListener('pointerdown', (e) => {
    window.__popPtr.push(!!document.getElementById('update-popover').contains(e.target)); }, true)`);
  const body = await rectOf('update-popover-body');
  click(body.cx, body.cy);
  await sleep(400);
  const bodyHit = await exec(`window.__popPtr.some(Boolean)`);
  check('popover: body receives pointer (not covered by view)', bodyHit === true);

  const closeBtn = await rectOf('btn-popover-close');
  click(closeBtn.cx, closeBtn.cy);
  await sleep(500);
  const stillOpen = await exec(`!document.getElementById('update-popover').classList.contains('hidden')`);
  check('popover: close button dismisses popover', stillOpen === false);

  const restored = Math.max(...views().map((v) => { const b = v.getBounds(); return b.x + b.width; }));
  check('popover: views restored to full width after close', restored === W,
    `views right=${restored}, window=${W}`);

  // ---- Context menu for web views (BUG-05) --------------------------------
  popupCount = 0;
  click(120, 300, 3); // chat view area
  await sleep(700);
  check('context-menu: right-click in ChatGPT view opens menu', popupCount >= 1, `popups=${popupCount}`);

  await exec(`window.api.setLayoutMode('split')`);
  await sleep(500);
  const sideNow = views().map((v) => v.getBounds()).find((b) => b.x > 0);
  if (sideNow) {
    popupCount = 0;
    click(sideNow.x + 60, sideNow.y + 120, 3);
    await sleep(700);
    check('context-menu: right-click in browser view opens menu', popupCount >= 1, `popups=${popupCount}`);
  } else {
    check('context-menu: browser view available for test', false, 'no browser view');
  }

  // Editable and selection contexts on a local page loaded into the browser view.
  await exec(`window.api.setLayoutMode('split')`);
  await sleep(400);
  const browserView = views().find((v) => v.getBounds().x > 0);
  if (browserView) {
    const page = `<html><body style="margin:0;font:16px sans-serif">
      <textarea style="position:absolute;left:20px;top:20px;width:300px;height:60px">hello</textarea>
      <p id="p" style="position:absolute;left:20px;top:150px;margin:0">Selectable text</p></body></html>`;
    await browserView.webContents.loadURL(`data:text/html,${encodeURIComponent(page)}`);
    await sleep(800);
    const bb = browserView.getBounds();
    popupCount = 0;
    click(bb.x + 80, bb.y + 60, 3); // textarea
    await sleep(700);
    const editLabels = lastMenuLabels.join('|');
    check('context-menu: editable field offers Cut/Copy/Paste',
      /Cut/.test(editLabels) && /Copy/.test(editLabels) && /Paste/.test(editLabels), `items=${editLabels}`);

    await browserView.webContents.executeJavaScript(
      `window.getSelection().selectAllChildren(document.getElementById('p'))`);
    await sleep(200);
    popupCount = 0;
    click(bb.x + 60, bb.y + 165, 3); // selected paragraph
    await sleep(700);
    const selLabels = lastMenuLabels.join('|');
    check('context-menu: text selection offers Copy', /Copy/.test(selLabels), `items=${selLabels}`);
  } else {
    check('context-menu: browser view available for edit/selection test', false, 'no browser view');
  }

  // ---- Mode regression (side browser / tabs) ------------------------------
  await exec(`window.api.setLayoutMode('chat-only')`);
  await sleep(500);
  check('mode: chat-only attaches only chat view', views().length === 1, `attached=${views().length}`);
  await exec(`window.api.setLayoutMode('browser-only')`);
  await sleep(500);
  check('mode: browser-only attaches only browser view', views().length === 1 && views()[0].getBounds().x === 0,
    `attached=${views().length}`);
  await exec(`window.api.setLayoutMode('split')`);
  await sleep(500);
  check('mode: split re-attaches both views', views().length === 2, `attached=${views().length}`);

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} runtime layering checks passed`);
  app.exit(results.every(Boolean) ? 0 : 1);
}).catch((err) => {
  console.error('verify-layering-runtime failed:', err);
  app.exit(2);
});
