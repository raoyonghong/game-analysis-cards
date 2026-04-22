// Admin server — runs locally at 127.0.0.1:9876.
// Orchestrates add/delete of competitive analysis cards + git commit/push.
// Requires: Edge with --remote-debugging-port=9222 + Sensor Tower logged in.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const META = path.join(ROOT, 'game-meta.json');
const DATA_DIR = path.join(__dirname, '.data');

const PORT = 9876;
const HOST = '127.0.0.1';
const ADMIN_PASSWORD = '180722';

const { searchOne, openCdp: openSearchCdp } = require('./search_games');
const { collectOne } = require('./batch_collect');
const { generateOne } = require('./generate_comp_cards');
const { updateOne, SUBGENRE_MAP } = require('./update_meta');
const { patchOneIcon } = require('./patch_card_icon');
const { patchOneLang } = require('../patch_card_lang');
const { main: refreshIndex } = require('../refresh_index');

const ALLOWED_ORIGINS = [
  'null', // file:// origins report Origin: null
  'http://127.0.0.1:9876',
  'http://localhost:9876',
  'https://boisterous-hotteok-f473bf.netlify.app',
];
function corsHeaders(origin) {
  const allowed = !origin || ALLOWED_ORIGINS.includes(origin) || /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? (origin || '*') : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
  };
}

function json(res, status, obj, origin) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.setEncoding('utf8');
    req.on('data', c => { buf += c; if (buf.length > 4096) { req.destroy(); reject(new Error('body too large')); } });
    req.on('end', () => {
      if (!buf) return resolve({});
      try { resolve(JSON.parse(buf)); } catch (e) { reject(new Error('invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' });
}

// Derive slug from name: keep alphanumerics, TitleCase segments. Fallback to 'Game'.
function deriveSlug(name) {
  const parts = String(name || '').split(/[^A-Za-z0-9]+/).filter(Boolean);
  const s = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  return s || 'Game';
}
function uniqueSlug(baseSlug) {
  let slug = baseSlug, n = 1;
  while (fs.existsSync(path.join(ROOT, `竞品分析_${slug}.html`))) {
    n++;
    slug = `${baseSlug}_${n}`;
  }
  return slug;
}
function deriveBadge(name) {
  const letters = String(name || '').replace(/[^A-Za-z]/g, '');
  return (letters.slice(0, 2) || 'GM').toUpperCase();
}
function deriveTags(overview) {
  const stGenre = overview?.sub_genre?.value;
  const zh = SUBGENRE_MAP[stGenre];
  const tags = [];
  if (zh) tags.push(zh);
  const monetization = overview?.monetization || [];
  if (monetization.some(m => /Free to Play/i.test(m.name))) tags.push('免费游戏');
  if (monetization.some(m => /Subscription/i.test(m.name))) tags.push('订阅');
  if (monetization.some(m => /In-App Purchases/i.test(m.name))) tags.push('内购');
  while (tags.length < 2) tags.push('竞品分析卡片');
  return [...new Set(tags)].slice(0, 5);
}
function deriveSubtitleExtra(overview) {
  const cc = overview?.top_countries?.[0] || overview?.sub_apps?.[0]?.top_countries?.[0];
  if (!cc) return '';
  const MAP = { US: '美国发行', IN: '印度发行', BR: '巴西发行', CN: '中国发行', JP: '日本发行', KR: '韩国发行', RU: '俄罗斯发行', GB: '英国发行', DE: '德国发行', FR: '法国发行', TR: '土耳其发行', CY: '塞浦路斯发行' };
  return MAP[cc] || cc + ' 发行';
}

// Single concurrency lock — mutations are serialized.
let busy = false;
async function withLock(fn) {
  if (busy) throw new Error('another admin operation in progress');
  busy = true;
  try { return await fn(); } finally { busy = false; }
}

async function handleAdd(body) {
  const name = String(body.name || '').trim();
  const url = String(body.url || '').trim();
  if (!name) throw Object.assign(new Error('missing name'), { step: 'validate' });

  // 1. Derive slug
  let slug;
  try {
    slug = uniqueSlug(deriveSlug(name));
  } catch (e) { throw Object.assign(e, { step: 'slug' }); }

  // 2. Open CDP and search
  let cdp, searchHit;
  try {
    cdp = await openSearchCdp();
  } catch (e) { throw Object.assign(e, { step: 'cdp-connect' }); }
  try {
    try {
      searchHit = await searchOne(name, cdp);
    } catch (e) { throw Object.assign(e, { step: 'search' }); }
    if (!searchHit) throw Object.assign(new Error('no Sensor Tower match for: ' + name), { step: 'search' });

    // 3. Collect
    let collectSummary;
    try {
      collectSummary = await collectOne({ name, slug, uid: searchHit.uid }, cdp);
    } catch (e) { throw Object.assign(e, { step: 'collect' }); }

    // 4. Read the fresh raw to derive tags/subtitle
    const rawPath = path.join(DATA_DIR, `batch_${slug}.json`);
    const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
    const tags = deriveTags(raw.overview);
    const subtitleExtra = deriveSubtitleExtra(raw.overview);
    const badge = deriveBadge(name);

    // 5. Generate HTML
    let fileName;
    try {
      ({ fileName } = generateOne({ name, slug, badge, subtitleExtra, tags }));
    } catch (e) { throw Object.assign(e, { step: 'generate' }); }

    // 6. Patch lang toggle
    try { patchOneLang(fileName); }
    catch (e) { throw Object.assign(e, { step: 'patch-lang' }); }

    // 7. Update game-meta.json
    try { updateOne(slug, tags[0]); }
    catch (e) { throw Object.assign(e, { step: 'update-meta' }); }

    // 8. Patch icon
    try { patchOneIcon(fileName); }
    catch (e) { throw Object.assign(e, { step: 'patch-icon' }); }

    // 9. Refresh index
    let indexPayload;
    try { indexPayload = refreshIndex(); }
    catch (e) { throw Object.assign(e, { step: 'refresh-index' }); }

    // 10. Git add/commit/push
    try {
      git('add', '-A');
      git('commit', '-m', `add: ${name}`);
      git('push', 'origin', 'master');
    } catch (e) {
      throw Object.assign(new Error('git failed: ' + (e.stderr || e.message)), { step: 'git-push' });
    }

    const newCard = indexPayload.cards.find(c => c.slug === `竞品分析_${slug}`);
    return { ok: true, slug, card: newCard, total: indexPayload.total, sourceUrl: url || null, uid: searchHit.uid };
  } finally {
    try { cdp && cdp.close(); } catch (_) {}
  }
}

function handleDelete(body) {
  const slugRaw = String(body.slug || '').trim();
  if (!/^竞品分析_[A-Za-z0-9_]+$/.test(slugRaw)) {
    throw Object.assign(new Error('invalid slug: ' + slugRaw), { step: 'validate' });
  }
  const htmlPath = path.join(ROOT, `${slugRaw}.html`);
  const resolved = path.resolve(htmlPath);
  if (!resolved.startsWith(path.resolve(ROOT) + path.sep)) {
    throw Object.assign(new Error('path escape attempt'), { step: 'validate' });
  }
  if (!fs.existsSync(htmlPath)) {
    throw Object.assign(new Error('card file not found: ' + htmlPath), { step: 'delete-html' });
  }

  try { fs.unlinkSync(htmlPath); }
  catch (e) { throw Object.assign(e, { step: 'delete-html' }); }

  try {
    const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
    if (slugRaw in meta) {
      delete meta[slugRaw];
      fs.writeFileSync(META, JSON.stringify(meta, null, 2), 'utf8');
    }
  } catch (e) { throw Object.assign(e, { step: 'delete-meta' }); }

  let indexPayload;
  try { indexPayload = refreshIndex(); }
  catch (e) { throw Object.assign(e, { step: 'refresh-index' }); }

  try {
    git('add', '-A');
    git('commit', '-m', `remove: ${slugRaw}`);
    git('push', 'origin', 'master');
  } catch (e) {
    throw Object.assign(new Error('git failed: ' + (e.stderr || e.message)), { step: 'git-push' });
  }

  return { ok: true, slug: slugRaw, total: indexPayload.total };
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    return res.end();
  }

  const url = req.url || '/';

  if (req.method === 'POST' && url === '/api/ping') {
    return json(res, 200, { ok: true, version: 1 }, origin);
  }

  if (req.method === 'POST' && (url === '/api/add' || url === '/api/delete')) {
    let body;
    try { body = await readBody(req); }
    catch (e) { return json(res, 400, { error: e.message, step: 'parse-body' }, origin); }
    if (body.password !== ADMIN_PASSWORD) {
      return json(res, 403, { error: 'wrong password', step: 'auth' }, origin);
    }
    try {
      const result = await withLock(async () => {
        if (url === '/api/add') return await handleAdd(body);
        return handleDelete(body);
      });
      return json(res, 200, result, origin);
    } catch (e) {
      console.error('[error]', e.step || '?', e.message);
      return json(res, 500, { error: e.message, step: e.step || 'unknown' }, origin);
    }
  }

  return json(res, 404, { error: 'not found' }, origin);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`port ${PORT} already in use — is another admin_server running?`);
    process.exit(1);
  }
  throw e;
});
server.listen(PORT, HOST, () => {
  console.log(`admin server listening on http://${HOST}:${PORT}`);
  console.log(`  repo root: ${ROOT}`);
  console.log('  endpoints: POST /api/ping  POST /api/add  POST /api/delete');
  console.log('  press Ctrl+C to stop');
});
