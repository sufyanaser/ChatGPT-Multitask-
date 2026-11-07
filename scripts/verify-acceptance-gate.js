const http = require('http');

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function createCdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let idCounter = 1;
  const pending = new Map();

  return new Promise((resolve, reject) => {
    ws.onopen = () => {
      resolve({
        send(method, params = {}) {
          return new Promise((res, rej) => {
            const id = idCounter++;
            pending.set(id, { resolve: res, reject: rej });
            ws.send(JSON.stringify({ id, method, params }));
          });
        },
        close() {
          ws.close();
        }
      });
    };

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id && pending.has(data.id)) {
        const { resolve: res, reject: rej } = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) rej(data.error);
        else res(data.result);
      }
    };

    ws.onerror = reject;
  });
}

async function runStep(name, fn) {
  console.log(`\n========================================`);
  console.log(`RUNNING: ${name}`);
  console.log(`========================================`);
  try {
    const res = await fn();
    console.log(`✔ SUCCESS: ${name}`);
    return res;
  } catch (err) {
    console.error(`❌ FAILED: ${name}:`, err);
    throw err;
  }
}

async function main() {
  console.log('--- Connecting to Desktop App CDP ---');
  const targets = await getTargets();
  const chatGptTarget = targets.find(t => t.url.includes('chatgpt.com'));
  const rendererTarget = targets.find(t => t.url.includes('index.html'));

  if (!chatGptTarget || !rendererTarget) {
    throw new Error('Both ChatGPT tab and Renderer window must be active.');
  }

  const chatClient = await createCdpClient(chatGptTarget.webSocketDebuggerUrl);
  const rendererClient = await createCdpClient(rendererTarget.webSocketDebuggerUrl);

  // STEP 6: Sidebar Toggle Test
  await runStep('Test 6: ChatGPT Sidebar Expand and Collapse', async () => {
    // 1. Check current sidebar state
    const beforeState = await chatClient.send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.querySelector('button[aria-label*="sidebar" i], button[data-testid*="sidebar" i], button[aria-label*="Close sidebar" i], button[aria-label*="Open sidebar" i]');
        return {
          exists: !!btn,
          label: btn?.getAttribute('aria-label'),
          navVisible: !!document.querySelector('nav')
        };
      })()`,
      returnByValue: true
    });
    console.log('Sidebar state before toggle:', beforeState.result?.value);

    // 2. Click sidebar toggle button
    const clickRes = await chatClient.send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.querySelector('button[aria-label*="sidebar" i], button[data-testid*="sidebar" i], button[aria-label*="Close sidebar" i], button[aria-label*="Open sidebar" i]');
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      })()`,
      returnByValue: true
    });
    console.log('Clicked toggle button:', clickRes.result?.value);

    // Wait 600ms for CSS transition
    await new Promise(r => setTimeout(r, 600));

    // 3. Check new sidebar state
    const afterState = await chatClient.send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.querySelector('button[aria-label*="sidebar" i], button[data-testid*="sidebar" i], button[aria-label*="Close sidebar" i], button[aria-label*="Open sidebar" i]');
        return {
          exists: !!btn,
          label: btn?.getAttribute('aria-label'),
          navVisible: !!document.querySelector('nav')
        };
      })()`,
      returnByValue: true
    });
    console.log('Sidebar state after toggle:', afterState.result?.value);

    // 4. Toggle it back to restore original state
    await chatClient.send('Runtime.evaluate', {
      expression: `document.querySelector('button[aria-label*="sidebar" i], button[data-testid*="sidebar" i], button[aria-label*="Close sidebar" i], button[aria-label*="Open sidebar" i]')?.click()`
    });
  });

  // STEP 8: Open an existing ChatGPT Project
  await runStep('Test 8: Open an Existing ChatGPT Project', async () => {
    const projectUrl = 'https://chatgpt.com/g/g-p-6ad9d9ed10b081918e61b032d812732e/c/6aef4777-5394-83eb-a732-770d5f29a253';
    console.log(`Navigating to Project: ${projectUrl}`);
    
    await chatClient.send('Page.navigate', { url: projectUrl });
    await new Promise(r => setTimeout(r, 3500));

    const projectState = await chatClient.send('Runtime.evaluate', {
      expression: `(() => {
        return {
          title: document.title,
          url: window.location.href,
          hasHeader: !!document.querySelector('header'),
          hasChatTurns: document.querySelectorAll('[data-message-author-role]').length,
          firstMessagePreview: document.querySelector('[data-message-author-role]')?.textContent?.slice(0, 100) || null
        };
      })()`,
      returnByValue: true
    });
    console.log('Project Page Loaded State:', projectState.result?.value);
  });

  // STEP 7: File Upload & Download Inspection
  await runStep('Test 7: File Upload and Download Capability', async () => {
    const fileUploadState = await chatClient.send('Runtime.evaluate', {
      expression: `(() => {
        const fileInput = document.querySelector('input[type="file"]');
        const attachBtn = document.querySelector('button[aria-label*="attach" i], button[aria-label*="upload" i], button[data-testid*="attach" i]');
        return {
          hasFileInput: !!fileInput,
          fileInputAccept: fileInput?.accept || null,
          hasAttachBtn: !!attachBtn,
          attachBtnLabel: attachBtn?.getAttribute('aria-label') || null
        };
      })()`,
      returnByValue: true
    });
    console.log('File upload DOM readiness:', fileUploadState.result?.value);
  });

  // STEP 9: Chat and Work functionality
  await runStep('Test 9: Chat and Work Functionality Inspection', async () => {
    const workState = await chatClient.send('Runtime.evaluate', {
      expression: `(() => {
        const textarea = document.querySelector('#prompt-textarea, textarea');
        const modelBtn = document.querySelector('button[data-testid*="model-switcher" i], button[aria-label*="ChatGPT" i]');
        const voiceBtn = document.querySelector('button[aria-label*="voice" i], button[data-testid*="voice" i], button[aria-label*="dictate" i]');
        return {
          hasPromptInput: !!textarea,
          promptInputPlaceholder: textarea?.getAttribute('placeholder') || textarea?.getAttribute('aria-label') || null,
          hasModelSwitcher: !!modelBtn,
          modelName: modelBtn?.textContent?.trim() || null,
          hasVoiceOrDictation: !!voiceBtn
        };
      })()`,
      returnByValue: true
    });
    console.log('Chat & Work capabilities:', workState.result?.value);
  });

  chatClient.close();
  rendererClient.close();
  console.log('\nVerification run finished successfully.');
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
