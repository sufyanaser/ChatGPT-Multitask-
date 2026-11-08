/**
 * Automated Empirical Verification Suite for Milestone 1: P0 Arabic RTL Answer Rendering
 * Verifies that RTL_SCOPED_CSS and RTL_OBSERVER_SCRIPT exported from dist/main/tab-manager.js
 * correctly render Arabic, mixed bidirectional text, lists, tables, blockquotes,
 * while strictly isolating code blocks, URLs, file paths, and preserving English responses.
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Verify that tab-manager exports the constants
const { RTL_SCOPED_CSS, RTL_OBSERVER_SCRIPT } = require('../dist/main/tab-manager');

if (!RTL_SCOPED_CSS || typeof RTL_SCOPED_CSS !== 'string') {
  console.error('FAIL: RTL_SCOPED_CSS is not exported or not a string');
  process.exit(1);
}

if (!RTL_OBSERVER_SCRIPT || typeof RTL_OBSERVER_SCRIPT !== 'string') {
  console.error('FAIL: RTL_OBSERVER_SCRIPT is not exported or not a string');
  process.exit(1);
}

console.log('✔ RTL_SCOPED_CSS and RTL_OBSERVER_SCRIPT successfully imported from dist/main/tab-manager.js');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 2400,
    show: false,
    webPreferences: {
      offscreen: false,
      contextIsolation: false,
      nodeIntegration: true
    }
  });

  // Base test page simulating upstream chatgpt.com DOM (HTML dir="ltr")
  const baseHtml = `
<!DOCTYPE html>
<html dir="ltr" lang="en-US">
<head>
  <meta charset="utf-8">
  <title>P0 Arabic RTL Empirical Verification</title>
  <style>
    :root {
      --bg: #ffffff;
      --text: #0d0d0d;
      --border: #e5e5e5;
      --code-bg: #1e1e1e;
      --code-fg: #d4d4d4;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px;
      background: var(--bg);
      color: var(--text);
    }
    .conversation-turn {
      margin-bottom: 24px;
      padding: 16px 20px;
      border: 1px solid var(--border);
      border-radius: 12px;
    }
    .role-badge {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #6e6e80;
      margin-bottom: 8px;
    }
    /* Upstream Tailwind baseline styling */
    .markdown {
      line-height: 1.6;
    }
    .markdown blockquote {
      border-left: 3px solid #10a37f;
      padding-left: 14px;
      margin: 12px 0;
      color: #6b7280;
    }
    .markdown ul, .markdown ol {
      padding-left: 24px;
      margin: 12px 0;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 12px 0;
    }
    th, td {
      border: 1px solid var(--border);
      padding: 8px 12px;
      text-align: left;
    }
    pre {
      background: var(--code-bg);
      color: var(--code-fg);
      padding: 12px 16px;
      border-radius: 8px;
      overflow-x: auto;
    }
    code {
      font-family: Consolas, monospace;
    }
  </style>
</head>
<body>

  <!-- Turn 1: Arabic Assistant Turn with Technical Terms, CLI, Code Block, Lists, Blockquote, Table -->
  <article class="conversation-turn" data-testid="turn-arabic" data-message-author-role="assistant">
    <div class="role-badge">Assistant (Arabic Response with Mixed English & Code)</div>
    <div class="markdown prose" id="ar-markdown">
      <h1 id="ar-h1">دليل تشغيل وصيانة ChatGPT Multitask</h1>
      <p id="ar-p1">مرحباً بك! يمكنك إدارة المشروع في المسار <code>G:\\PROJECTS\\3- ChatGPT-Multitask</code> وتشغيل أدوات التطوير بكل سهولة.</p>
      
      <p id="ar-p-bidi">يدعم النظام أوامر PowerShell المتقدمة، ويوفر رابطاً سريعاً إلى <code>https://chatgpt.com</code> مع الحفاظ على الأداء العالي.</p>

      <pre id="ar-pre"><code id="ar-pre-code"># تشغيل اختبارات التحقق من صحة واجهة المستخدم
npm run typecheck
node tests/unit-tests.js
Get-Process -Name "*electron*" | Stop-Process</code></pre>

      <p id="ar-p-list-intro">يرجى اتباع الخطوات التالية:</p>
      <ul id="ar-ul">
        <li id="ar-li-1">تأكد من تنصيب جميع التبعيات بنجاح.</li>
        <li id="ar-li-2">تحقق من أن مسارات CLI تعمل بنمط LTR دون أي تشويه.</li>
      </ul>

      <ol id="ar-ol">
        <li id="ar-ol-1">الخطوة الأولى: فحص السجلات.</li>
        <li id="ar-ol-2">الخطوة الثانية: بناء الحزمة لنظامي Windows و macOS.</li>
      </ol>

      <blockquote id="ar-blockquote">
        تنبيه: يجب المحافظة على جميع معايير الأمان وعزل الجلسات وفق أفضل الممارسات البرمجية.
      </blockquote>

      <table id="ar-table">
        <thead>
          <tr><th id="ar-th">المعيار</th><th>الحالة</th><th>التفاصيل</th></tr>
        </thead>
        <tbody>
          <tr><td id="ar-td">دعم RTL</td><td>ناجح</td><td>محاذاة كاملة إلى اليمين</td></tr>
        </tbody>
      </table>
    </div>
  </article>

  <!-- Turn 2: English Assistant Turn (Control - Zero Regression) -->
  <article class="conversation-turn" data-testid="turn-english" data-message-author-role="assistant">
    <div class="role-badge">Assistant (English Control Turn)</div>
    <div class="markdown prose" id="en-markdown">
      <h1 id="en-h1">System Maintenance and Diagnostics</h1>
      <p id="en-p1">This is an English control message to verify that English assistant messages remain strictly left-aligned.</p>
      
      <pre id="en-pre"><code id="en-pre-code">git status --short
npm run lint</code></pre>

      <ul id="en-ul">
        <li id="en-li-1">English list item 1 remains aligned to the left.</li>
        <li id="en-li-2">English list item 2 markers anchor on the left.</li>
      </ul>

      <blockquote id="en-blockquote">
        Note: The layout engine must never force RTL on English content.
      </blockquote>

      <table id="en-table">
        <thead>
          <tr><th id="en-th">Property</th><th>Status</th></tr>
        </thead>
        <tbody>
          <tr><td id="en-td">Alignment</td><td>Left-to-Right</td></tr>
        </tbody>
      </table>
    </div>
  </article>

  <!-- Container for Dynamic Streaming Test -->
  <div id="dynamic-container"></div>

</body>
</html>
  `;

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(baseHtml));

  // Step 1: Inject RTL Scoped CSS (equivalent to wc.insertCSS)
  await win.webContents.insertCSS(RTL_SCOPED_CSS);

  // Step 2: Inject RTL Observer Script (equivalent to wc.executeJavaScript)
  await win.webContents.executeJavaScript(RTL_OBSERVER_SCRIPT);

  // Step 3: Simulate dynamic streaming by appending a new element after observer is installed
  await win.webContents.executeJavaScript(`
    (() => {
      const container = document.getElementById('dynamic-container');
      const article = document.createElement('article');
      article.className = 'conversation-turn';
      article.setAttribute('data-message-author-role', 'assistant');
      article.innerHTML = \`
        <div class="role-badge">Assistant (Dynamically Streamed Turn)</div>
        <div class="markdown prose" id="streamed-markdown">
          <p id="streamed-p">تم استلام هذا الرد بشكل ديناميكي لمحاكاة الـ Streaming في ChatGPT.</p>
          <pre id="streamed-pre"><code>dir $env:USERPROFILE</code></pre>
        </div>
      \`;
      container.appendChild(article);
    })()
  `);

  // Wait a tick for MutationObserver to process
  await new Promise(r => setTimeout(r, 100));

  // Capture screenshot as empirical evidence
  const screenshot = await win.webContents.capturePage();
  const evidenceDir = path.join(__dirname, '..', '.agents', 'teamwork', 'worker_m1_rtl');
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }
  const screenshotPath = path.join(evidenceDir, 'evidence_m1_rtl_verification.png');
  fs.writeFileSync(screenshotPath, screenshot.toPNG());
  console.log(`✔ Empirical visual screenshot captured at: ${screenshotPath}`);

  // Query computed styles and bounding rectangles
  const results = await win.webContents.executeJavaScript(`
    (() => {
      const arMd = document.getElementById('ar-markdown');
      const enMd = document.getElementById('en-markdown');
      const streamedMd = document.getElementById('streamed-markdown');

      const arH1 = document.getElementById('ar-h1');
      const arP1 = document.getElementById('ar-p1');
      const arPre = document.getElementById('ar-pre');
      const arPreCode = document.getElementById('ar-pre-code');
      const arCodeInline = arP1.querySelector('code');
      const arUl = document.getElementById('ar-ul');
      const arOl = document.getElementById('ar-ol');
      const arLi = document.getElementById('ar-li-1');
      const arBlockquote = document.getElementById('ar-blockquote');
      const arTh = document.getElementById('ar-th');
      const arTd = document.getElementById('ar-td');

      const enH1 = document.getElementById('en-h1');
      const enP1 = document.getElementById('en-p1');
      const enPre = document.getElementById('en-pre');
      const enUl = document.getElementById('en-ul');
      const enBlockquote = document.getElementById('en-blockquote');
      const enTh = document.getElementById('en-th');

      const streamedP = document.getElementById('streamed-p');
      const streamedPre = document.getElementById('streamed-pre');

      const winWidth = window.innerWidth;
      const arP1Rect = arP1.getBoundingClientRect();
      const enP1Rect = enP1.getBoundingClientRect();
      const arPreRect = arPre.getBoundingClientRect();

      return {
        // Semantic dir attributes applied by observer
        arMd_dir: arMd.getAttribute('dir'),
        enMd_dir: enMd.getAttribute('dir'),
        streamedMd_dir: streamedMd.getAttribute('dir'),

        // Arabic turn direction & alignment
        arH1_direction: window.getComputedStyle(arH1).direction,
        arH1_textAlign: window.getComputedStyle(arH1).textAlign,
        arP1_direction: window.getComputedStyle(arP1).direction,
        arP1_textAlign: window.getComputedStyle(arP1).textAlign,
        arP1_unicodeBidi: window.getComputedStyle(arP1).unicodeBidi,

        // Bounding geometry (Arabic text should reach right side)
        arP1_right: arP1Rect.right,
        arP1_width: arP1Rect.width,

        // Code block strict LTR preservation
        arPre_direction: window.getComputedStyle(arPre).direction,
        arPre_textAlign: window.getComputedStyle(arPre).textAlign,
        arPre_unicodeBidi: window.getComputedStyle(arPre).unicodeBidi,
        arPreCode_direction: window.getComputedStyle(arPreCode).direction,
        arCodeInline_direction: window.getComputedStyle(arCodeInline).direction,
        arCodeInline_unicodeBidi: window.getComputedStyle(arCodeInline).unicodeBidi,

        // List styling
        arUl_direction: window.getComputedStyle(arUl).direction,
        arUl_paddingRight: window.getComputedStyle(arUl).paddingRight,
        arOl_direction: window.getComputedStyle(arOl).direction,
        arOl_paddingRight: window.getComputedStyle(arOl).paddingRight,

        // Blockquote styling (border on right)
        arBq_borderRightWidth: window.getComputedStyle(arBlockquote).borderRightWidth,
        arBq_borderLeftWidth: window.getComputedStyle(arBlockquote).borderLeftWidth,

        // Table styling
        arTh_textAlign: window.getComputedStyle(arTh).textAlign,
        arTd_textAlign: window.getComputedStyle(arTd).textAlign,

        // English control turn (zero regression)
        enH1_direction: window.getComputedStyle(enH1).direction,
        enH1_textAlign: window.getComputedStyle(enH1).textAlign,
        enP1_direction: window.getComputedStyle(enP1).direction,
        enP1_textAlign: window.getComputedStyle(enP1).textAlign,
        enPre_direction: window.getComputedStyle(enPre).direction,
        enPre_textAlign: window.getComputedStyle(enPre).textAlign,
        enUl_direction: window.getComputedStyle(enUl).direction,
        enBq_borderLeftWidth: window.getComputedStyle(enBlockquote).borderLeftWidth,
        enTh_textAlign: window.getComputedStyle(enTh).textAlign,

        // Streamed dynamic turn
        streamedP_direction: window.getComputedStyle(streamedP).direction,
        streamedP_textAlign: window.getComputedStyle(streamedP).textAlign,
        streamedPre_direction: window.getComputedStyle(streamedPre).direction
      };
    })()
  `);

  console.log('\n--- COMPUTED MEASUREMENT MATRIX ---');
  console.log(JSON.stringify(results, null, 2));

  // Perform strict assertions
  const assertions = [
    { name: 'Arabic container dir="rtl"', pass: results.arMd_dir === 'rtl' },
    { name: 'English container dir="ltr"', pass: results.enMd_dir === 'ltr' },
    { name: 'Streamed container dir="rtl"', pass: results.streamedMd_dir === 'rtl' },

    { name: 'Arabic H1 direction is rtl', pass: results.arH1_direction === 'rtl' },
    { name: 'Arabic H1 textAlign is right', pass: results.arH1_textAlign === 'right' },
    { name: 'Arabic P1 direction is rtl', pass: results.arP1_direction === 'rtl' },
    { name: 'Arabic P1 unicode-bidi is isolate', pass: results.arP1_unicodeBidi === 'isolate' },

    { name: 'Arabic Pre direction is strictly ltr', pass: results.arPre_direction === 'ltr' },
    { name: 'Arabic Pre textAlign is left', pass: results.arPre_textAlign === 'left' },
    { name: 'Arabic Pre unicode-bidi is isolate', pass: results.arPre_unicodeBidi === 'isolate' },
    { name: 'Arabic Inline Code direction is ltr', pass: results.arCodeInline_direction === 'ltr' },
    { name: 'Arabic Inline Code unicode-bidi is isolate', pass: results.arCodeInline_unicodeBidi === 'isolate' },

    { name: 'Arabic UL direction is rtl', pass: results.arUl_direction === 'rtl' },
    { name: 'Arabic UL padding-right is 24px', pass: results.arUl_paddingRight === '24px' },
    { name: 'Arabic OL direction is rtl', pass: results.arOl_direction === 'rtl' },
    { name: 'Arabic OL padding-right is 24px', pass: results.arOl_paddingRight === '24px' },

    { name: 'Arabic Blockquote right border is 3px', pass: results.arBq_borderRightWidth === '3px' },
    { name: 'Arabic Blockquote left border is 0px', pass: results.arBq_borderLeftWidth === '0px' },

    { name: 'Arabic Table TH text-align is right', pass: results.arTh_textAlign === 'right' },
    { name: 'Arabic Table TD text-align is right', pass: results.arTd_textAlign === 'right' },

    { name: 'English H1 direction is ltr', pass: results.enH1_direction === 'ltr' },
    { name: 'English P1 direction is ltr', pass: results.enP1_direction === 'ltr' },
    { name: 'English Pre direction is ltr', pass: results.enPre_direction === 'ltr' },
    { name: 'English Pre textAlign is left', pass: results.enPre_textAlign === 'left' },
    { name: 'English UL direction is ltr', pass: results.enUl_direction === 'ltr' },
    { name: 'English Blockquote left border is 3px', pass: results.enBq_borderLeftWidth === '3px' },
    { name: 'English Table TH text-align is left', pass: results.enTh_textAlign === 'left' },

    { name: 'Streamed dynamic P direction is rtl', pass: results.streamedP_direction === 'rtl' },
    { name: 'Streamed dynamic Pre direction is ltr', pass: results.streamedPre_direction === 'ltr' }
  ];

  console.log('\n--- DETAILED ASSERTION CHECKS ---');
  let allPassed = true;
  for (const a of assertions) {
    if (a.pass) {
      console.log(`  ✔ [PASS] ${a.name}`);
    } else {
      console.error(`  ✖ [FAIL] ${a.name}`);
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log('\n🎉 ALL P0 ARABIC RTL ACCEPTANCE ASSERTIONS PASSED WITH 100% SUCCESS!\n');
    app.exit(0);
  } else {
    console.error('\n❌ SOME ASSERTIONS FAILED. SEE DETAILS ABOVE.\n');
    app.exit(1);
  }
});
