// Inject real app icons into 竞品分析_*.html card headers.
// Reads iconUrl from ../game-meta.json and replaces <div class="app-badge">XX</div>
// with <img class="app-badge-img" src=...>. Idempotent — safe to re-run.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const META = path.join(ROOT, 'game-meta.json');

const ICON_CSS = `
/* ── app icon (image) ── */
.app-badge-img { width: 72px; height: 72px; border-radius: 16px; object-fit: cover; background: #fff; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
`;

// Patch one card HTML file to swap text badge for an <img> icon.
// Returns 'patched' | 'already' | 'no-meta' | 'no-match'.
function patchOneIcon(fileName) {
  const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
  const slug = fileName.replace(/\.html$/, '');
  const entry = meta[slug];
  const iconUrl = entry && typeof entry === 'object' ? entry.iconUrl : (typeof entry === 'string' ? entry : null);

  const fp = path.join(ROOT, fileName);
  let html = fs.readFileSync(fp, 'utf8');

  if (!iconUrl) return 'no-meta';
  if (html.includes('class="app-badge-img"')) return 'already';

  const before = html;
  html = html.replace(
    /<div class="app-badge">[\s\S]*?<\/div>/,
    `<img class="app-badge-img" src="${iconUrl}" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;app-badge&quot;>'+this.alt+'</div>'">`
  );
  if (html === before) return 'no-match';

  if (!html.includes('.app-badge-img')) {
    html = html.replace('</style>', ICON_CSS + '\n</style>');
  }
  fs.writeFileSync(fp, html, 'utf8');
  return 'patched';
}

function runCli() {
  let patched = 0, skipped = 0, noMeta = 0, noMatch = 0;
  fs.readdirSync(ROOT)
    .filter(f => /^竞品分析_.*\.html$/.test(f))
    .forEach(fileName => {
      const result = patchOneIcon(fileName);
      if (result === 'patched') { patched++; console.log('patched:', fileName); }
      else if (result === 'already') { skipped++; console.log('already has icon:', fileName); }
      else if (result === 'no-meta') { noMeta++; console.log('NO META iconUrl:', fileName); }
      else if (result === 'no-match') { noMatch++; console.log('NO MATCH app-badge in:', fileName); }
    });
  console.log(`\ndone — ${patched} patched, ${skipped} already patched, ${noMeta} missing meta, ${noMatch} no-match`);
}

module.exports = { patchOneIcon };

if (require.main === module) runCli();
