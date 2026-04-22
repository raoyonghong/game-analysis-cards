// Admin UI overlay — only activates if a local admin_server is reachable.
// Public viewers (Netlify) will silently get no UI (ping fails).
// Password for all actions: 180722 (hardcoded per spec).
(function () {
  'use strict';

  const ADMIN_URL = 'http://127.0.0.1:9876';
  const ADMIN_PASSWORD = '180722';
  const PING_TIMEOUT_MS = 1500;

  async function ping() {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS);
      const res = await fetch(ADMIN_URL + '/api/ping', {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      clearTimeout(timer);
      return res.ok;
    } catch (_) {
      return false;
    }
  }

  function askPassword() {
    let pwd = sessionStorage.getItem('adminPwd');
    if (pwd) return pwd;
    pwd = window.prompt('请输入管理员密码：');
    if (pwd === null) return null;
    if (pwd !== ADMIN_PASSWORD) {
      alert('密码错误');
      return null;
    }
    sessionStorage.setItem('adminPwd', pwd);
    return pwd;
  }

  async function postJson(path, body) {
    const res = await fetch(ADMIN_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      const err = new Error((data && data.error) || ('HTTP ' + res.status));
      err.step = data && data.step;
      throw err;
    }
    return data;
  }

  function buildFab() {
    if (document.getElementById('adminFab')) return;
    const btn = document.createElement('button');
    btn.id = 'adminFab';
    btn.className = 'admin-fab';
    btn.type = 'button';
    btn.title = '新增卡片';
    btn.textContent = '+';
    btn.addEventListener('click', onAddClick);
    document.body.appendChild(btn);
  }

  async function onAddClick() {
    const pwd = askPassword();
    if (!pwd) return;

    const name = window.prompt('请输入游戏名称：');
    if (!name) return;
    const url = window.prompt('请输入游戏数据来源网页链接（可留空）：') || '';

    const fab = document.getElementById('adminFab');
    fab.disabled = true;
    const originalText = fab.textContent;
    fab.textContent = '…';

    try {
      const result = await postJson('/api/add', { password: pwd, name, url });
      alert('已新增：' + (result.card?.title || name) + '\nslug: ' + result.slug + '\n页面将刷新以显示最新数据。');
      location.reload();
    } catch (e) {
      const stepHint = {
        'auth': '密码被服务器拒绝',
        'cdp-connect': '无法连上 Edge 调试端口 — 请用 --remote-debugging-port=9222 启动 Edge 并登录 Sensor Tower',
        'search': 'Sensor Tower 未找到该游戏',
        'collect': 'Sensor Tower 数据采集失败',
        'git-push': 'git push 失败，请检查凭证 / 网络',
      };
      const hint = stepHint[e.step] || '';
      alert('新增失败（阶段 ' + (e.step || 'unknown') + '）：\n' + e.message + (hint ? '\n\n提示：' + hint : ''));
      if (e.step === 'auth') sessionStorage.removeItem('adminPwd');
    } finally {
      fab.disabled = false;
      fab.textContent = originalText;
    }
  }

  function injectDeleteButtons() {
    const cards = document.querySelectorAll('#cardGrid .library-card');
    const indexData = window.__CARDS_INDEX__?.cards || [];
    // Map card DOM order → slug via title; relies on current render order matching sort output.
    // Safer: read the href of open-btn which contains fileName (./竞品分析_Foo.html).
    cards.forEach(cardEl => {
      if (cardEl.querySelector('.admin-delete-btn')) return;
      const openLink = cardEl.querySelector('.open-btn');
      if (!openLink) return;
      const href = openLink.getAttribute('href') || '';
      const m = href.match(/(竞品分析_[A-Za-z0-9_]+)\.html/);
      if (!m) return;
      const slug = m[1];
      const titleEl = cardEl.querySelector('.card-title');
      const title = titleEl ? titleEl.textContent : slug;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'admin-delete-btn';
      btn.title = '删除卡片';
      btn.textContent = '×';
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        onDeleteClick(slug, title);
      });
      cardEl.appendChild(btn);
    });
  }

  async function onDeleteClick(slug, title) {
    const pwd = askPassword();
    if (!pwd) return;
    if (!window.confirm(`确认删除「${title}」？\n该操作会立即从线上卡片库移除并推送到 GitHub。`)) return;
    if (!window.confirm('此操作不可撤销（可从原始数据重新生成）。再次确认删除？')) return;

    try {
      await postJson('/api/delete', { password: pwd, slug });
      alert('已删除：' + title + '\n页面将刷新。');
      location.reload();
    } catch (e) {
      const stepHint = {
        'auth': '密码被服务器拒绝',
        'git-push': 'git push 失败，请检查凭证 / 网络',
      };
      const hint = stepHint[e.step] || '';
      alert('删除失败（阶段 ' + (e.step || 'unknown') + '）：\n' + e.message + (hint ? '\n\n提示：' + hint : ''));
      if (e.step === 'auth') sessionStorage.removeItem('adminPwd');
    }
  }

  function watchGrid() {
    const grid = document.getElementById('cardGrid');
    if (!grid) return;
    injectDeleteButtons();
    const observer = new MutationObserver(() => injectDeleteButtons());
    observer.observe(grid, { childList: true });
  }

  async function init() {
    const ok = await ping();
    if (!ok) return; // public viewer — stay invisible
    window.__ADMIN__ = true;
    buildFab();
    // Grid may render asynchronously after init. Wait for first children or poll briefly.
    const grid = document.getElementById('cardGrid');
    if (!grid) return;
    if (grid.children.length) {
      watchGrid();
    } else {
      const mo = new MutationObserver(() => {
        if (grid.children.length) { mo.disconnect(); watchGrid(); }
      });
      mo.observe(grid, { childList: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
