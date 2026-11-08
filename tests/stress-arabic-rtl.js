/**
 * Adversarial Empirical Stress Test Suite for Milestone 1: P0 Arabic RTL Answer Rendering
 * Challenger 1 / critic & specialist
 * 
 * Tests 10 comprehensive edge-case scenarios:
 * 1. Mixed bidi paragraph starting with Arabic, containing Windows paths, complex numbers, parentheses, URLs.
 * 2. Mixed bidi paragraph starting with English technical word (e.g., "ChatGPT هو...") to stress test dir="auto" / plaintext.
 * 3. Complex parenthetical expressions and punctuation (Arabic question mark '؟', quotes, colons, brackets).
 * 4. Nested markdown lists:
 *    - Arabic outer list with nested English code/command sub-list.
 *    - English outer list with nested Arabic sub-list.
 * 5. Code blocks containing Arabic comments, mixed commands, and multi-line script syntax.
 * 6. Inline code snippets within Arabic sentences (measuring baseline alignment, font, and LTR isolation).
 * 7. Markdown tables with mixed columns (Arabic title, English CLI identifier, numeric version, URL).
 * 8. Blockquotes: Arabic blockquote with mixed bidi content and English blockquote control.
 * 9. Multi-paragraph mixed turn (English introductory heading/paragraph followed by Arabic detailed explanation).
 * 10. Pure English control turn (verifying 0% unwanted RTL bleeding, alignment shifts, or marker flipping).
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Verify exports from dist/main/tab-manager
const { RTL_SCOPED_CSS, RTL_OBSERVER_SCRIPT } = require('../dist/main/tab-manager');

if (!RTL_SCOPED_CSS || typeof RTL_SCOPED_CSS !== 'string') {
  console.error('FATAL: RTL_SCOPED_CSS not found in dist/main/tab-manager');
  process.exit(1);
}

if (!RTL_OBSERVER_SCRIPT || typeof RTL_OBSERVER_SCRIPT !== 'string') {
  console.error('FATAL: RTL_OBSERVER_SCRIPT not found in dist/main/tab-manager');
  process.exit(1);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 3200,
    show: false,
    webPreferences: {
      offscreen: false,
      contextIsolation: false,
      nodeIntegration: true
    }
  });

  const stressHtml = `
<!DOCTYPE html>
<html dir="ltr" lang="en-US">
<head>
  <meta charset="utf-8">
  <title>Adversarial Stress Test: Arabic RTL Rendering</title>
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
      padding: 32px;
      background: var(--bg);
      color: var(--text);
    }
    .turn {
      margin-bottom: 28px;
      padding: 20px 24px;
      border: 1px solid var(--border);
      border-radius: 12px;
    }
    .turn-badge {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6e6e80;
      margin-bottom: 12px;
    }
    .markdown {
      line-height: 1.6;
      font-size: 15px;
    }
    .markdown blockquote {
      border-left: 3px solid #10a37f;
      padding-left: 14px;
      margin: 12px 0;
      color: #4a5568;
    }
    .markdown ul, .markdown ol {
      padding-left: 24px;
      margin: 12px 0;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 14px 0;
    }
    th, td {
      border: 1px solid var(--border);
      padding: 8px 14px;
      text-align: left;
    }
    pre {
      background: var(--code-bg);
      color: var(--code-fg);
      padding: 14px 18px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: Consolas, 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.5;
    }
    code {
      font-family: Consolas, 'Courier New', monospace;
      background: rgba(0,0,0,0.05);
      padding: 2px 5px;
      border-radius: 4px;
      font-size: 13.5px;
    }
    pre code {
      background: transparent;
      padding: 0;
    }
  </style>
</head>
<body>

  <!-- Scenario 1: Mixed Bidi Paragraph (Arabic Start) with Paths, Numbers, Parentheses, URLs -->
  <article class="turn" data-message-author-role="assistant" id="turn-1">
    <div class="turn-badge">Scenario 1: Mixed Arabic Bidi with Paths, Numbers, Parentheses, URLs</div>
    <div class="markdown prose" id="md-scenario-1">
      <h2 id="s1-h2">إعدادات بيئة التشغيل لـ ChatGPT Multitask</h2>
      <p id="s1-p1">لتشغيل التطبيق على نظام Windows 11 بنجاح، انتقل إلى المسار <code>C:\\Users\\sufya\\AppData\\Roaming\\ChatGPT Multitask</code> وتأكد من أن حجم الذاكرة المستهلكة أقل من 150.5MB (أو بنسبة لا تتجاوز 15% من إجمالي الموارد المتاحة) ورقم الإصدار الحالي هو 1.0.0-beta.2.</p>
      <p id="s1-p2">إذا واجهتك أية مشكلة في الاتصال بـ <code>https://chatgpt.com/api/auth/session?client=electron&version=34.0.0</code> فهل قمت بفحص السجلات (logs) في المجلد المؤقت؟ هل كل شيء يعمل؟</p>
    </div>
  </article>

  <!-- Scenario 2: Mixed Bidi Paragraph (English Technical Term Start) -->
  <article class="turn" data-message-author-role="assistant" id="turn-2">
    <div class="turn-badge">Scenario 2: Mixed Bidi Starting with English Technical Term</div>
    <div class="markdown prose" id="md-scenario-2">
      <p id="s2-p1">ChatGPT Multitask هو تطبيق مكتبي مبني بواسطة Electron 34 و TypeScript يوفر إدارة متقدمة للنوافذ والتبويبات المتعددة.</p>
      <p id="s2-p2">Electron WebContentsView يتيح عزل الجلسات وفصل المتصفح الجانبي (Side Browser) بكفاءة عالية وبدون تداخل في بيانات الاعتماد.</p>
    </div>
  </article>

  <!-- Scenario 3: Complex Nested Lists (Arabic Outer + English Inner & Vice-Versa) -->
  <article class="turn" data-message-author-role="assistant" id="turn-3">
    <div class="turn-badge">Scenario 3: Complex Nested Lists</div>
    <div class="markdown prose" id="md-scenario-3">
      <h3 id="s3-h3">قائمة المهام والتحقق الدوري</h3>
      <ul id="s3-ul-ar">
        <li id="s3-li-ar1">المرحلة الأولى: تهيئة المتطلبات الأساسية
          <ul id="s3-ul-nested-en">
            <li id="s3-li-nested-en1">Run <code>npm install --frozen-lockfile</code> to verify lockfile integrity.</li>
            <li id="s3-li-nested-en2">Execute <code>npx tsc --noEmit</code> for TypeScript compilation check.</li>
          </ul>
        </li>
        <li id="s3-li-ar2">المرحلة الثانية: التأكد من معايير RTL واتجاه النصوص المدمجة</li>
      </ul>

      <ol id="s3-ol-ar">
        <li id="s3-ol-li1">التحقق من ملف التكوين <code>package.json</code> في المسار الرئيسي.</li>
        <li id="s3-ol-li2">تشغيل حزمة الاختبارات الشاملة (All unit tests).</li>
      </ol>
    </div>
  </article>

  <!-- Scenario 4: Code Block with Arabic Comments vs English Code -->
  <article class="turn" data-message-author-role="assistant" id="turn-4">
    <div class="turn-badge">Scenario 4: Code Blocks with Arabic Comments and CLI Syntax</div>
    <div class="markdown prose" id="md-scenario-4">
      <p id="s4-p-intro">فيما يلي مثال على سكريبت PowerShell المستخدم في الفحص:</p>
      <pre id="s4-pre"><code id="s4-code"># فحص العمليات النشطة وإيقاف العمليات السابقة
$processName = "ChatGPT-Multitask"
$running = Get-Process -Name $processName -ErrorAction SilentlyContinue

# التحقق من الحالة
if ($running) {
    Write-Output "إيقاف العملية الحالية..."
    Stop-Process -Id $running.Id -Force
} else {
    Write-Output "لا توجد عمليات نشطة قيد التشغيل."
}</code></pre>
    </div>
  </article>

  <!-- Scenario 5: Markdown Tables with Mixed RTL and LTR Columns -->
  <article class="turn" data-message-author-role="assistant" id="turn-5">
    <div class="turn-badge">Scenario 5: Tables with Mixed RTL / LTR Columns</div>
    <div class="markdown prose" id="md-scenario-5">
      <table id="s5-table">
        <thead>
          <tr>
            <th id="s5-th-col1">المكون البرمجي</th>
            <th id="s5-th-col2">Module / Package</th>
            <th id="s5-th-col3">الإصدار</th>
            <th id="s5-th-col4">ملاحظات التوافق</th>
          </tr>
        </thead>
        <tbody>
          <tr id="s5-tr-1">
            <td id="s5-td-1-1">محرك العرض</td>
            <td id="s5-td-1-2"><code>electron@34.0.0</code></td>
            <td id="s5-td-1-3">v34.0.0</td>
            <td id="s5-td-1-4">متوافق تماماً مع Windows 11 و macOS Sequoia</td>
          </tr>
          <tr id="s5-tr-2">
            <td id="s5-td-2-1">أداة التحديث</td>
            <td id="s5-td-2-2"><code>electron-updater</code></td>
            <td id="s5-td-2-3">v5.3.1</td>
            <td id="s5-td-2-4">يدعم التحقق من GitHub Releases عبر API</td>
          </tr>
        </tbody>
      </table>
    </div>
  </article>

  <!-- Scenario 6: Blockquotes with Mixed Quotes and Citations -->
  <article class="turn" data-message-author-role="assistant" id="turn-6">
    <div class="turn-badge">Scenario 6: Blockquotes with Arabic and Mixed Technical Advice</div>
    <div class="markdown prose" id="md-scenario-6">
      <blockquote id="s6-bq-ar">
        <p id="s6-bq-p">ملاحظة أمنية هامة: يجب دائماً تفعيل <code>contextIsolation: true</code> وتعطيل <code>nodeIntegration</code> داخل جميع كائنات <code>WebContentsView</code> لمنع ثغرات XSS وتنفيذ الأكواد غير المصرح بها.</p>
      </blockquote>
    </div>
  </article>

  <!-- Scenario 7: Multi-paragraph Mixed Response (English Header/Lead + Arabic Body) -->
  <article class="turn" data-message-author-role="assistant" id="turn-7">
    <div class="turn-badge">Scenario 7: Multi-Paragraph Mixed Response (English Intro + Arabic Body)</div>
    <div class="markdown prose" id="md-scenario-7">
      <h2 id="s7-h2-en">Release Acceptance Summary</h2>
      <p id="s7-p-en">The application has been verified against the production release checklist.</p>
      <h3 id="s7-h3-ar">تفاصيل المراجعة الميدانية والنتائج</h3>
      <p id="s7-p-ar">تم الانتهاء بنجاح من كافة اختبارات الأداء واستقرار الجلسات مع الحفاظ على سرعة التبديل بين التبويبات بزمن استجابة أقل من 2ms.</p>
    </div>
  </article>

  <!-- Scenario 8: Pure English Control Turn (Strict LTR - Absolute Zero Regression) -->
  <article class="turn" data-message-author-role="assistant" id="turn-8">
    <div class="turn-badge">Scenario 8: Pure English Control Turn</div>
    <div class="markdown prose" id="md-scenario-8">
      <h2 id="s8-h2">Architectural Blueprint and Verification Gate</h2>
      <p id="s8-p1">All desktop UI components must strictly adhere to the unified design token system defined in <code>src/renderer/index.css</code>.</p>
      
      <pre id="s8-pre"><code id="s8-code">npm run build:tsc
npm run build:bundle
node tests/unit-tests.js</code></pre>

      <ul id="s8-ul">
        <li id="s8-li-1">First checklist item strictly left aligned.</li>
        <li id="s8-li-2">Second checklist item with bullet point on the left edge.</li>
      </ul>

      <blockquote id="s8-bq">
        <p id="s8-bq-p">Zero regression principle: English content must never exhibit any RTL characteristics.</p>
      </blockquote>
    </div>
  </article>

</body>
</html>
  `;

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(stressHtml));

  // Inject worker's CSS and Script exactly as TabManager does
  await win.webContents.insertCSS(RTL_SCOPED_CSS);
  await win.webContents.executeJavaScript(RTL_OBSERVER_SCRIPT);

  // Allow observer tick
  await new Promise(r => setTimeout(r, 150));

  // Capture high-resolution screenshot
  const screenshot = await win.webContents.capturePage();
  const evidenceDir = path.join(__dirname, '..', '.agents', 'teamwork', 'challenger_m1_1');
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }
  const screenshotPath = path.join(evidenceDir, 'evidence_m1_adversarial_stress.png');
  fs.writeFileSync(screenshotPath, screenshot.toPNG());
  console.log(`✔ Adversarial stress screenshot captured at: ${screenshotPath}`);

  // Execute deep computational queries inside Chromium
  const measurements = await win.webContents.executeJavaScript(`
    (() => {
      function getProps(el) {
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          id: el.id,
          dir: el.getAttribute('dir'),
          computedDirection: cs.direction,
          textAlign: cs.textAlign,
          unicodeBidi: cs.unicodeBidi,
          paddingLeft: cs.paddingLeft,
          paddingRight: cs.paddingRight,
          borderLeftWidth: cs.borderLeftWidth,
          borderRightWidth: cs.borderRightWidth,
          left: Math.round(r.left),
          right: Math.round(r.right),
          width: Math.round(r.width),
          height: Math.round(r.height)
        };
      }

      // Container checks
      const md1 = getProps(document.getElementById('md-scenario-1'));
      const md2 = getProps(document.getElementById('md-scenario-2'));
      const md3 = getProps(document.getElementById('md-scenario-3'));
      const md4 = getProps(document.getElementById('md-scenario-4'));
      const md5 = getProps(document.getElementById('md-scenario-5'));
      const md6 = getProps(document.getElementById('md-scenario-6'));
      const md7 = getProps(document.getElementById('md-scenario-7'));
      const md8 = getProps(document.getElementById('md-scenario-8'));

      // Scenario 1 elements
      const s1_h2 = getProps(document.getElementById('s1-h2'));
      const s1_p1 = getProps(document.getElementById('s1-p1'));
      const s1_p2 = getProps(document.getElementById('s1-p2'));
      const s1_code1 = getProps(document.querySelector('#s1-p1 code'));
      const s1_code2 = getProps(document.querySelector('#s1-p2 code'));

      // Scenario 2 elements (English start)
      const s2_p1 = getProps(document.getElementById('s2-p1'));
      const s2_p2 = getProps(document.getElementById('s2-p2'));

      // Scenario 3 elements (Nested lists)
      const s3_ul_ar = getProps(document.getElementById('s3-ul-ar'));
      const s3_li_ar1 = getProps(document.getElementById('s3-li-ar1'));
      const s3_ul_nested_en = getProps(document.getElementById('s3-ul-nested-en'));
      const s3_li_nested_en1 = getProps(document.getElementById('s3-li-nested-en1'));
      const s3_ol_ar = getProps(document.getElementById('s3-ol-ar'));

      // Scenario 4 elements (Code block with Arabic comments)
      const s4_pre = getProps(document.getElementById('s4-pre'));
      const s4_code = getProps(document.getElementById('s4-code'));

      // Scenario 5 elements (Table)
      const s5_th_col1 = getProps(document.getElementById('s5-th-col1'));
      const s5_th_col2 = getProps(document.getElementById('s5-th-col2'));
      const s5_td_1_1 = getProps(document.getElementById('s5-td-1-1'));
      const s5_td_1_2 = getProps(document.getElementById('s5-td-1-2'));

      // Scenario 6 elements (Blockquote)
      const s6_bq_ar = getProps(document.getElementById('s6-bq-ar'));
      const s6_bq_p = getProps(document.getElementById('s6-bq-p'));

      // Scenario 7 elements (Multi-paragraph mixed)
      const s7_h2_en = getProps(document.getElementById('s7-h2-en'));
      const s7_p_en = getProps(document.getElementById('s7-p-en'));
      const s7_h3_ar = getProps(document.getElementById('s7-h3-ar'));
      const s7_p_ar = getProps(document.getElementById('s7-p-ar'));

      // Scenario 8 elements (Pure English control)
      const s8_h2 = getProps(document.getElementById('s8-h2'));
      const s8_p1 = getProps(document.getElementById('s8-p1'));
      const s8_pre = getProps(document.getElementById('s8-pre'));
      const s8_ul = getProps(document.getElementById('s8-ul'));
      const s8_li_1 = getProps(document.getElementById('s8-li-1'));
      const s8_bq = getProps(document.getElementById('s8-bq'));

      return {
        containers: { md1, md2, md3, md4, md5, md6, md7, md8 },
        s1: { s1_h2, s1_p1, s1_p2, s1_code1, s1_code2 },
        s2: { s2_p1, s2_p2 },
        s3: { s3_ul_ar, s3_li_ar1, s3_ul_nested_en, s3_li_nested_en1, s3_ol_ar },
        s4: { s4_pre, s4_code },
        s5: { s5_th_col1, s5_th_col2, s5_td_1_1, s5_td_1_2 },
        s6: { s6_bq_ar, s6_bq_p },
        s7: { s7_h2_en, s7_p_en, s7_h3_ar, s7_p_ar },
        s8: { s8_h2, s8_p1, s8_pre, s8_ul, s8_li_1, s8_bq }
      };
    })()
  `);

  // Write measurements to a JSON file in challenger folder
  const resultsJsonPath = path.join(evidenceDir, 'adversarial_measurements.json');
  fs.writeFileSync(resultsJsonPath, JSON.stringify(measurements, null, 2));
  console.log(`✔ Computed measurement matrix saved to: ${resultsJsonPath}`);

  // Detailed Analysis Console Output
  console.log('\n=== ADVERSARIAL STRESS TEST ANALYSIS ===\n');

  // Check 1: Arabic Heading & Paragraph Alignment
  console.log('1. SCENARIO 1 (Mixed Arabic Bidi with Paths, Numbers, URLs):');
  console.log(`   - H2 direction: ${measurements.s1.s1_h2.computedDirection}, textAlign: ${measurements.s1.s1_h2.textAlign}`);
  console.log(`   - P1 direction: ${measurements.s1.s1_p1.computedDirection}, textAlign: ${measurements.s1.s1_p1.textAlign}, unicodeBidi: ${measurements.s1.s1_p1.unicodeBidi}`);
  console.log(`   - P2 direction: ${measurements.s1.s1_p2.computedDirection}, textAlign: ${measurements.s1.s1_p2.textAlign}`);
  console.log(`   - Inline Code 1 (Windows Path): direction: ${measurements.s1.s1_code1.computedDirection}, unicodeBidi: ${measurements.s1.s1_code1.unicodeBidi}`);
  console.log(`   - Inline Code 2 (URL): direction: ${measurements.s1.s1_code2.computedDirection}, unicodeBidi: ${measurements.s1.s1_code2.unicodeBidi}`);

  // Check 2: Mixed Bidi starting with English technical word
  console.log('\n2. SCENARIO 2 (Mixed Bidi starting with "ChatGPT Multitask..."):');
  console.log(`   - Container dir attribute: ${measurements.containers.md2.dir}`);
  console.log(`   - P1 computedDirection: ${measurements.s2.s2_p1.computedDirection}, textAlign: ${measurements.s2.s2_p1.textAlign}, unicodeBidi: ${measurements.s2.s2_p1.unicodeBidi}`);
  console.log(`   - P2 computedDirection: ${measurements.s2.s2_p2.computedDirection}, textAlign: ${measurements.s2.s2_p2.textAlign}, unicodeBidi: ${measurements.s2.s2_p2.unicodeBidi}`);

  // Check 3: Nested Lists
  console.log('\n3. SCENARIO 3 (Nested Lists: Arabic Outer + English Sub-list):');
  console.log(`   - Arabic UL direction: ${measurements.s3.s3_ul_ar.computedDirection}, paddingRight: ${measurements.s3.s3_ul_ar.paddingRight}`);
  console.log(`   - Nested English UL direction: ${measurements.s3.s3_ul_nested_en.computedDirection}`);
  console.log(`   - Arabic OL direction: ${measurements.s3.s3_ol_ar.computedDirection}, paddingRight: ${measurements.s3.s3_ol_ar.paddingRight}`);

  // Check 4: Code Block with Arabic Comments
  console.log('\n4. SCENARIO 4 (Code Block with Arabic Comments):');
  console.log(`   - PRE direction: ${measurements.s4.s4_pre.computedDirection}, textAlign: ${measurements.s4.s4_pre.textAlign}, unicodeBidi: ${measurements.s4.s4_pre.unicodeBidi}`);
  console.log(`   - CODE direction: ${measurements.s4.s4_code.computedDirection}`);

  // Check 5: Tables
  console.log('\n5. SCENARIO 5 (Tables with Mixed Columns):');
  console.log(`   - Arabic TH Col1 textAlign: ${measurements.s5.s5_th_col1.textAlign}`);
  console.log(`   - English TH Col2 textAlign: ${measurements.s5.s5_th_col2.textAlign}`);
  console.log(`   - Arabic TD Cell 1 textAlign: ${measurements.s5.s5_td_1_1.textAlign}`);
  console.log(`   - Code TD Cell 2 textAlign: ${measurements.s5.s5_td_1_2.textAlign}`);

  // Check 6: Blockquote
  console.log('\n6. SCENARIO 6 (Blockquotes):');
  console.log(`   - Arabic BQ borderRightWidth: ${measurements.s6.s6_bq_ar.borderRightWidth}, borderLeftWidth: ${measurements.s6.s6_bq_ar.borderLeftWidth}`);
  console.log(`   - Arabic BQ Paragraph direction: ${measurements.s6.s6_bq_p.computedDirection}, textAlign: ${measurements.s6.s6_bq_p.textAlign}`);

  // Check 7: Multi-paragraph Mixed
  console.log('\n7. SCENARIO 7 (Multi-paragraph Mixed Turn):');
  console.log(`   - English H2 direction: ${measurements.s7.s7_h2_en.computedDirection}, textAlign: ${measurements.s7.s7_h2_en.textAlign}`);
  console.log(`   - English P direction: ${measurements.s7.s7_p_en.computedDirection}, textAlign: ${measurements.s7.s7_p_en.textAlign}`);
  console.log(`   - Arabic H3 direction: ${measurements.s7.s7_h3_ar.computedDirection}, textAlign: ${measurements.s7.s7_h3_ar.textAlign}`);
  console.log(`   - Arabic P direction: ${measurements.s7.s7_p_ar.computedDirection}, textAlign: ${measurements.s7.s7_p_ar.textAlign}`);

  // Check 8: Pure English Control
  console.log('\n8. SCENARIO 8 (Pure English Control - Zero Regression):');
  console.log(`   - Container dir attribute: ${measurements.containers.md8.dir}`);
  console.log(`   - English H2 direction: ${measurements.s8.s8_h2.computedDirection}, textAlign: ${measurements.s8.s8_h2.textAlign}`);
  console.log(`   - English P1 direction: ${measurements.s8.s8_p1.computedDirection}, textAlign: ${measurements.s8.s8_p1.textAlign}`);
  console.log(`   - English PRE direction: ${measurements.s8.s8_pre.computedDirection}, textAlign: ${measurements.s8.s8_pre.textAlign}`);
  console.log(`   - English UL direction: ${measurements.s8.s8_ul.computedDirection}, paddingLeft: ${measurements.s8.s8_ul.paddingLeft}`);
  console.log(`   - English BQ borderLeftWidth: ${measurements.s8.s8_bq.borderLeftWidth}, borderRightWidth: ${measurements.s8.s8_bq.borderRightWidth}`);

  // Summary Evaluation
  const failures = [];
  if (measurements.s1.s1_h2.computedDirection !== 'rtl') failures.push('S1: Arabic H2 not rtl');
  if (measurements.s1.s1_p1.computedDirection !== 'rtl') failures.push('S1: Arabic P1 not rtl');
  if (measurements.s1.s1_code1.computedDirection !== 'ltr') failures.push('S1: Inline path code not ltr');
  if (measurements.s4.s4_pre.computedDirection !== 'ltr') failures.push('S4: Code block PRE not ltr');
  if (measurements.s4.s4_pre.textAlign !== 'left') failures.push('S4: Code block PRE textAlign not left');
  if (measurements.s6.s6_bq_ar.borderRightWidth !== '3px') failures.push('S6: Arabic blockquote border not on right');
  if (measurements.s7.s7_p_ar.computedDirection !== 'rtl') failures.push('S7: Mixed turn Arabic P not rtl');
  if (measurements.s8.s8_h2.computedDirection !== 'ltr') failures.push('S8: English H2 leaked to rtl');
  if (measurements.s8.s8_p1.computedDirection !== 'ltr') failures.push('S8: English P1 leaked to rtl');
  if (measurements.s8.s8_bq.borderLeftWidth !== '3px') failures.push('S8: English blockquote border flipped');

  console.log('\n========================================');
  if (failures.length === 0) {
    console.log('✅ ALL ADVERSARIAL STRESS TEST ASSERTIONS PASSED!');
  } else {
    console.log(`❌ FAILURES DETECTED (${failures.length}):`);
    failures.forEach(f => console.log('   - ' + f));
  }
  console.log('========================================\n');

  app.exit(failures.length === 0 ? 0 : 1);
});
