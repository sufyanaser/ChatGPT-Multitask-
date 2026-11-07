const http = require('http');
const path = require('path');

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
  const pageTarget = targets.find(t => t.url.includes('chatgpt.com/c/'));
  if (!pageTarget) throw new Error('No active conversation tab found');

  const client = await createCdpClient(pageTarget.webSocketDebuggerUrl);
  console.log(`Testing file upload readiness on Tab: ${pageTarget.title}`);

  // Enable DOM
  await client.send('DOM.enable');

  // Query input[type="file"]
  const doc = await client.send('DOM.getDocument');
  const fileInputNode = await client.send('DOM.querySelector', {
    nodeId: doc.root.nodeId,
    selector: 'input[type="file"]'
  });

  console.log('File input nodeId:', fileInputNode.nodeId);

  if (fileInputNode.nodeId !== 0) {
    const filePath = path.resolve(__dirname, '../tests/fixtures/sample-doc.txt');
    console.log(`Setting file to input: ${filePath}`);
    await client.send('DOM.setFileInputFiles', {
      files: [filePath],
      nodeId: fileInputNode.nodeId
    });

    await new Promise(r => setTimeout(r, 1500));

    // Check if attachment pill or file indicator appeared in DOM
    const attachmentCheck = await client.send('Runtime.evaluate', {
      expression: `(() => {
        return {
          fileInputFilesCount: document.querySelector('input[type="file"]')?.files?.length || 0,
          fileName: document.querySelector('input[type="file"]')?.files?.[0]?.name || null,
          hasAttachmentPill: !!document.querySelector('[data-testid*="attachment" i], [aria-label*="sample-doc" i], div:has(> [aria-label*="Remove" i])'),
          composerText: document.querySelector('#prompt-textarea')?.textContent || null
        };
      })()`,
      returnByValue: true
    });

    console.log('Upload Evaluation Result:', attachmentCheck.result?.value);
  } else {
    console.log('No direct input[type="file"] in current DOM view');
  }

  // Test Download: verify download listener in SessionManager
  console.log('\nTesting Download handler configuration:');
  const downloadTest = await client.send('Runtime.evaluate', {
    expression: `(() => {
      // Check if download links or code copy/download elements exist in chat turns
      const downloadButtons = document.querySelectorAll('button[aria-label*="download" i], a[download]');
      return {
        downloadElementsCount: downloadButtons.length,
        hasDownloadAttribute: Array.from(downloadButtons).map(b => b.getAttribute('download') || b.getAttribute('aria-label'))
      };
    })()`,
    returnByValue: true
  });
  console.log('Download elements on page:', downloadTest.result?.value);

  client.close();
}

main().catch(console.error);
