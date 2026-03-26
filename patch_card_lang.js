/**
 * 批量给每张竞品分析卡片注入中/EN 语言切换按钮和翻译逻辑
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// ── 所有需要翻译的文本映射 ────────────────────────────────────────────────────
const ZH_TO_EN = {
  // section labels
  '维度一 · 基础概览': 'Overview',
  '维度二 · 近30天核心指标': 'KPIs · Last 30 Days',
  '维度三 · 上线至今月度趋势': 'Monthly Trend',
  '维度四 · 上线至今 Top 5 国家表现': 'Top 5 Countries (All-time)',
  '数据分析洞察': 'Insights',
  // item labels
  '全球上线时间': 'Global Launch',
  '上线至今总下载': 'Total Downloads',
  '上线至今总收入': 'Total Revenue',
  '数据来源：Sensor Tower': 'Source: Sensor Tower',
  '全球 · 所有时间': 'Global · All-time',
  '全球 · 近30天': 'Global · 30d',
  '下载量': 'Downloads',
  '收入': 'Revenue',
  '平均DAU': 'Avg DAU',
  '月度下载量趋势': 'Monthly Downloads',
  '月度收入趋势': 'Monthly Revenue',
  // table headers
  '国家': 'Country',
  '下载占比': 'DL Share',
  '净收入': 'Net Revenue',
  '净收入占比': 'Rev Share',
  // insight titles
  '市场集中度': 'Market Concentration',
  '变现效率': 'Monetization',
  '区域结构': 'Regional Mix',
  '趋势判断': 'Trend',
};

const LANG_BUTTON_CSS = `
/* ── lang toggle ── */
.lang-toggle-wrap { position: fixed; top: 16px; right: 16px; z-index: 999; }
.lang-toggle-btn { background: rgba(30,30,60,0.82); color: #fff; border: 1.5px solid rgba(255,255,255,0.3); border-radius: 10px; padding: 7px 14px; font-size: 13px; font-weight: 700; cursor: pointer; backdrop-filter: blur(6px); }
.lang-toggle-btn:hover { background: rgba(30,30,60,0.95); }
`;

// build translation map as JS object literal
const mapStr = JSON.stringify(ZH_TO_EN, null, 2);

const LANG_SCRIPT = `
<script id="card-i18n">
(function(){
  const ZH_EN = ${mapStr};
  // reverse map
  const EN_ZH = {};
  for(const [k,v] of Object.entries(ZH_EN)) EN_ZH[v]=k;

  let lang = 'zh';

  // elements to translate: text nodes that exactly match a key
  function translateNode(map){
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    const targets = [];
    let node;
    while((node = walker.nextNode())){
      const txt = node.textContent.trim();
      if(map[txt]) targets.push({node, val: map[txt]});
    }
    targets.forEach(({node, val}) => { node.textContent = node.textContent.replace(node.textContent.trim(), val); });
    // also handle placeholder subtitles
    document.querySelectorAll('.item-sub, .kpi-sub, .section-label, .section-title, .chart-title, .item-label, .kpi-label, .insight-card h4').forEach(el=>{
      const txt = el.textContent.trim();
      if(map[txt]) el.textContent = map[txt];
    });
  }

  const btn = document.getElementById('langToggleBtn');
  btn.addEventListener('click', function(){
    lang = lang==='zh'?'en':'zh';
    btn.textContent = lang==='zh'?'EN':'中文';
    document.documentElement.lang = lang==='zh'?'zh-CN':'en';
    translateNode(lang==='en'?ZH_EN:EN_ZH);
  });
})();
<\/script>
`;

const LANG_BUTTON_HTML = `
<div class="lang-toggle-wrap">
  <button id="langToggleBtn" class="lang-toggle-btn">EN</button>
</div>
`;

let patched = 0;

fs.readdirSync(ROOT)
  .filter(f => /^竞品分析_.*\.html$/i.test(f))
  .forEach(fileName => {
    const fp = path.join(ROOT, fileName);
    let html = fs.readFileSync(fp, 'utf8');

    // skip if already patched
    if (html.includes('card-i18n')) {
      console.log('already patched:', fileName);
      return;
    }

    // inject CSS before </style>
    html = html.replace('</style>', LANG_BUTTON_CSS + '\n</style>');

    // inject button after <body> (or after <div class="card">)
    html = html.replace('<body>', '<body>' + LANG_BUTTON_HTML);

    // inject script before </body>
    html = html.replace('</body>', LANG_SCRIPT + '\n</body>');

    fs.writeFileSync(fp, html, 'utf8');
    patched++;
    console.log('patched:', fileName);
  });

console.log(`\ndone — ${patched} files patched`);
