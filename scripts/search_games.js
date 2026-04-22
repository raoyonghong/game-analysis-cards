// Search Sensor Tower for game names → find their unified_app_id.
// Usage: node search_games.js "Game Name 1" "Game Name 2"
// Requires: Edge running with --remote-debugging-port=9222 and ST logged in.
const { CDP, listTabs } = require('./cdp');
const fs = require('fs');
const path = require('path');

async function openCdp() {
  const tabs = await listTabs();
  const tab = tabs.find(t => t.type === 'page' && /app\.sensortower-china\.com/.test(t.url));
  if (!tab) throw new Error('no ST tab — start Edge with --remote-debugging-port=9222 and log into Sensor Tower');
  const cdp = new CDP(tab.id);
  await cdp.connect();
  return cdp;
}

// Returns { uid, name, publisher, release_date, canonical_country, sub_genre, raw } or null if no match
async function searchOne(name, cdp) {
  const term = encodeURIComponent(name);
  const r = await cdp.eval(`(async () => {
    const res = await fetch('/api/autocomplete_search?entity_type=app&expand_entities=true&flags=false&limit=10&mark_usage_disabled_apps=false&os=unified&term=' + ${JSON.stringify(term)}, { credentials: 'include' });
    return await res.json();
  })()`);
  const top = r?.data?.entities?.[0];
  if (!top) return null;
  return {
    uid: top.app_id,
    name: top.name,
    publisher: top.publisher_name,
    release_date: top.release_date,
    canonical_country: top.canonical_country,
    raw: top,
  };
}

async function runCli() {
  const names = process.argv.slice(2);
  if (!names.length) {
    console.error('Usage: node search_games.js "Game Name 1" "Game Name 2" ...');
    process.exit(1);
  }
  const cdp = await openCdp();
  try {
    const results = {};
    for (const name of names) {
      const hit = await searchOne(name, cdp);
      results[name] = hit;
      console.log('\n===', name, '===');
      if (hit) {
        console.log('  uid:', hit.uid);
        console.log('  name:', hit.name);
        console.log('  publisher:', hit.publisher);
        console.log('  release:', hit.release_date);
      } else {
        console.log('  NO MATCH');
      }
    }
    const DATA = path.join(__dirname, '.data');
    if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });
    fs.writeFileSync(path.join(DATA, 'autocomplete_results.json'), JSON.stringify(results, null, 2));
  } finally {
    cdp.close();
  }
}

module.exports = { searchOne, openCdp };

if (require.main === module) {
  runCli().catch(e => { console.error(e); process.exit(1); });
}
