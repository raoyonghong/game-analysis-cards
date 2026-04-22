// Extract icon URLs, sub-genre etc from batch_<slug>.json and merge into game-meta.json
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '.data');
const META = path.join(__dirname, '..', 'game-meta.json');

const GAMES = [
  { slug: 'PolygunArena',       genreZh: '第三人称射击' },
  { slug: 'PunchTV',            genreZh: '休闲街机' },
  { slug: 'TombOfTheMaskOldMaze', genreZh: '平台跑酷' },
  { slug: 'MassiveWarfare',     genreZh: '车辆射击' },
  { slug: 'BattleCars',         genreZh: '车辆射击' },
];

// Map ST English sub_genre → Chinese
const SUBGENRE_MAP = {
  'Vehicular Shooter': '车辆射击',
  'Platformer': '平台跑酷',
  'Third-Person Shooter': '第三人称射击',
  'First-Person Shooter': 'FPS',
  'Arcade': '休闲街机',
  'Other Arcade': '其他街机',
  'Sniper': '狙击手',
  'Puzzle Match': '交换消除',
  'Merge': '三合',
  'Idle': '放置',
};

function humanNumber(n) {
  if (n == null) return null;
  return Math.round(n).toLocaleString('en-US');
}
function moneyNumber(cents) {
  if (cents == null) return null;
  return '$' + Math.round(cents / 100).toLocaleString('en-US');
}
function buildMonthly(raw) {
  const iosRows = raw.iosData?.serialized_sales_reports?.[1]?.[0]?.[1];
  const andRows = raw.andData?.serialized_sales_reports?.[1]?.[0]?.[1];
  let totalDL = 0, totalRV = 0;
  if (iosRows) for (const [, , r, d, iap_r, iap_d] of iosRows) { totalRV += (r || 0) + (iap_r || 0); totalDL += (d || 0) + (iap_d || 0); }
  if (andRows) for (const [, , r, d] of andRows) { totalRV += r || 0; totalDL += d || 0; }
  return { totalDL, totalRV };
}

// Update game-meta.json for one slug. Returns the entry written.
function updateOne(slug, fallbackGenre) {
  const rawPath = path.join(DATA_DIR, `batch_${slug}.json`);
  const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  const overview = raw.overview;
  const iconUrl = overview.icon_url || (overview.sub_apps?.[0]?.icon_url) || null;
  const stGenre = overview.sub_genre?.value;
  const genre = SUBGENRE_MAP[stGenre] || fallbackGenre || '竞品分析卡片';
  const { totalDL, totalRV } = buildMonthly(raw);
  const entry = {
    iconUrl,
    genre,
    totalDownloads: humanNumber(totalDL),
    totalRevenue: moneyNumber(totalRV),
  };
  const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
  const key = '竞品分析_' + slug;
  meta[key] = entry;
  fs.writeFileSync(META, JSON.stringify(meta, null, 2), 'utf8');
  return { key, entry };
}

function runCli() {
  for (const g of GAMES) {
    const { key, entry } = updateOne(g.slug, g.genreZh);
    console.log(key, '→ genre=', entry.genre, '| dl=', entry.totalDownloads, '| rv=', entry.totalRevenue);
  }
  console.log('\ngame-meta.json updated');
}

module.exports = { updateOne, SUBGENRE_MAP };

if (require.main === module) runCli();
