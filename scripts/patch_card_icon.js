// Inject real app icons into 竞品分析_*.html card headers.
// Reads iconUrl from ../game-meta.json and replaces <div class="app-badge">XX</div>
// with <img class="app-badge-img" src=...>. Idempotent — safe to re-run.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const META = path.join(ROOT, 'game-meta.json');

const meta = JSON.parse(fs.readFileSync(META, 'utf8'));

const ICON_CSS = `
/* ── app icon (image) ── */
.app-badge-img { width: 72px; height: 72px; border-radius: 16px; object-fit: cover; background: #fff; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
`;

let patched = 0, skipped = 0, noMeta = 0;

fs.readdirSync(ROOT)
  .filter(f => /^竞品分析_.*\.html$/.test(f))
  .forEach(fileName => {
    const slug = fileName.replace(/\.html$/, '');
    const key = slug;
    const entry = meta[key];
    const iconUrl = entry && typeof entry === 'object' ? entry.iconUrl : (typeof entry === 'string' ? entry : null);

    const fp = path.join(ROOT, fileName);
    let html = fs.readFileSync(fp, 'utf8');

    // Skip if no icon available in meta
    if (!iconUrl) {
      console.log('NO META iconUrl:', fileName);
      noMeta++;
      return;
    }

    // Skip if already patched
    if (html.includes('class="app-badge-img"')) {
      console.log('already has icon:', fileName);
      skipped++;
      return;
    }

    // Replace <div class="app-badge">XX</div> with <img>
    const before = html;
    html = html.replace(
      /<div class="app-badge">[\s\S]*?<\/div>/,
      `<img class="app-badge-img" src="${iconUrl}" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;app-badge&quot;>'+this.alt+'</div>'">`
    );
    if (html === before) {
      console.log('NO MATCH app-badge in:', fileName);
      return;
    }

    // Inject CSS before </style>
    if (!html.includes('.app-badge-img')) {
      html = html.replace('</style>', ICON_CSS + '\n</style>');
    }

    fs.writeFileSync(fp, html, 'utf8');
    patched++;
    console.log('patched:', fileName);
  });

console.log(`\ndone — ${patched} patched, ${skipped} already patched, ${noMeta} missing meta`);
