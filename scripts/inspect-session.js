const http = require('http');

async function main() {
  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const chatGptTarget = targets.find(t => t.url.includes('chatgpt.com'));
  if (!chatGptTarget) {
    console.error('No ChatGPT target found!');
    process.exit(1);
  }

  console.log('Connecting to target:', chatGptTarget.title, chatGptTarget.url);
  const ws = new WebSocket(chatGptTarget.webSocketDebuggerUrl);

  let idCounter = 1;
  const pending = new Map();

  function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = idCounter++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onopen = async () => {
    try {
      // 1. Get cookies
      const cookiesRes = await sendCommand('Network.getCookies', { urls: ['https://chatgpt.com'] });
      const cookies = cookiesRes.cookies || [];
      console.log(`Total cookies found: ${cookies.length}`);
      const cookieNames = cookies.map(c => c.name);
      console.log('Cookie names:', cookieNames);

      const hasAuthCookie = cookieNames.some(name => 
        name.includes('session-token') || 
        name.includes('token') || 
        name.includes('auth') || 
        name.includes('oai-did')
      );
      console.log('Has authentication/session cookies:', hasAuthCookie);

      // 2. Evaluate DOM state
      const evalRes = await sendCommand('Runtime.evaluate', {
        expression: `(() => {
          return {
            title: document.title,
            url: window.location.href,
            hasSidebarToggle: !!document.querySelector('button[aria-label*="sidebar" i], button[data-testid*="sidebar" i], button[aria-label*="Close sidebar" i], button[aria-label*="Open sidebar" i]'),
            sidebarButtonLabel: document.querySelector('button[aria-label*="sidebar" i], button[data-testid*="sidebar" i], button[aria-label*="Close sidebar" i], button[aria-label*="Open sidebar" i]')?.getAttribute('aria-label') || null,
            hasUserMenu: !!document.querySelector('button[data-testid*="user-menu" i], button[aria-label*="Profile" i], img[alt*="User" i], button[data-testid="profile-button"]'),
            hasTextarea: !!document.querySelector('textarea, div[contenteditable="true"]#prompt-textarea'),
            hasFileUpload: !!document.querySelector('input[type="file"], button[aria-label*="attach" i], button[aria-label*="upload" i]'),
            conversationsCount: document.querySelectorAll('a[href*="/c/"]').length,
            conversations: Array.from(document.querySelectorAll('a[href*="/c/"]')).slice(0, 5).map(a => ({
              href: a.href,
              text: a.textContent?.trim()
            })),
            projects: Array.from(document.querySelectorAll('a[href*="/g/"]')).slice(0, 5).map(a => ({
              href: a.href,
              text: a.textContent?.trim()
            }))
          };
        })()`,
        returnByValue: true
      });

      console.log('Page Evaluation Result:');
      console.log(JSON.stringify(evalRes.result?.value, null, 2));

      ws.close();
      process.exit(0);
    } catch (err) {
      console.error('CDP Error:', err);
      ws.close();
      process.exit(1);
    }
  };

  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) {
        reject(data.error);
      } else {
        resolve(data.result);
      }
    }
  };

  ws.onerror = (err) => {
    console.error('WebSocket Error:', err);
    process.exit(1);
  };
}

main().catch(console.error);
