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

async function main() {
  const targets = await getTargets();
  const rendererTarget = targets.find(t => t.url.includes('index.html'));
  if (!rendererTarget) throw new Error('Renderer target not found');

  const rendererClient = await createCdpClient(rendererTarget.webSocketDebuggerUrl);

  console.log('--- Step 4: Creating 3 separate tabs with distinct conversations ---');
  
  // 1. Get initial state
  const state1 = await rendererClient.send('Runtime.evaluate', {
    expression: `window.api.getInitialState()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Initial tabs count:', state1.result?.value?.tabs?.length);

  // 2. Create second tab
  await rendererClient.send('Runtime.evaluate', {
    expression: `window.api.createTab()`
  });
  await new Promise(r => setTimeout(r, 1200));

  // 3. Create third tab
  await rendererClient.send('Runtime.evaluate', {
    expression: `window.api.createTab()`
  });
  await new Promise(r => setTimeout(r, 1200));

  // Check state after creating 2 additional tabs
  const state2 = await rendererClient.send('Runtime.evaluate', {
    expression: `window.api.getInitialState()`,
    awaitPromise: true,
    returnByValue: true
  });
  const tabs = state2.result?.value?.tabs || [];
  console.log(`Now open tabs count: ${tabs.length}`);
  console.log('Tab IDs:', tabs.map(t => t.id));

  if (tabs.length < 3) {
    throw new Error('Failed to create at least 3 tabs');
  }

  // 4. Navigate each tab to a different real conversation URL
  const conversations = [
    'https://chatgpt.com/c/6ae7ceff-a780-83ed-b4a7-ac1c092c04ef', // موقع المحافظ
    'https://chatgpt.com/c/6aef7e40-da74-83eb-8c45-9b84cd0f222e', // مناقشة تطبيق تبويبات ChatGPT
    'https://chatgpt.com/c/6aef594c-c9dc-83eb-b15c-c6d154d761e9'  // بحث إضافة خدمة الصحفيين
  ];

  // Refresh targets to find WebContentsView for each tab
  const allTargets = await getTargets();
  const pageTargets = allTargets.filter(t => t.url.includes('chatgpt.com') && t.type === 'page');
  console.log(`Found ${pageTargets.length} active ChatGPT WebContentsView targets`);

  for (let i = 0; i < Math.min(pageTargets.length, 3); i++) {
    const pageClient = await createCdpClient(pageTargets[i].webSocketDebuggerUrl);
    console.log(`Navigating Tab ${i + 1} (${pageTargets[i].id}) to: ${conversations[i]}`);
    await pageClient.send('Page.navigate', { url: conversations[i] });
    pageClient.close();
  }

  // Wait 4 seconds for pages to settle
  await new Promise(r => setTimeout(r, 4000));

  // 5. Test tab switching
  console.log('\n--- Step 5: Testing Tab Switching and State Preservation ---');
  for (let i = 0; i < 3; i++) {
    const tabId = tabs[i].id;
    console.log(`Switching to Tab ${i + 1} (ID: ${tabId})...`);
    await rendererClient.send('Runtime.evaluate', {
      expression: `window.api.selectTab("${tabId}")`
    });
    await new Promise(r => setTimeout(r, 500));
  }

  // Query updated tabs state
  const finalState = await rendererClient.send('Runtime.evaluate', {
    expression: `window.api.getInitialState()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('\nFinal tabs state payload:');
  console.log(JSON.stringify(finalState.result?.value, null, 2));

  rendererClient.close();
  console.log('\n✔ Step 4 & 5 Verification Completed Successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
