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
  // Views stay attached and follow the pointer live (renderer holds mouse capture).
  await sleep(200);
  check('drag: views stay attached while dragging', views().length === 2, `attached=${views().length}`);
  const chatMid = views().map((v) => v.getBounds()).find((b) => b.x === 0);
  check('drag: chat view resizes live before release', !!chatMid && chatMid.width > splitX + 100,
    chatMid ? `chat width mid-drag=${chatMid.width}, start=${splitX - 3}` : 'no chat view');

  xdo('mouseup', 1);
  await sleep(600);
  const state = await exec(`window.api.getBrowserState().then(s => ({ r: s.splitRatio, m: s.layoutMode }))`);
  check('drag: released at ~0.667 ratio', Math.abs(state.r - 0.667) < 0.01, `ratio=${state.r}`);
  check('drag: views attached after release', views().length === 2, `attached=${views().length}`);
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
  // The ChatGPT-view case runs further down against a local page: live
  // chatgpt.com content at a fixed point is profile-dependent and made this
  // check flaky (an empty area yields no menu items, by design).

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

  // ---- Hosted pages must not own window drag regions ----------------------
  // chatgpt.com ships `-webkit-app-region: drag` (incl. an !important variant)
  // on its toolbars; non-<button> controls inside would lose OS clicks.
  const chatView = views().find((v) => v.getBounds().x === 0);
  if (chatView) {
    const dragPage = `<html><head><style>
      .draggable{-webkit-app-region:drag}.draggable button{-webkit-app-region:no-drag}
      .\\!draggable{-webkit-app-region:drag!important}
      .t{position:absolute;top:10px;width:80px;height:36px;background:#9cf}
      </style></head><body style="margin:0">
      <div class="draggable" style="position:absolute;left:0;top:0;width:100%;height:56px">
        <a class="t" id="a" style="left:10px" href="#x">a</a>
        <div class="t" id="d" style="left:110px" role="button" tabindex="0">d</div>
      </div>
      <div class="!draggable" style="position:absolute;left:0;top:60px;width:100%;height:56px">
        <div class="t" id="i" style="left:10px" role="button">i</div>
      </div>
      <p id="p" style="position:absolute;left:20px;top:200px;margin:0;font:16px sans-serif">Selectable text</p>
      <script>window.__c=[];for(const id of ['a','d','i'])document.getElementById(id).addEventListener('click',()=>__c.push(id));</script>
      </body></html>`;
    await chatView.webContents.loadURL(`data:text/html,${encodeURIComponent(dragPage)}`);
    await sleep(900);
    const cb = chatView.getBounds();
    click(cb.x + 50, cb.y + 28); await sleep(300);
    click(cb.x + 150, cb.y + 28); await sleep(300);
    click(cb.x + 50, cb.y + 88); await sleep(300);
    const got = await chatView.webContents.executeJavaScript('__c');
    check('drag-regions: <a> inside page drag region receives click', got.includes('a'), `clicks=${got}`);
    check('drag-regions: div[role=button] inside page drag region receives click', got.includes('d'), `clicks=${got}`);
    check('drag-regions: !important page drag region is neutralized', got.includes('i'), `clicks=${got}`);

    await chatView.webContents.executeJavaScript(
      `window.getSelection().selectAllChildren(document.getElementById('p'))`);
    await sleep(200);
    popupCount = 0;
    click(cb.x + 60, cb.y + 210, 3);
    await sleep(700);
    check('context-menu: right-click in ChatGPT view opens menu', popupCount >= 1 && /Copy/.test(lastMenuLabels.join('|')),
      `popups=${popupCount} items=${lastMenuLabels.join('|')}`);
  } else {
    check('drag-regions: chat view available', false, 'no chat view');
  }

  // ---- Tab strip: reorder after close, overflow ---------------------------
  await exec(`window.api.setLayoutMode('chat-only')`);
  const tabIds = () => exec(`window.api.getInitialState().then(s => s.tabs.map(t => t.id))`);
  const startCount = (await tabIds()).length;
  for (let i = 0; i < 3; i++) await exec(`window.api.createTab('about:blank')`);
  await sleep(600);
  let ids = await tabIds();
  // Close the first of the new tabs so creation-time indices are stale.
  await exec(`window.api.closeTab(${JSON.stringify(ids[startCount])})`);
  await sleep(400);
  ids = await tabIds();
  const last = ids.length - 1;
  await exec(`(() => {
    const els = document.querySelectorAll('#tabs-list .tab-item');
    const dt = new DataTransfer();
    els[${last}].dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    els[${last - 1}].dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    els[${last}].dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
  })()`);
  await sleep(400);
  const after = await tabIds();
  check('tabs: reorder after a close moves the dragged tab to the drop slot',
    after[last - 1] === ids[last] && after[last] === ids[last - 1] && after.length === ids.length,
    `before=${ids.map((x) => x.slice(0, 4))} after=${after.map((x) => x.slice(0, 4))}`);

  for (let i = 0; i < 22; i++) await exec(`window.api.createTab('about:blank')`);
  await sleep(1200);
  const strip = await exec(`(() => {
    const list = document.getElementById('tabs-list');
    const lr = list.getBoundingClientRect();
    const ar = list.querySelector('.tab-item.active').getBoundingClientRect();
    const nb = document.getElementById('btn-new-tab').getBoundingClientRect();
    const spacer = document.getElementById('windows-controls-spacer').getBoundingClientRect();
    const widths = [...list.children].map(c => c.getBoundingClientRect().width);
    return { overflow: list.scrollWidth > list.clientWidth, fadeStart: list.classList.contains('overflow-start'),
      activeVisible: ar.left >= lr.left - 1 && ar.right <= lr.right + 1, activeW: ar.width,
      minW: Math.min(...widths), newTabRight: nb.right, limit: spacer.left || window.innerWidth,
      count: list.children.length };
  })()`);
  check('tabs: many tabs shrink to the floor and the strip scrolls', strip.overflow && strip.minW >= 75 && strip.minW <= 80,
    `count=${strip.count} minW=${strip.minW}`);
  check('tabs: active tab stays fully visible with readable width', strip.activeVisible && strip.activeW >= 130,
    `activeW=${strip.activeW}`);
  check('tabs: start-edge fade signals hidden tabs', strip.fadeStart === true);
  check('tabs: new-tab button stays inside the bar', strip.newTabRight <= strip.limit, `right=${strip.newTabRight} limit=${strip.limit}`);

  // Leave the profile as found: close every tab this section opened.
  for (const id of (await tabIds()).slice(startCount)) {
    await exec(`window.api.closeTab(${JSON.stringify(id)})`);
  }
  await sleep(600);
  check('tabs: closing the extra tabs restores the original count', (await tabIds()).length === startCount,
    `count=${(await tabIds()).length}, expected ${startCount}`);

  // ---- Appearance: mode toggle and visual styles ---------------------------
  // The toggle must step Follow System -> Dark -> Light -> Follow System on any
  // system theme (it used to stick when the system theme was light).
  await exec(`window.api.setTheme('system')`);
  await sleep(400);
  const themeBtn = await rectOf('btn-theme');
  const modeSeen = [];
  for (let i = 0; i < 3; i++) {
    click(themeBtn.cx, themeBtn.cy);
    await sleep(450);
    modeSeen.push(await exec(`(() => { const t = document.getElementById('btn-theme').title;
      const dark = document.body.classList.contains('theme-dark');
      return (t.includes('Follow System') ? 'system' : t.includes('Dark (') || t.startsWith('Appearance: Dark') ? 'dark' : 'light') + ':' + (dark ? 'D' : 'L'); })()`));
  }
  check('appearance: toggle cycles system -> dark -> light -> system',
    modeSeen[0] === 'dark:D' && modeSeen[1] === 'light:L' && modeSeen[2].startsWith('system:'), `seen=${modeSeen}`);

  const expectBar = { classic: ['rgb(24, 24, 24)', 'rgb(243, 243, 243)'], glass: ['rgb(18, 20, 28)', 'rgb(233, 238, 247)'],
    aurora: ['rgb(13, 17, 23)', 'rgb(238, 242, 251)'], neumorph: ['rgb(36, 38, 43)', 'rgb(230, 233, 239)'] };
  for (const style of ['glass', 'aurora', 'neumorph', 'classic']) {
    const got = [];
    for (const mode of ['dark', 'light']) {
      await exec(`window.api.setTheme('${mode}')`);
      await exec(`window.api.setUiStyle('${style}')`);
      await sleep(450);
      got.push(await exec(`(() => { const bar = document.getElementById('tab-bar-container');
        return { cls: document.body.classList.contains('style-${style}'), bg: getComputedStyle(bar).backgroundColor,
          fx: getComputedStyle(document.querySelector('.bar-fx')).display,
          anim: getComputedStyle(document.querySelector('.bar-fx-layer')).animationName,
          blur: getComputedStyle(document.querySelector('.tab-item.active')).backdropFilter }; })()`));
    }
    check(`style ${style}: dark and light bar colours applied`,
      got[0].cls && got[1].cls && got[0].bg === expectBar[style][0] && got[1].bg === expectBar[style][1],
      `dark=${got[0].bg} light=${got[1].bg}`);
    if (style === 'glass') check('style glass: active tab uses backdrop blur', /blur/.test(got[0].blur) && got[0].fx === 'block', `blur=${got[0].blur}`);
    if (style === 'aurora') check('style aurora: backdrop animates', got[0].anim === 'auroraDrift' && got[0].fx === 'block', `anim=${got[0].anim}`);
    if (style === 'classic') check('style classic: no decorative backdrop', got[0].fx === 'none', `fx=${got[0].fx}`);
  }
  const savedStyle = fs.readFileSync(path.join(app.getPath('userData'), 'settings.json'), 'utf8');
  check('style: selection persisted to settings', /"uiStyle"\s*:\s*"classic"/.test(savedStyle));
  await exec(`window.api.setTheme('system')`);
  await sleep(300);

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} runtime layering checks passed`);
  app.exit(results.every(Boolean) ? 0 : 1);
}).catch((err) => {
  console.error('verify-layering-runtime failed:', err);
  app.exit(2);
});
