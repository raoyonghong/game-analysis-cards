// Batch collect data for games from Sensor Tower
// Usage: edit GAMES array below, then `node batch_collect.js`
// Requires: Edge running with --remote-debugging-port=9222 and ST tab logged in.
const { CDP, listTabs } = require('./cdp');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '.data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const GAMES = [
  { name: 'Polygun Arena: Online Shooter',   slug: 'PolygunArena',       uid: '647db77c25186e7cb5c12245' },
  { name: 'Punch TV',                         slug: 'PunchTV',            uid: '683e40fc0530b738d8666064' },
  { name: 'Tomb of the Mask: Old Maze',       slug: 'TombOfTheMaskOldMaze', uid: '56bb108302ac64b0c50000b4' },
  { name: 'Massive Warfare: Tanks PvP War',   slug: 'MassiveWarfare',     uid: '599a90be0211a65db04bd3b8' },
  { name: 'Battle Cars: Nitro PvP Shooter',   slug: 'BattleCars',         uid: '6592061e3d12524c5d5a3cee' },
];

async function openCdp() {
  const tabs = await listTabs();
  const tab = tabs.find(t => t.type === 'page' && /app\.sensortower-china\.com/.test(t.url));
  if (!tab) throw new Error('no ST tab — start Edge with --remote-debugging-port=9222 and log into Sensor Tower');
  const cdp = new CDP(tab.id);
  await cdp.connect();
  return cdp;
}

async function collectOne(game, cdp) {
  // 1. Overview
  const overview = await cdp.eval(`(async () => {
    const r = await fetch('/api/unified/apps/${game.uid}', { credentials: 'include' });
    return await r.json();
  })()`);
  if (!overview || overview.error) throw new Error('ST overview fetch failed: ' + JSON.stringify(overview));

  // 2. iOS / Android sub apps
  const iosSub = (overview.sub_apps || []).filter(a => a.os === 'ios');
  const androidSub = (overview.sub_apps || []).filter(a => a.os === 'android');

  // 3. Fetch timeseries via sales estimates
  let iosData = null, andData = null;
  if (iosSub.length) {
    iosData = await cdp.eval(`(async () => {
      const r = await fetch('/api/ios/serialized_sales_report_estimates?start_date=2012-01-01&end_date=2026-04-30&date_granularity=monthly&unified_app_ids%5B%5D=${game.uid}', { credentials: 'include' });
      return await r.json();
    })()`);
  }
  if (androidSub.length) {
    andData = await cdp.eval(`(async () => {
      const r = await fetch('/api/android/serialized_sales_report_estimates?start_date=2012-01-01&end_date=2026-04-30&date_granularity=monthly&unified_app_ids%5B%5D=${game.uid}', { credentials: 'include' });
      return await r.json();
    })()`);
  }

  // 4. Save raw
  const raw = { game, overview, iosData, andData };
  fs.writeFileSync(path.join(DATA_DIR, `batch_${game.slug}.json`), JSON.stringify(raw, null, 2));

  // 5. Quick stats summary
  const months = new Map();
  function add(rows, isIos) {
    if (!rows) return;
    for (const row of rows) {
      let ts, cc, r, d;
      if (isIos) {
        const [ts0, cc0, r0, d0, iap_r, iap_d] = row;
        ts = ts0; cc = cc0; r = (r0 || 0) + (iap_r || 0); d = (d0 || 0) + (iap_d || 0);
      } else {
        [ts, cc, r, d] = row;
      }
      const m = new Date(ts * 1000).toISOString().slice(0, 7);
      if (!months.has(m)) months.set(m, { r: 0, d: 0 });
      const mo = months.get(m);
      mo.r += r; mo.d += d;
    }
  }
  if (iosData?.serialized_sales_reports?.[1]?.[0]?.[1]) add(iosData.serialized_sales_reports[1][0][1], true);
  if (andData?.serialized_sales_reports?.[1]?.[0]?.[1]) add(andData.serialized_sales_reports[1][0][1], false);

  const sorted = [...months.entries()].sort();
  const totalR = sorted.reduce((a, [, v]) => a + v.r, 0);
  const totalD = sorted.reduce((a, [, v]) => a + v.d, 0);
  return {
    overviewName: overview.name,
    releaseDate: overview.worldwide_release_date,
    iosApps: iosSub.length,
    androidApps: androidSub.length,
    months: sorted.length,
    totalRevenueCents: totalR,
    totalDownloads: totalD,
  };
}

async function runCli() {
  const cdp = await openCdp();
  try {
    for (const g of GAMES) {
      console.log('\n=== Collecting', g.name, '===');
      const s = await collectOne(g, cdp);
      console.log('  overview:', s.overviewName, '| released:', s.releaseDate);
      console.log('  iOS:', s.iosApps, 'apps; Android:', s.androidApps, 'apps');
      console.log('  saved batch_' + g.slug + '.json');
      if (!s.months) { console.log('  NO DATA'); continue; }
      console.log('  months:', s.months);
      console.log(`  total revenue: $${(s.totalRevenueCents/100).toLocaleString(undefined,{maximumFractionDigits:0})}, total downloads: ${s.totalDownloads.toLocaleString()}`);
    }
  } finally {
    cdp.close();
  }
}

module.exports = { collectOne, openCdp };

if (require.main === module) {
  runCli().catch(e => { console.error(e); process.exit(1); });
}
