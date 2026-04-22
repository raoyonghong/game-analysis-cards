// Minimal CDP client over websocket
const WebSocket = require('ws');

class CDP {
  constructor(tabId, port = 9222) {
    this.tabId = tabId;
    this.port = port;
    this.id = 0;
    this.pending = new Map();
    this.listeners = [];
    this.sock = null;
  }
  async connect() {
    this.sock = new WebSocket(`ws://127.0.0.1:${this.port}/devtools/page/${this.tabId}`, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
    this.sock.on('message', (m) => {
      const msg = JSON.parse(m.toString());
      if (msg.id && this.pending.has(msg.id)) {
        this.pending.get(msg.id)(msg);
        this.pending.delete(msg.id);
      } else if (msg.method) {
        for (const l of this.listeners) l(msg);
      }
    });
    await new Promise((resolve, reject) => {
      this.sock.once('open', resolve);
      this.sock.once('error', reject);
    });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const mid = ++this.id;
      this.pending.set(mid, (msg) => {
        if (msg.error) reject(new Error(`${method}: ${JSON.stringify(msg.error)}`));
        else resolve(msg.result);
      });
      this.sock.send(JSON.stringify({ id: mid, method, params }));
    });
  }
  on(fn) { this.listeners.push(fn); }
  async eval(js, awaitPromise = true) {
    const r = await this.send('Runtime.evaluate', {
      expression: js,
      awaitPromise,
      returnByValue: true
    });
    if (r.exceptionDetails) {
      const e = r.exceptionDetails;
      throw new Error('JS eval error: ' + (e.exception?.description || e.text));
    }
    return r.result?.value;
  }
  close() { this.sock && this.sock.close(); }
}

async function listTabs(port = 9222) {
  const http = require('http');
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: '/json/list' }, (r) => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

module.exports = { CDP, listTabs };
