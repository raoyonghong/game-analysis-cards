// Search Sensor Tower for game names → find their unified_app_id.
// Usage: node search_games.js "Game Name 1" "Game Name 2"
// Requires: Edge running with --remote-debugging-port=9222 and ST logged in.
const { CDP, listTabs } = require('./cdp');
const fs = require('fs');
const path = require('path');

(async () => {
  const names = process.argv.slice(2);
  if (!names.length) {
    console.error('Usage: node search_games.js "Game Name 1" "Game Name 2" ...');
    process.exit(1);
  }
  const tabs = await listTabs();
  const tab = tabs.find(t => t.type === 'page' && /app\.sensortower-china\.com/.test(t.url));
  if (!tab) { console.error('No Sensor Tower tab found in Edge'); process.exit(1); }
  const cdp = new CDP(tab.id);
  await cdp.connect();

  const results = {};
  for (const name of names) {
    const term = encodeURIComponent(name);
    const r = await cdp.eval(`(async () => {
      const res = await fetch('/api/autocomplete_search?entity_type=app&expand_entities=true&flags=false&limit=10&mark_usage_disabled_apps=false&os=unified&term=' + ${JSON.stringify(term)}, { credentials: 'include' });
      return await res.json();
    })()`);
    results[name] = r;
    const top = r?.data?.entities?.[0];
    console.log('\n===', name, '===');
    if (top) {
      console.log('  uid:', top.app_id);
      console.log('  name:', top.name);
      console.log('  publisher:', top.publisher_name);
      console.log('  release:', top.release_date);
    } else {
      console.log('  NO MATCH — candidates:', JSON.stringify(r).slice(0, 300));
    }
  }

  const DATA = path.join(__dirname, '.data');
  if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(path.join(DATA, 'autocomplete_results.json'), JSON.stringify(results, null, 2));
  cdp.close();
})();
