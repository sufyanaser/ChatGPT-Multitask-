const { app, BrowserWindow } = require('electron');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: false, nodeIntegration: true } });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<!DOCTYPE html><html><body><div id="app"></div></body></html>'));

  const prototypeObserver = `
  (function() {
    if (window.__chatgptRtlInstalled) return;
    window.__chatgptRtlInstalled = true;

    const ARABIC_REGEX = /[\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF]/g;
    const LATIN_REGEX = /[A-Za-z]/g;

    function detectDir(text) {
      if (!text || !text.trim()) return null;
      const arCount = (text.match(ARABIC_REGEX) || []).length;
      if (arCount === 0) return 'ltr';
      const enCount = (text.match(LATIN_REGEX) || []).length;
      return (arCount >= enCount * 0.3) ? 'rtl' : 'ltr';
    }

    function applyRtl() {
      const markdowns = document.querySelectorAll('.markdown, [data-message-author-role="assistant"] .prose');
      for (let i = 0; i < markdowns.length; i++) {
        const md = markdowns[i];
        const dir = detectDir(md.textContent);
        if (dir && md.getAttribute('dir') !== dir) {
          md.setAttribute('dir', dir);
        }

        // Check direct block children for mixed-turn resilience
        const blocks = md.querySelectorAll('p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote');
        for (let j = 0; j < blocks.length; j++) {
          const b = blocks[j];
          const bDir = detectDir(b.textContent);
          if (bDir && b.getAttribute('dir') !== bDir) {
            b.setAttribute('dir', bDir);
          }
        }
      }
    }

    applyRtl();
    const observer = new MutationObserver(() => applyRtl());
    const target = document.body || document.documentElement;
    if (target) observer.observe(target, { childList: true, subtree: true, characterData: true });
  })();
  `;

  await win.webContents.executeJavaScript(prototypeObserver);

  const testResults = await win.webContents.executeJavaScript(`
    (async () => {
      const app = document.getElementById('app');

      let mutationCount = 0;
      let setAttrDirCount = 0;
      const origSet = Element.prototype.setAttribute;
      Element.prototype.setAttribute = function(name, val) {
        if (name === 'dir') setAttrDirCount++;
        return origSet.apply(this, arguments);
      };

      // 1. Delayed Empty Mount Test
      const turn1 = document.createElement('article');
      turn1.setAttribute('data-message-author-role', 'assistant');
      const md1 = document.createElement('div');
      md1.className = 'markdown prose';
      const p1 = document.createElement('p');
      md1.appendChild(p1);
      turn1.appendChild(md1);
      app.appendChild(turn1);

      await new Promise(r => setTimeout(r, 60));
      const emptyMdDir = md1.getAttribute('dir');
      const emptyP1Dir = p1.getAttribute('dir');

      // Now stream 500 tokens
      const words = ['مرحباً', 'بكم', 'في', 'التدفق', 'الجديد'];
      for (let i = 0; i < 500; i++) {
        p1.appendChild(document.createTextNode(words[i % words.length] + ' '));
        if (i % 25 === 0) await new Promise(r => setTimeout(r, 0));
      }
      await new Promise(r => setTimeout(r, 60));

      const postStreamMdDir = md1.getAttribute('dir');
      const postStreamP1Dir = p1.getAttribute('dir');

      // 2. CharacterData Test
      const turn2 = document.createElement('article');
      const md2 = document.createElement('div');
      md2.className = 'markdown prose';
      const p2 = document.createElement('p');
      const tn = document.createTextNode('');
      p2.appendChild(tn);
      md2.appendChild(p2);
      turn2.appendChild(md2);
      app.appendChild(turn2);

      await new Promise(r => setTimeout(r, 50));
      tn.data = 'هذا تدفق عبر characterData تم تحديثه.';
      await new Promise(r => setTimeout(r, 60));

      const charDataMdDir = md2.getAttribute('dir');
      const charDataP2Dir = p2.getAttribute('dir');

      // 3. English Intro + Arabic List
      const turn3 = document.createElement('article');
      const md3 = document.createElement('div');
      md3.className = 'markdown prose';
      const pIntro = document.createElement('p');
      pIntro.textContent = 'Here is the summary:';
      md3.appendChild(pIntro);
      turn3.appendChild(md3);
      app.appendChild(turn3);

      await new Promise(r => setTimeout(r, 50));
      const ul = document.createElement('ul');
      const li = document.createElement('li');
      li.textContent = 'نقطة عربية أولى';
      ul.appendChild(li);
      md3.appendChild(ul);
      await new Promise(r => setTimeout(r, 60));

      const introPDir = pIntro.getAttribute('dir');
      const listDir = ul.getAttribute('dir');

      return {
        emptyMdDir,
        emptyP1Dir,
        postStreamMdDir,
        postStreamP1Dir,
        charDataMdDir,
        charDataP2Dir,
        introPDir,
        listDir,
        setAttrDirCount
      };
    })()
  `);

  console.log('PROTOTYPE TEST RESULTS:', JSON.stringify(testResults, null, 2));
  win.destroy();
  app.exit(0);
});
