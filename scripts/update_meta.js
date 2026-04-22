// Extract icon URLs, sub-genre etc from batch_<slug>.json and merge into game-meta.json
const fs = require('fs');
const path = require('path');

const TEMP = path.join(__dirname, '.data');
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

const meta = JSON.parse(fs.readFileSync(META, 'utf8'));

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
  if (iosRows) for (const [, , r, d, iap_r, iap_d] of iosRows) { totalRV += (r||0)+(iap_r||0); totalDL += (d||0)+(iap_d||0); }
  if (andRows) for (const [, , r, d] of andRows) { totalRV += r||0; totalDL += d||0; }
  return { totalDL, totalRV };
}

for (const g of GAMES) {
  const rawPath = path.join(TEMP, `batch_${g.slug}.json`);
  const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  const overview = raw.overview;
  const iconUrl = overview.icon_url || (overview.sub_apps?.[0]?.icon_url) || null;
  const stGenre = overview.sub_genre?.value;
  const genre = SUBGENRE_MAP[stGenre] || g.genreZh || '竞品分析卡片';

  const { totalDL, totalRV } = buildMonthly(raw);

  const key = '竞品分析_' + g.slug;
  meta[key] = {
    iconUrl,
    genre,
    totalDownloads: humanNumber(totalDL),
    totalRevenue: moneyNumber(totalRV),
  };
  console.log(key, '→ genre=', genre, '| dl=', meta[key].totalDownloads, '| rv=', meta[key].totalRevenue);
}

fs.writeFileSync(META, JSON.stringify(meta, null, 2), 'utf8');
console.log('\ngame-meta.json updated');
