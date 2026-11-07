const http = require('http');

async function main() {
  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const authTarget = targets.find(t => t.url.includes('auth.openai.com'));
  if (!authTarget) {
    console.log('No auth.openai.com target found. Targets are:', targets.map(t => ({ title: t.title, url: t.url })));
    return;
  }

  const ws = new WebSocket(authTarget.webSocketDebuggerUrl);
  let idCounter = 1;

  function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = idCounter++;
      const handler = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.id === id) {
          ws.removeEventListener('message', handler);
          if (data.error) reject(data.error);
          else resolve(data.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onopen = async () => {
    try {
      const evalRes = await sendCommand('Runtime.evaluate', {
        expression: `(() => {
          return {
            title: document.title,
            heading: document.querySelector('h1, h2')?.textContent?.trim(),
            bodyText: document.body?.innerText?.slice(0, 500),
            buttons: Array.from(document.querySelectorAll('button, a')).map(b => b.textContent?.trim()).filter(Boolean)
          };
        })()`,
        returnByValue: true
      });
      console.log('Auth Page State:', JSON.stringify(evalRes.result?.value, null, 2));
      ws.close();
    } catch (e) {
      console.error(e);
      ws.close();
    }
  };
}

main().catch(console.error);
