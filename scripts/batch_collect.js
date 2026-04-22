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

(async () => {
  const tabs = await listTabs();
  const tab = tabs.find(t => t.type === 'page' && /app\.sensortower-china\.com/.test(t.url));
  if (!tab) throw new Error('no ST tab');
  const cdp = new CDP(tab.id);
  await cdp.connect();

  for (const g of GAMES) {
    console.log('\n=== Collecting', g.name, '===');
    // 1. Overview
    const overview = await cdp.eval(`(async () => {
      const r = await fetch('/api/unified/apps/${g.uid}', { credentials: 'include' });
      return await r.json();
    })()`);
    console.log('  overview:', overview.name, '| released:', overview.worldwide_release_date);

    // 2. iOS sales (if has iOS sub app)
    const iosSub = (overview.sub_apps || []).filter(a => a.os === 'ios');
    const androidSub = (overview.sub_apps || []).filter(a => a.os === 'android');
    console.log('  iOS:', iosSub.length, 'apps; Android:', androidSub.length, 'apps');

    // 3. Fetch timeseries via sales estimates
    let iosData = null, andData = null;
    if (iosSub.length) {
      iosData = await cdp.eval(`(async () => {
        const r = await fetch('/api/ios/serialized_sales_report_estimates?start_date=2012-01-01&end_date=2026-04-30&date_granularity=monthly&unified_app_ids%5B%5D=${g.uid}', { credentials: 'include' });
        return await r.json();
      })()`);
    }
    if (androidSub.length) {
      andData = await cdp.eval(`(async () => {
        const r = await fetch('/api/android/serialized_sales_report_estimates?start_date=2012-01-01&end_date=2026-04-30&date_granularity=monthly&unified_app_ids%5B%5D=${g.uid}', { credentials: 'include' });
        return await r.json();
      })()`);
    }

    // 4. Save raw
    const raw = { game: g, overview, iosData, andData };
    fs.writeFileSync(path.join(DATA_DIR, `batch_${g.slug}.json`), JSON.stringify(raw, null, 2));
    console.log('  saved batch_' + g.slug + '.json');

    // 5. Quick stats
    const months = new Map(); // 'YYYY-MM' -> { r, d, countries: { cc: { r, d } } }
    function add(rows, isIos) {
      if (!rows) return;
      for (const row of rows) {
        let ts, cc, r, d;
        if (isIos) { [ts, cc, r, d, , ] = row; const [, , , , iap_r, iap_d] = row; r = r + iap_r; d = d + iap_d; }
        else { [ts, cc, r, d] = row; }
        const m = new Date(ts * 1000).toISOString().slice(0, 7);
        if (!months.has(m)) months.set(m, { r:0, d:0, countries: new Map() });
        const mo = months.get(m);
        mo.r += r; mo.d += d;
        if (!mo.countries.has(cc)) mo.countries.set(cc, { r:0, d:0 });
        const co = mo.countries.get(cc);
        co.r += r; co.d += d;
      }
    }
    if (iosData?.serialized_sales_reports?.[1]?.[0]?.[1]) add(iosData.serialized_sales_reports[1][0][1], true);
    if (andData?.serialized_sales_reports?.[1]?.[0]?.[1]) add(andData.serialized_sales_reports[1][0][1], false);
    const sorted = [...months.entries()].sort();
    if (!sorted.length) { console.log('  NO DATA'); continue; }
    console.log('  months range:', sorted[0][0], '→', sorted[sorted.length-1][0], '(', sorted.length, 'months )');
    const totalR = sorted.reduce((a, [, v]) => a + v.r, 0);
    const totalD = sorted.reduce((a, [, v]) => a + v.d, 0);
    console.log(`  total revenue: $${(totalR/100).toLocaleString(undefined,{maximumFractionDigits:0})}, total downloads: ${totalD.toLocaleString()}`);
  }
  cdp.close();
})();
