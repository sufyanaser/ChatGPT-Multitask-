/**
 * Challenger 4 Adversarial Empirical Test Suite for Milestone 1 Iteration 2
 * Focus: Lifecycle, Mutation, and Session Isolation Stress Testing
 */

const { app, BrowserWindow, WebContentsView } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');

const { TabManager, RTL_SCOPED_CSS, RTL_OBSERVER_SCRIPT } = require('../dist/main/tab-manager');
const { SideBrowserManager } = require('../dist/main/side-browser-manager');

if (!RTL_SCOPED_CSS || !RTL_OBSERVER_SCRIPT) {
  console.error('FATAL: RTL exports missing from dist/main/tab-manager');
  process.exit(1);
}

const TEST_TIMEOUT_MS = 40000;
const timeoutTimer = setTimeout(() => {
  console.error('❌ Challenger 4 Test timed out after 40 seconds');
  app.exit(1);
}, TEST_TIMEOUT_MS);

let localServer;
let localServerPort;

function startLocalHttpServer() {
  const fixturePath = path.join(__dirname, 'fixtures', 'side-test.html');
  const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8');

  return new Promise((resolve) => {
    localServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fixtureHtml);
    });
    localServer.listen(0, '127.0.0.1', () => {
      localServerPort = localServer.address().port;
      resolve();
    });
  });
}

app.on('window-all-closed', (e) => {
  if (e) e.preventDefault();
});

app.whenReady().then(async () => {
  console.log('================================================================');
  console.log('  CHALLENGER 4: ADVERSARIAL STRESS SUITE (LIFECYCLE & MUTATION)');
  console.log('================================================================\n');

  await startLocalHttpServer();

  const evidenceDir = path.join(__dirname, '..', '.agents', 'teamwork', 'challenger_m1_iter2_2');
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  const report = {
    baselineArea1_StreamingHappyPath: {},
    baselineArea2_SideBrowserIsolation: {},
    baselineArea3_TabLifecycleResilience: {},
    adversarialStress: {
      emptyMountStreaming: {},
      characterDataStreaming: {},
      chunkedEnglishIntroArabicBody: {}
    },
    findings: [],
    verdict: 'REQUEST_CHANGES'
  };

  try {
    // -------------------------------------------------------------
    // PART 1: BASELINE AREA 1 (Happy-path streaming token mutation)
    // -------------------------------------------------------------
    console.log('>>> [PART 1] Baseline Area 1: Happy-path Synchronous Streaming...');
    const win1 = new BrowserWindow({
      show: false,
      webPreferences: { contextIsolation: false, nodeIntegration: true }
    });
    await win1.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<!DOCTYPE html><html><body><div id="chat"></div></body></html>'));
    await win1.webContents.insertCSS(RTL_SCOPED_CSS);
    await win1.webContents.executeJavaScript(RTL_OBSERVER_SCRIPT);

    const m1 = await win1.webContents.executeJavaScript(`
      (async () => {
        const chat = document.getElementById('chat');
        let setAttrCount = 0;
        const orig = Element.prototype.setAttribute;
        Element.prototype.setAttribute = function(name, val) {
          if (name === 'dir') setAttrCount++;
          return orig.apply(this, arguments);
        };

        const turn = document.createElement('article');
        turn.setAttribute('data-message-author-role', 'assistant');
        const md = document.createElement('div');
        md.className = 'markdown prose';
        const p = document.createElement('p');
        p.textContent = 'مرحباً بكم في التدفق المتزامن السريع.';
        md.appendChild(p);
        turn.appendChild(md);
        chat.appendChild(turn);

        await new Promise(r => setTimeout(r, 60));
        const csP = window.getComputedStyle(p);
        return {
          mdDir: md.getAttribute('dir'),
          pDir: p.getAttribute('dir'),
          pDirection: csP.direction,
          pTextAlign: csP.textAlign,
          setAttrCount
        };
      })()
    `);
    report.baselineArea1_StreamingHappyPath = m1;
    console.log(`   ✔ Baseline sync streaming: mdDir="${m1.mdDir}", pDirection="${m1.pDirection}", pTextAlign="${m1.pTextAlign}"`);
    win1.destroy();

    // -------------------------------------------------------------
    // PART 2: BASELINE AREA 2 (Side-Browser Session Isolation)
    // -------------------------------------------------------------
    console.log('\n>>> [PART 2] Baseline Area 2: Side-Browser Session Isolation...');
    const sideHostWin = new BrowserWindow({
      show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    const sideBrowserManager = new SideBrowserManager(sideHostWin);
    sideBrowserManager.setLayoutMode('browser-only');
    const sideBrowserTab = sideBrowserManager.createTab(`http://127.0.0.1:${localServerPort}/`, true);
    await new Promise(resolve => sideBrowserTab.view.webContents.on('did-finish-load', resolve));
    await new Promise(r => setTimeout(r, 100));

    const sideMetrics = await sideBrowserTab.view.webContents.executeJavaScript(`
      (() => {
        const md = document.getElementById('side-markdown');
        const p1 = document.getElementById('side-p1');
        const bq = document.getElementById('side-blockquote');
        const ul = document.getElementById('side-ul');
        const th = document.getElementById('side-th');

        return {
          rtlInstalled: window.__chatgptRtlInstalled,
          mdDirAttr: md.getAttribute('dir'),
          p1Direction: window.getComputedStyle(p1).direction,
          bqBorderLeft: window.getComputedStyle(bq).borderLeftWidth,
          bqBorderRight: window.getComputedStyle(bq).borderRightWidth,
          ulDirection: window.getComputedStyle(ul).direction,
          ulPaddingLeft: window.getComputedStyle(ul).paddingLeft,
          thTextAlign: window.getComputedStyle(th).textAlign
        };
      })()
    `);
    report.baselineArea2_SideBrowserIsolation = sideMetrics;
    console.log(`   ✔ Side-browser isolation: rtlInstalled=${sideMetrics.rtlInstalled}, mdDir=${sideMetrics.mdDirAttr}, p1Dir=${sideMetrics.p1Direction}`);
    sideHostWin.destroy();

    // -------------------------------------------------------------
    // PART 3: BASELINE AREA 3 (Tab Lifecycle Resilience)
    // -------------------------------------------------------------
    console.log('\n>>> [PART 3] Baseline Area 3: Tab Lifecycle Resilience...');
    const chatHostWin = new BrowserWindow({
      show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    const tabManager = new TabManager(chatHostWin);
    const tabIds = [];
    for (let i = 0; i < 5; i++) {
      const tab = tabManager.createTab('https://chatgpt.com', false, `tab-${i}`, `Tab ${i}`);
      tabIds.push(tab.id);
    }
    const tSwitchStart = performance.now();
    for (let i = 0; i < 100; i++) {
      tabManager.selectTab(tabIds[i % tabIds.length]);
    }
    const switchDuration = Math.round(performance.now() - tSwitchStart);
    const attachedCount = chatHostWin.contentView.children.length;
    console.log(`   ✔ 100 tab switches completed in ${switchDuration}ms (~${(switchDuration / 100).toFixed(2)}ms/switch), attachedViews=${attachedCount}`);

    // wc.isDestroyed() safety check
    const raceTab = tabManager.createTab('https://chatgpt.com', true, 'race-tab');
    const raceWc = raceTab.view.webContents;
    tabManager.closeTab(raceTab.id);
    let destroyedHandled = false;
    try {
      if (!raceWc.isDestroyed() && typeof raceWc.destroy === 'function') raceWc.destroy();
      if (raceWc.isDestroyed()) {
        const guarded = () => {
          if (raceWc.isDestroyed()) return 'SAFE';
          raceWc.insertCSS(RTL_SCOPED_CSS);
        };
        destroyedHandled = guarded() === 'SAFE';
      }
    } catch (e) {
      destroyedHandled = false;
    }
    console.log(`   ✔ Destroy safety handled: ${destroyedHandled}`);

    // Minimum tab invariant
    for (const t of tabManager.getTabs()) tabManager.closeTab(t.id);
    const finalTabsCount = tabManager.getTabs().length;
    console.log(`   ✔ Minimum tab invariant: count=${finalTabsCount}`);

    report.baselineArea3_TabLifecycleResilience = {
      switchDurationMs: switchDuration,
      attachedCount,
      destroyedHandled,
      finalTabsCount
    };
    chatHostWin.destroy();

    // -------------------------------------------------------------
    // PART 4: ADVERSARIAL STRESS TEST (The 3 Failure Scenarios)
    // -------------------------------------------------------------
    console.log('\n>>> [PART 4] Adversarial Stress Testing: Mutation & Streaming Lifecycle Edge Cases...');

    const stressWin = new BrowserWindow({
      show: false,
      webPreferences: { contextIsolation: false, nodeIntegration: true }
    });
    await stressWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<!DOCTYPE html><html><body><div id="app"></div></body></html>'));
    await stressWin.webContents.insertCSS(RTL_SCOPED_CSS);
    await stressWin.webContents.executeJavaScript(RTL_OBSERVER_SCRIPT);

    const stressResults = await stressWin.webContents.executeJavaScript(`
      (async () => {
        const app = document.getElementById('app');

        // SCENARIO 1: Delayed Streaming into Pre-Mounted Empty Container
        // Simulates real ChatGPT React lifecycle where turn container is rendered before SSE tokens arrive
        const turn1 = document.createElement('article');
        turn1.setAttribute('data-message-author-role', 'assistant');
        const md1 = document.createElement('div');
        md1.className = 'markdown prose';
        const p1 = document.createElement('p');
        p1.id = 'stress-p1';
        md1.appendChild(p1);
        turn1.appendChild(md1);
        app.appendChild(turn1);

        // Network latency / reasoning delay before token 1 arrives (80ms)
        await new Promise(r => setTimeout(r, 80));

        const emptyState = {
          mdChecked: md1.getAttribute('data-rtl-checked'),
          mdDir: md1.getAttribute('dir'),
          p1Dir: p1.getAttribute('dir')
        };

        // Stream 100 Arabic tokens into p1
        const words = ['مرحباً', 'بكم', 'في', 'منظومة', 'الذكاء', 'الاصطناعي', 'هذا', 'نص', 'عربي', 'كامل'];
        for (let i = 0; i < 100; i++) {
          p1.appendChild(document.createTextNode(words[i % words.length] + ' '));
          if (i % 20 === 0) await new Promise(r => setTimeout(r, 0));
        }
        await new Promise(r => setTimeout(r, 60));

        const csP1 = window.getComputedStyle(p1);
        const scenario1 = {
          emptyState,
          postStreamState: {
            mdDir: md1.getAttribute('dir'),
            p1Dir: p1.getAttribute('dir'),
            p1Direction: csP1.direction,
            p1TextAlign: csP1.textAlign
          },
          passed: csP1.direction === 'rtl' && csP1.textAlign === 'right'
        };

        // SCENARIO 2: CharacterData Streaming Mutation
        // Simulates virtual DOM engines updating existing TextNode.data
        const turn2 = document.createElement('article');
        turn2.setAttribute('data-message-author-role', 'assistant');
        const md2 = document.createElement('div');
        md2.className = 'markdown prose';
        const p2 = document.createElement('p');
        p2.id = 'stress-p2';
        const tn = document.createTextNode('');
        p2.appendChild(tn);
        md2.appendChild(p2);
        turn2.appendChild(md2);
        app.appendChild(turn2);

        await new Promise(r => setTimeout(r, 50));
        tn.data = 'هذا النص العربي تم تدفقه عبر تحديث TextNode.data مباشرة.';
        await new Promise(r => setTimeout(r, 60));

        const csP2 = window.getComputedStyle(p2);
        const scenario2 = {
          p2Direction: csP2.direction,
          p2TextAlign: csP2.textAlign,
          passed: csP2.direction === 'rtl' && csP2.textAlign === 'right'
        };

        // SCENARIO 3: Chunked Streaming with English Intro followed by Arabic Body & Lists
        const turn3 = document.createElement('article');
        turn3.setAttribute('data-message-author-role', 'assistant');
        const md3 = document.createElement('div');
        md3.className = 'markdown prose';
        turn3.appendChild(md3);
        app.appendChild(turn3);

        // Chunk 1: English intro
        const pIntro = document.createElement('p');
        pIntro.textContent = 'Here is the detailed Arabic explanation:';
        md3.appendChild(pIntro);
        await new Promise(r => setTimeout(r, 50));

        // Chunk 2: Arabic paragraph
        const pAr = document.createElement('p');
        pAr.textContent = 'تعتبر هذه الميزة من أهم الميزات المطلوبة في التطبيق المكتبي.';
        md3.appendChild(pAr);

        // Chunk 3: Arabic blockquote and list
        const bq = document.createElement('blockquote');
        bq.textContent = 'ملاحظة عربية هامة داخل الاقتباس.';
        md3.appendChild(bq);

        const ul = document.createElement('ul');
        const li = document.createElement('li');
        li.textContent = 'عنصر القائمة العربية الأولى';
        ul.appendChild(li);
        md3.appendChild(ul);
        await new Promise(r => setTimeout(r, 80));

        const csMd3 = window.getComputedStyle(md3);
        const csUl = window.getComputedStyle(ul);
        const csBq = window.getComputedStyle(bq);

        const scenario3 = {
          mdDirAttr: md3.getAttribute('dir'),
          ulDirection: csUl.direction,
          ulPaddingRight: csUl.paddingRight,
          ulPaddingLeft: csUl.paddingLeft,
          bqBorderRight: csBq.borderRightWidth,
          bqBorderLeft: csBq.borderLeftWidth,
          passed: csUl.direction === 'rtl' && csUl.paddingRight === '24px' && csBq.borderRightWidth === '3px'
        };

        return { scenario1, scenario2, scenario3 };
      })()
    `);

    report.adversarialStress = stressResults;
    stressWin.destroy();

    console.log('\n--- ADVERSARIAL STRESS TEST EVALUATION ---');
    console.log(`[Scenario 1 - Pre-Mounted Empty Container Streaming]: ${stressResults.scenario1.passed ? 'PASS' : 'FAIL (CRITICAL BUG)'}`);
    console.log(`  - Initial empty attrs: mdChecked=${stressResults.scenario1.emptyState.mdChecked}, mdDir=${stressResults.scenario1.emptyState.mdDir}, p1Dir=${stressResults.scenario1.emptyState.p1Dir}`);
    console.log(`  - Post-stream attrs: mdDir=${stressResults.scenario1.postStreamState.mdDir}, p1Direction=${stressResults.scenario1.postStreamState.p1Direction}, p1TextAlign=${stressResults.scenario1.postStreamState.p1TextAlign}`);

    console.log(`\n[Scenario 2 - CharacterData Mutation Streaming]: ${stressResults.scenario2.passed ? 'PASS' : 'FAIL (CRITICAL BUG)'}`);
    console.log(`  - Computed p2 direction: ${stressResults.scenario2.p2Direction}, textAlign: ${stressResults.scenario2.p2TextAlign}`);

    console.log(`\n[Scenario 3 - English Intro followed by Arabic Body & List/Blockquote]: ${stressResults.scenario3.passed ? 'PASS' : 'FAIL (CRITICAL BUG)'}`);
    console.log(`  - md dir attribute: "${stressResults.scenario3.mdDirAttr}"`);
    console.log(`  - ul computed direction: "${stressResults.scenario3.ulDirection}", paddingRight: "${stressResults.scenario3.ulPaddingRight}", paddingLeft: "${stressResults.scenario3.ulPaddingLeft}"`);
    console.log(`  - bq borderRightWidth: "${stressResults.scenario3.bqBorderRight}", borderLeftWidth: "${stressResults.scenario3.bqBorderLeft}"`);

    if (!stressResults.scenario1.passed) {
      report.findings.push({
        id: 'DEFECT-M1-01',
        severity: 'CRITICAL',
        title: 'Empty Container Premature Direction Locking',
        description: 'When an assistant message container is mounted before tokens arrive (standard ChatGPT React lifecycle), the MutationObserver marks it as data-rtl-checked="true" and dir="ltr". Subsequent streamed Arabic tokens are ignored and rendered in LTR.'
      });
    }

    if (!stressResults.scenario2.passed) {
      report.findings.push({
        id: 'DEFECT-M1-02',
        severity: 'HIGH',
        title: 'Missing characterData Mutation Observation',
        description: 'MutationObserver observes only { childList: true, subtree: true }, ignoring streaming updates executed via TextNode.data modification.'
      });
    }

    if (!stressResults.scenario3.passed) {
      report.findings.push({
        id: 'DEFECT-M1-03',
        severity: 'CRITICAL',
        title: 'Stale Container Direction Blocks Scoped List and Blockquote RTL Styling',
        description: 'When an assistant turn begins with an English introductory chunk, the markdown container is permanently locked to dir="ltr". Subsequent Arabic lists, blockquotes, and tables do not receive RTL styles because CSS selectors require .markdown[dir="rtl"].'
      });
    }

    report.verdict = report.findings.length > 0 ? 'REQUEST_CHANGES' : 'APPROVE';

    const reportPath = path.join(evidenceDir, 'adversarial_stress_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\n✔ Full adversarial stress report saved to: ${reportPath}`);

    console.log('\n================================================================');
    console.log(`FINAL VERDICT: ${report.verdict}`);
    console.log(`Critical/High Defects Detected: ${report.findings.length}`);
    console.log('================================================================\n');

    clearTimeout(timeoutTimer);
    if (localServer) localServer.close();
    app.exit(report.verdict === 'APPROVE' ? 0 : 2);
  } catch (err) {
    clearTimeout(timeoutTimer);
    if (localServer) localServer.close();
    console.error('FATAL TEST EXCEPTION:', err);
    app.exit(1);
  }
});
