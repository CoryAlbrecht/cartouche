const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = '/home/cory/.gemini/antigravity-cli/brain/a8d6a366-b669-4303-a097-c38278c9e36c';

function getWsUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const list = JSON.parse(data);
          const page = list.find((p) => p.type === 'page');
          if (page && page.webSocketDebuggerUrl) {
            resolve(page.webSocketDebuggerUrl);
          } else {
            reject(new Error('No page found in CDP'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

class CdpClient {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 1;
    this.callbacks = new Map();
    this.ws.onmessage = (msg) => {
      const res = JSON.parse(msg.data);
      if (res.id && this.callbacks.has(res.id)) {
        const { resolve, reject } = this.callbacks.get(res.id);
        this.callbacks.delete(res.id);
        if (res.error) reject(res.error);
        else resolve(res.result);
      }
    };
  }

  waitOpen() {
    return new Promise((resolve) => {
      if (this.ws.readyState === 1) resolve();
      else this.ws.onopen = () => resolve();
    });
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: `(() => { ${expr} })()`,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : null;
  }

  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(res.data, 'base64');
    const fullPath = path.join(ARTIFACTS_DIR, filename);
    fs.writeFileSync(fullPath, buf);
    console.log('Saved screenshot:', fullPath);
  }

  close() {
    this.ws.close();
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const wsUrl = await getWsUrl();
  console.log('Connecting to', wsUrl);
  const client = new CdpClient(wsUrl);
  await client.waitOpen();

  // 1. Open Project Menu
  await client.eval(`
    const el = document.querySelectorAll('.menu-dropdown-trigger')[0];
    if (el) el.click();
  `);
  await sleep(200);
  await client.captureScreenshot('cartouche_menu_project.png');

  // 2. Open Edit Menu
  await client.eval(`
    const el = document.querySelectorAll('.menu-dropdown-trigger')[1];
    if (el) el.click();
  `);
  await sleep(200);
  await client.captureScreenshot('cartouche_menu_edit.png');

  // 3. Open View Menu & Hover/Click Panels Submenu
  await client.eval(`
    const el = document.querySelectorAll('.menu-dropdown-trigger')[2];
    if (el) el.click();
  `);
  await sleep(200);
  await client.eval(`
    const panelsTrigger = Array.from(document.querySelectorAll('.menu-submenu-trigger')).find(e => e.textContent.includes('Panels'));
    if (panelsTrigger) panelsTrigger.click();
  `);
  await sleep(200);
  await client.captureScreenshot('cartouche_menu_view_panels.png');

  // 4. Open View Menu & Hover/Click Toolbars Submenu
  await client.eval(`
    const toolbarsTrigger = Array.from(document.querySelectorAll('.menu-submenu-trigger')).find(e => e.textContent.includes('Toolbars'));
    if (toolbarsTrigger) toolbarsTrigger.click();
  `);
  await sleep(200);
  await client.captureScreenshot('cartouche_menu_view_toolbars.png');

  // 5. Open Layers Menu & Add Submenu
  await client.eval(`
    const el = document.querySelectorAll('.menu-dropdown-trigger')[3];
    if (el) el.click();
  `);
  await sleep(200);
  await client.eval(`
    const addTrigger = Array.from(document.querySelectorAll('.menu-submenu-trigger')).find(e => e.textContent.includes('Add'));
    if (addTrigger) addTrigger.click();
  `);
  await sleep(200);
  await client.captureScreenshot('cartouche_menu_layers_add.png');

  // 6. Right click on empty portion of toolbar panel
  await client.eval(`
    document.body.click();
  `);
  await sleep(150);
  await client.eval(`
    const topToolbar = document.querySelector('.toolbar-panel-top');
    if (topToolbar) {
      const evt = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 320,
        clientY: 48
      });
      topToolbar.dispatchEvent(evt);
    }
  `);
  await sleep(250);
  await client.captureScreenshot('cartouche_toolbar_context_menu.png');

  // 7. Enable Digitizing and Snapping Toolbars from context menu
  await client.eval(`
    const items = Array.from(document.querySelectorAll('.context-menu-item'));
    const dig = items.find(e => e.textContent.includes('Digitizing'));
    if (dig) dig.click();
  `);
  await sleep(200);
  await client.eval(`
    const topToolbar = document.querySelector('.toolbar-panel-top');
    if (topToolbar) {
      const evt = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 320,
        clientY: 48
      });
      topToolbar.dispatchEvent(evt);
    }
  `);
  await sleep(200);
  await client.eval(`
    const items = Array.from(document.querySelectorAll('.context-menu-item'));
    const snap = items.find(e => e.textContent.includes('Snapping'));
    if (snap) snap.click();
  `);
  await sleep(300);
  await client.captureScreenshot('cartouche_all_toolbars_enabled.png');

  // 8. Click Help -> About
  await client.eval(`
    const el = document.querySelectorAll('.menu-dropdown-trigger')[4];
    if (el) el.click();
  `);
  await sleep(200);
  await client.eval(`
    const about = Array.from(document.querySelectorAll('.menu-dropdown-item')).find(e => e.textContent.includes('About'));
    if (about) about.click();
  `);
  await sleep(300);
  await client.captureScreenshot('cartouche_about_dialog.png');

  client.close();
  console.log('Verification completed successfully!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
