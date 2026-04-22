// Generate HTML cards from batch_<slug>.json files
const fs = require('fs');
const path = require('path');

const TEMP = path.join(__dirname, '.data');
const OUT = path.join(__dirname, '..');

const GAMES = [
  { name: 'Polygun Arena: Online Shooter', slug: 'PolygunArena', badge: 'PA', subtitleExtra: '土耳其发行', tags: ['动作射击', '3D 写实', '多人PvP', '第三人称', '休闲短局'] },
  { name: 'Punch TV', slug: 'PunchTV', badge: 'PT', subtitleExtra: '美国发行', tags: ['休闲', '格斗', '短视频风', '轻度竞技', '免费游戏'] },
  { name: 'Tomb of the Mask: Old Maze', slug: 'TombOfTheMaskOldMaze', badge: 'TM', subtitleExtra: '塞浦路斯发行', tags: ['平台跑酷', '像素风', '迷宫冒险', '单人关卡', '复古街机'] },
  { name: 'Massive Warfare: Tanks PvP War', slug: 'MassiveWarfare', badge: 'MW', subtitleExtra: '巴西发行', tags: ['车辆射击', '3D 写实', '多人PvP', '公会', '载具收集'] },
  { name: 'Battle Cars: Nitro PvP Shooter', slug: 'BattleCars', badge: 'BC', subtitleExtra: '巴西发行', tags: ['车辆射击', '3D 写实', '多人PvP', '载具收集', '街机对战'] },
];

const PALETTES = [
  { accent: '#e94560', headerEnd: '#0f3460', insightBg: '#fff5f7' },
  { accent: '#7c3aed', headerEnd: '#1e1b4b', insightBg: '#f5f3ff' },
  { accent: '#f59e0b', headerEnd: '#3f2506', insightBg: '#fffbeb' },
  { accent: '#0ea5e9', headerEnd: '#0c4a6e', insightBg: '#f0f9ff' },
  { accent: '#10b981', headerEnd: '#064e3b', insightBg: '#ecfdf5' },
  { accent: '#ef4444', headerEnd: '#7f1d1d', insightBg: '#fef2f2' },
];
function pickPalette(slug) {
  let h = 0; for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return PALETTES[Math.abs(h) % PALETTES.length];
}

const COUNTRY_ZH = {
  US:'美国', IN:'印度', RU:'俄罗斯', BR:'巴西', CN:'中国', JP:'日本', KR:'韩国', FR:'法国', DE:'德国', GB:'英国', IT:'意大利', ES:'西班牙',
  AU:'澳大利亚', CA:'加拿大', MX:'墨西哥', TH:'泰国', ID:'印尼', VN:'越南', PH:'菲律宾', TR:'土耳其', PK:'巴基斯坦', IR:'伊朗',
  PL:'波兰', UA:'乌克兰', EG:'埃及', SA:'沙特', AE:'阿联酋', AR:'阿根廷', CO:'哥伦比亚', CL:'智利', MY:'马来西亚', SG:'新加坡',
  HK:'中国香港', TW:'中国台湾', NL:'荷兰', BE:'比利时', SE:'瑞典', NO:'挪威', FI:'芬兰', DK:'丹麦', AT:'奥地利', CH:'瑞士',
  IE:'爱尔兰', PT:'葡萄牙', GR:'希腊', CZ:'捷克', RO:'罗马尼亚', HU:'匈牙利', IL:'以色列', ZA:'南非', NG:'尼日利亚', KE:'肯尼亚',
  VE:'委内瑞拉', PE:'秘鲁', EC:'厄瓜多尔', BO:'玻利维亚', PY:'巴拉圭', UY:'乌拉圭', DO:'多米尼加', GT:'危地马拉', HN:'洪都拉斯',
  NZ:'新西兰', KZ:'哈萨克斯坦', BY:'白俄罗斯', BG:'保加利亚', HR:'克罗地亚', SK:'斯洛伐克', LT:'立陶宛', LV:'拉脱维亚', EE:'爱沙尼亚',
  RS:'塞尔维亚', BA:'波黑', MA:'摩洛哥', DZ:'阿尔及利亚', TN:'突尼斯', LY:'利比亚', JO:'约旦', LB:'黎巴嫩', IQ:'伊拉克', OM:'阿曼',
  KW:'科威特', QA:'卡塔尔', BH:'巴林', YE:'也门', LK:'斯里兰卡', BD:'孟加拉', NP:'尼泊尔', MM:'缅甸', KH:'柬埔寨', LA:'老挝',
  UZ:'乌兹别克斯坦', GE:'格鲁吉亚', AZ:'阿塞拜疆', AM:'亚美尼亚', MD:'摩尔多瓦', CY:'塞浦路斯', MT:'马耳他', LU:'卢森堡', IS:'冰岛',
  AL:'阿尔巴尼亚', MK:'北马其顿', SI:'斯洛文尼亚', ME:'黑山',
  TZ:'坦桑尼亚', GH:'加纳', CI:'科特迪瓦', SN:'塞内加尔', CM:'喀麦隆', AO:'安哥拉', MZ:'莫桑比克', UG:'乌干达', ZM:'赞比亚', ZW:'津巴布韦',
  BF:'布基纳法索', BJ:'贝宁', ML:'马里', CG:'刚果', CR:'哥斯达黎加', PA:'巴拿马', SV:'萨尔瓦多', NI:'尼加拉瓜',
  MO:'中国澳门', MV:'马尔代夫', PR:'波多黎各',
};

function humanNumber(n) {
  if (n == null) return '—';
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return String(Math.round(n));
}
function moneyHuman(cents) {
  if (cents == null) return '—';
  const d = cents / 100;
  if (d >= 1e9) return '$' + (d / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (d >= 1e6) return '$' + (d / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (d >= 1e3) return '$' + (d / 1e3).toFixed(0) + 'K';
  return '$' + d.toFixed(2);
}
function comma(n) { return Math.round(n).toLocaleString('en-US'); }
function moneyComma(cents) { return '$' + Math.round(cents / 100).toLocaleString('en-US'); }

function monthsBetween(start, end) {
  // start,end = 'YYYY-MM'
  const [sy, sm] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  const list = [];
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    list.push(y + '/' + m);
    m++; if (m > 12) { m = 1; y++; }
  }
  return list;
}

function formatMonth(ts) {
  const d = new Date(ts * 1000);
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
}

function buildMonthlyData(iosRows, andRows) {
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
      const m = formatMonth(ts);
      if (!months.has(m)) months.set(m, { r: 0, d: 0, countries: new Map() });
      const mo = months.get(m);
      mo.r += r; mo.d += d;
      if (!mo.countries.has(cc)) mo.countries.set(cc, { r: 0, d: 0 });
      const co = mo.countries.get(cc);
      co.r += r; co.d += d;
    }
  }
  add(iosRows, true);
  add(andRows, false);
  return months;
}

function generateCard(game, raw) {
  const overview = raw.overview;
  const iosRows = raw.iosData?.serialized_sales_reports?.[1]?.[0]?.[1];
  const andRows = raw.andData?.serialized_sales_reports?.[1]?.[0]?.[1];

  const months = buildMonthlyData(iosRows, andRows);
  if (!months.size) throw new Error('no data for ' + game.slug);
  const keys = [...months.keys()].sort();
  const minM = keys[0], maxM = keys[keys.length - 1];
  const allMonths = monthsBetween(minM, maxM);
  const labels = allMonths;
  const dlData = allMonths.map(m => {
    const [y, mn] = m.split('/');
    const key = y + '-' + String(mn).padStart(2, '0');
    return months.get(key)?.d || 0;
  });
  const rvCents = allMonths.map(m => {
    const [y, mn] = m.split('/');
    const key = y + '-' + String(mn).padStart(2, '0');
    return months.get(key)?.r || 0;
  });

  // Totals (all time)
  const totalDL = dlData.reduce((a, b) => a + b, 0);
  const totalRVCents = rvCents.reduce((a, b) => a + b, 0);

  // Top 5 countries (all time)
  const countryAgg = new Map();
  for (const [, mo] of months) {
    for (const [cc, co] of mo.countries) {
      if (!countryAgg.has(cc)) countryAgg.set(cc, { r: 0, d: 0 });
      const a = countryAgg.get(cc);
      a.r += co.r; a.d += co.d;
    }
  }
  const byDL = [...countryAgg.entries()].sort((a, b) => b[1].d - a[1].d);
  const byRV = [...countryAgg.entries()].sort((a, b) => b[1].r - a[1].r);
  // Pick top 5 by downloads (primary metric)
  const top5 = byDL.slice(0, 5);

  // Release date → YYYY/MM/DD
  const rel = overview.worldwide_release_date ? new Date(overview.worldwide_release_date) : null;
  const relStr = rel ? `${rel.getUTCFullYear()}/${String(rel.getUTCMonth() + 1).padStart(2, '0')}/${String(rel.getUTCDate()).padStart(2, '0')}` : '—';

  // Last 30 days from overview
  const last30Rev = overview.worldwide_last_30_days_revenue?.value ?? 0;
  const last30DL = overview.worldwide_last_30_days_downloads?.value ?? 0;
  const avgDAU = overview.worldwide_last_30_days_dau?.value ?? null;
  const rpd = overview.worldwide_all_time_rpd?.value ?? (totalDL ? totalRVCents / totalDL : null);

  // Peak download/revenue months
  const maxDLIdx = dlData.indexOf(Math.max(...dlData));
  const maxRVIdx = rvCents.indexOf(Math.max(...rvCents));

  // Has both platforms?
  const iosSub = (overview.sub_apps || []).filter(a => a.os === 'ios');
  const androidSub = (overview.sub_apps || []).filter(a => a.os === 'android');
  const platformTxt = (iosSub.length && androidSub.length) ? 'iOS + Android' : iosSub.length ? 'iOS' : 'Android';

  const pub = overview.unified_publisher_name || '—';
  const subtitle = `${pub} · ${platformTxt} · ${game.subtitleExtra}`;

  // palette
  const P = pickPalette(game.slug);

  // Top 5 table rows
  const top5DL = top5[0][1].d || 1;
  const top5RV = Math.max(...top5.map(([, v]) => v.r)) || 1;
  const top5Rows = top5.map(([cc, v], i) => {
    const ccZh = COUNTRY_ZH[cc] || cc;
    const dlPct = totalDL ? (v.d / totalDL * 100).toFixed(1) : '0.0';
    const rvPct = totalRVCents ? (v.r / totalRVCents * 100).toFixed(1) : '0.0';
    const dlBar = (v.d / top5DL) * 100;
    const rvBar = v.r > 0 ? Math.max(8, (v.r / top5RV) * 100) : 1;
    return `      <tr>
        <td><span class="rank-badge">${i + 1}</span></td>
        <td>${ccZh}</td>
        <td class="num">${comma(v.d)}</td>
        <td>
          <div class="bar-wrap"><div class="bar-bg"><div class="bar bar-dl" style="width:${dlBar.toFixed(1)}%"></div></div><span class="pct">${dlPct}%</span></div>
        </td>
        <td class="num">${moneyComma(v.r)}</td>
        <td>
          <div class="bar-wrap"><div class="bar-bg"><div class="bar bar-rv" style="width:${rvBar.toFixed(1)}%"></div></div><span class="pct">${rvPct}%</span></div>
        </td>
      </tr>`;
  }).join('\n');

  // Insights
  const top1 = top5[0];
  const top1Zh = COUNTRY_ZH[top1[0]] || top1[0];
  const top1DLPct = (top1[1].d / totalDL * 100).toFixed(1);
  const top1RVPct = (top1[1].r / totalRVCents * 100).toFixed(1);
  const top5DLCumPct = (top5.reduce((a, [, v]) => a + v.d, 0) / totalDL * 100).toFixed(1);

  // High-value country (rev share > dl share)
  const highValueList = top5.filter(([cc, v]) => totalRVCents && totalDL && (v.r / totalRVCents) > (v.d / totalDL) * 1.2).map(([cc]) => COUNTRY_ZH[cc] || cc);
  const lowValueList = top5.filter(([cc, v]) => totalRVCents && totalDL && (v.r / totalRVCents) < (v.d / totalDL) * 0.8).map(([cc]) => COUNTRY_ZH[cc] || cc);
  let regionTxt = `前5国家累计贡献 ${top5DLCumPct}% 的下载。`;
  if (highValueList.length) regionTxt += ` ${highValueList.join('、')}为高价值市场（收入占比显著高于下载占比）。`;
  if (lowValueList.length) regionTxt += ` ${lowValueList.join('、')}为相对低变现市场。`;

  // 近30天 RPD
  const last30RPD = last30DL ? (last30Rev / last30DL / 100) : null;
  const allRPD = rpd != null ? (rpd / 100) : null;
  const monetizationTxt = `上线至今RPD约为$${allRPD != null ? allRPD.toFixed(2) : '—'}。 近30天RPD约为$${last30RPD != null ? last30RPD.toFixed(2) : '—'}。${avgDAU != null ? ` 近30天平均DAU为${humanNumber(avgDAU)}。` : ''}`;

  const trendTxt = `下载峰值出现在${labels[maxDLIdx]}（${humanNumber(dlData[maxDLIdx])}），收入峰值出现在${labels[maxRVIdx]}（${moneyHuman(rvCents[maxRVIdx])}）。 ${dlData[dlData.length - 1] < dlData[maxDLIdx] * 0.6 ? '当前下载已明显低于历史高点，增长热度趋缓。' : dlData[dlData.length - 1] > dlData[maxDLIdx] * 0.85 ? '当前下载接近历史高点，仍处于活跃增长阶段。' : '当前下载处于历史峰值与低谷之间，走势平稳。'}`;

  const today = new Date();
  const genDate = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
  const dataRange = `${labels[0]} - ${labels[labels.length - 1]} · 全球`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>竞品分析 - ${overview.name}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #f0f2f5; padding: 24px; color: #1a1a2e; }
.card { background: #fff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); max-width: 920px; margin: 0 auto; overflow: hidden; }
.card-header { background: linear-gradient(135deg, #1a1a2e 0%, ${P.headerEnd} 100%); padding: 28px 32px; display: flex; align-items: center; gap: 18px; }
.app-badge { width: 72px; height: 72px; border-radius: 16px; background: ${P.accent}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; flex-shrink: 0; }
.app-info h1 { font-size: 24px; font-weight: 700; color: #fff; margin-bottom: 6px; }
.subtitle { font-size: 13px; color: rgba(255,255,255,0.78); }
.tags { margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; }
.tag { background: rgba(255,255,255,0.12); color: #fff; font-size: 11px; padding: 4px 10px; border-radius: 999px; }
.section-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; padding: 16px 32px 8px; border-top: 1px solid #f0f2f5; }
.overview-row, .kpi-row { display: grid; }
.overview-row { grid-template-columns: repeat(3, 1fr); }
.kpi-row { grid-template-columns: repeat(4, 1fr); border-top: 1px solid #f0f2f5; }
.item, .kpi-item { padding: 18px 20px; text-align: center; border-right: 1px solid #f0f2f5; }
.item:last-child, .kpi-item:last-child { border-right: none; }
.item-label, .kpi-label { font-size: 11px; color: #64748b; margin-bottom: 6px; }
.item-value { font-size: 24px; font-weight: 700; color: ${P.accent}; }
.kpi-value { font-size: 26px; font-weight: 700; color: #1f2937; }
.item-sub, .kpi-sub { font-size: 10px; color: #94a3b8; margin-top: 4px; }
.charts-row { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid #f0f2f5; }
.chart-box { padding: 20px 24px; border-right: 1px solid #f0f2f5; }
.chart-box:last-child { border-right: none; }
.chart-title { font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 12px; }
.chart-wrap { position: relative; height: 180px; }
.section { padding: 0 32px 24px; }
.section-title { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; padding: 16px 0 12px; border-top: 1px solid #f0f2f5; }
.country-table { width: 100%; border-collapse: collapse; }
.country-table th { font-size: 11px; color: #64748b; font-weight: 600; text-align: left; padding: 8px 10px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; }
.country-table th.r { text-align: right; }
.country-table td { padding: 10px; font-size: 13px; border-bottom: 1px solid #f0f2f5; vertical-align: middle; }
.country-table tr:last-child td { border-bottom: none; }
.rank-badge { width: 20px; height: 20px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; background: ${P.accent}; color: #fff; }
.num { text-align: right; color: #475569; }
.bar-wrap { display: flex; align-items: center; gap: 6px; justify-content: flex-end; }
.bar-bg { width: 74px; height: 6px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
.bar { height: 100%; border-radius: 999px; }
.bar-dl { background: linear-gradient(90deg, #3b82f6, #93c5fd); }
.bar-rv { background: linear-gradient(90deg, #16a34a, #86efac); }
.pct { min-width: 44px; text-align: right; font-size: 12px; font-weight: 700; color: #334155; }
.insights { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; padding: 0 32px 28px; }
.insight-card { background: ${P.insightBg}; border-left: 4px solid ${P.accent}; border-radius: 10px; padding: 16px 18px; }
.insight-card h4 { font-size: 12px; color: #334155; margin-bottom: 8px; }
.insight-card p { font-size: 12px; line-height: 1.7; color: #334155; }
.card-footer { background: #f8fafc; padding: 12px 32px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; gap: 12px; flex-wrap: wrap; }
.footer-text { font-size: 11px; color: #94a3b8; }
@media (max-width: 800px) {
  .overview-row, .kpi-row, .charts-row, .insights { grid-template-columns: 1fr; }
  .item, .kpi-item, .chart-box { border-right: none; border-bottom: 1px solid #f0f2f5; }
  .chart-box:last-child, .kpi-item:last-child, .item:last-child { border-bottom: none; }
}

/* ── lang toggle ── */
.lang-toggle-wrap { position: fixed; top: 16px; right: 16px; z-index: 999; }
.lang-toggle-btn { background: rgba(30,30,60,0.82); color: #fff; border: 1.5px solid rgba(255,255,255,0.3); border-radius: 10px; padding: 7px 14px; font-size: 13px; font-weight: 700; cursor: pointer; backdrop-filter: blur(6px); }
.lang-toggle-btn:hover { background: rgba(30,30,60,0.95); }

</style>
</head>
<body>
<div class="lang-toggle-wrap">
  <button id="langToggleBtn" class="lang-toggle-btn">EN</button>
</div>

<div class="card">
  <div class="card-header">
    <div class="app-badge">${game.badge}</div>
    <div class="app-info">
      <h1>${overview.name}</h1>
      <div class="subtitle">${subtitle}</div>
      <div class="tags">${game.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
    </div>
  </div>

  <div class="section-label">维度一 · 基础概览</div>
  <div class="overview-row">
    <div class="item">
      <div class="item-label">全球上线时间</div>
      <div class="item-value">${relStr}</div>
      <div class="item-sub">数据来源：Sensor Tower</div>
    </div>
    <div class="item">
      <div class="item-label">上线至今总下载</div>
      <div class="item-value">${humanNumber(totalDL)}</div>
      <div class="item-sub">全球 · 所有时间</div>
    </div>
    <div class="item">
      <div class="item-label">上线至今总收入</div>
      <div class="item-value">${moneyHuman(totalRVCents)}</div>
      <div class="item-sub">全球 · 所有时间</div>
    </div>
  </div>

  <div class="section-label">维度二 · 近30天核心指标</div>
  <div class="kpi-row">
    <div class="kpi-item">
      <div class="kpi-label">下载量</div>
      <div class="kpi-value">${humanNumber(last30DL)}</div>
      <div class="kpi-sub">全球 · 近30天</div>
    </div>
    <div class="kpi-item">
      <div class="kpi-label">收入</div>
      <div class="kpi-value">${moneyHuman(last30Rev)}</div>
      <div class="kpi-sub">全球 · 近30天</div>
    </div>
    <div class="kpi-item">
      <div class="kpi-label">RPD</div>
      <div class="kpi-value">$${allRPD != null ? allRPD.toFixed(2) : '—'}</div>
      <div class="kpi-sub">全球 · 所有时间</div>
    </div>
    <div class="kpi-item">
      <div class="kpi-label">平均DAU</div>
      <div class="kpi-value">${avgDAU != null ? humanNumber(avgDAU) : '—'}</div>
      <div class="kpi-sub">全球 · 近30天</div>
    </div>
  </div>

  <div class="section-label">维度三 · 上线至今月度趋势</div>
  <div class="charts-row">
    <div class="chart-box">
      <div class="chart-title">月度下载量趋势</div>
      <div class="chart-wrap"><canvas id="dlChart"></canvas></div>
    </div>
    <div class="chart-box">
      <div class="chart-title">月度收入趋势</div>
      <div class="chart-wrap"><canvas id="rvChart"></canvas></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">维度四 · 上线至今 Top 5 国家表现</div>
    <table class="country-table">
      <thead>
        <tr>
          <th style="width: 32px;">#</th>
          <th>国家</th>
          <th class="r">下载量</th>
          <th class="r" style="width: 150px;">下载占比</th>
          <th class="r">净收入</th>
          <th class="r" style="width: 150px;">净收入占比</th>
        </tr>
      </thead>
      <tbody>
${top5Rows}
      </tbody>
    </table>
  </div>

  <div class="section-label">数据分析洞察</div>
  <div class="insights">
      <div class="insight-card">
        <h4>市场集中度</h4>
        <p>${top1Zh}贡献${top1DLPct}%下载、${top1RVPct}%收入。 前5国家累计贡献${top5DLCumPct}%下载，${top1[1].d / totalDL > 0.4 ? '头部市场高度集中。' : '分布相对均衡。'}</p>
      </div>
      <div class="insight-card">
        <h4>变现效率</h4>
        <p>${monetizationTxt}</p>
      </div>
      <div class="insight-card">
        <h4>区域结构</h4>
        <p>${regionTxt}</p>
      </div>
      <div class="insight-card">
        <h4>趋势判断</h4>
        <p>${trendTxt}</p>
      </div>
  </div>

  <div class="card-footer">
    <span class="footer-text">数据周期：${dataRange}</span>
    <span class="footer-text">数据来源：Sensor Tower · 生成时间：${genDate}</span>
  </div>
</div>

<script>
const labels = ${JSON.stringify(labels)};
const dlData = ${JSON.stringify(dlData)};
const rvData = ${JSON.stringify(rvCents.map(c => c / 100))};
const commonOpts = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#94a3b8', maxRotation: 45, autoSkip: true, maxTicksLimit: 12 } },
    y: { grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8' } }
  }
};
new Chart(document.getElementById('dlChart'), {
  type: 'line',
  data: { labels, datasets: [{ data: dlData, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)', fill: true, tension: 0.35, pointRadius: 2, borderWidth: 2 }] },
  options: {
    ...commonOpts,
    plugins: { ...commonOpts.plugins, tooltip: { callbacks: { label: ctx => ' ' + ctx.parsed.y.toLocaleString() + ' 次' } } },
    scales: { ...commonOpts.scales, y: { ...commonOpts.scales.y, ticks: { ...commonOpts.scales.y.ticks, callback: v => v >= 1000000 ? (v/1000000).toFixed(1) + 'M' : v >= 1000 ? (v/1000).toFixed(0) + 'K' : v } } }
  }
});
new Chart(document.getElementById('rvChart'), {
  type: 'line',
  data: { labels, datasets: [{ data: rvData, borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.08)', fill: true, tension: 0.35, pointRadius: 2, borderWidth: 2 }] },
  options: {
    ...commonOpts,
    plugins: { ...commonOpts.plugins, tooltip: { callbacks: { label: ctx => ' $' + ctx.parsed.y.toLocaleString() } } },
    scales: { ...commonOpts.scales, y: { ...commonOpts.scales.y, ticks: { ...commonOpts.scales.y.ticks, callback: v => '$' + (v >= 1000000 ? (v/1000000).toFixed(1) + 'M' : v >= 1000 ? (v/1000).toFixed(0) + 'K' : v) } } }
  }
});
</script>

</body>
</html>`;
}

// Run
for (const g of GAMES) {
  const rawPath = path.join(TEMP, `batch_${g.slug}.json`);
  if (!fs.existsSync(rawPath)) { console.log('MISSING raw:', g.slug); continue; }
  const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  try {
    const html = generateCard(g, raw);
    const out = path.join(OUT, `竞品分析_${g.slug}.html`);
    fs.writeFileSync(out, html, 'utf8');
    console.log('OK →', out);
  } catch (e) {
    console.log('ERR', g.slug, '→', e.message);
  }
}
