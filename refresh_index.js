const fs = require('fs');
const path = require('path');

// __dirname 指向脚本自身所在目录，任何设备 clone 后都能正常运行
const ROOT = __dirname;
const OUTPUT_JSON = path.join(ROOT, 'cards-index.json');
const SITE_JS = path.join(ROOT, 'site.js');
// 图标/分类元数据文件，放在项目根目录，同样跟随 git 管理
const ICONS_FILE = path.join(ROOT, 'game-meta.json');

function readTitle(html) {
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (titleMatch) return decodeHtml(titleMatch[1]).replace(/^竞品分析\s*-\s*/i, '').trim();
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) return decodeHtml(h1Match[1].replace(/<[^>]+>/g, '')).trim();
  return '';
}

function decodeHtml(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function inferTags(title, fileName) {
  const sourceTags = ['竞品分析卡片'];
  const combined = `${title} ${fileName}`.toLowerCase();
  if (combined.includes('rpg')) sourceTags.push('RPG');
  if (combined.includes('merge')) sourceTags.push('Merge');
  if (combined.includes('drone') || combined.includes('heroes') || combined.includes('war')) sourceTags.push('射击/战争');
  if (combined.includes('hill') || combined.includes('racing') || combined.includes('ball')) sourceTags.push('竞技');
  if (combined.includes('idle')) sourceTags.push('放置');
  return [...new Set(sourceTags)];
}

function main() {
  const icons = fs.existsSync(ICONS_FILE) ? JSON.parse(fs.readFileSync(ICONS_FILE, 'utf8')) : {};

  const files = fs.readdirSync(ROOT)
    .filter(name => /^竞品分析_.*\.html$/i.test(name))
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));

  const cards = files.map(fileName => {
    const fullPath = path.join(ROOT, fileName);
    const html = fs.readFileSync(fullPath, 'utf8');
    const stat = fs.statSync(fullPath);
    const title = readTitle(html) || fileName.replace(/^竞品分析_|\.html$/g, '');
    const slug = fileName.replace(/\.html$/i, '');
    const m = icons[slug] || {};
    const iconUrl = typeof m === 'string' ? m : (m.iconUrl || null);
    const genre = (typeof m === 'object' && m.genre) ? m.genre : '竞品分析卡片';
    const totalDownloads = (typeof m === 'object' && m.totalDownloads) ? m.totalDownloads : null;
    const totalRevenue = (typeof m === 'object' && m.totalRevenue) ? m.totalRevenue : null;
    return {
      title,
      fileName,
      relativePath: `./${fileName}`,
      updatedAt: stat.mtime.toISOString(),
      updatedAtText: stat.mtime.toISOString().slice(0, 19).replace('T', ' '),
      sourceType: genre,
      tags: inferTags(title, fileName),
      slug,
      iconUrl,
      totalDownloads,
      totalRevenue,
    };
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    total: cards.length,
    cards,
  };

  // 1. 保留独立 JSON（可选备份）
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(payload, null, 2), 'utf8');

  // 2. 把数据内嵌到 site.js，彻底不依赖 fetch
  const existingJs = fs.readFileSync(SITE_JS, 'utf8');
  const marker_start = '/* CARDS_DATA_START */';
  const marker_end = '/* CARDS_DATA_END */';
  const injection = `${marker_start}\nwindow.__CARDS_INDEX__ = ${JSON.stringify(payload)};\n${marker_end}`;
  let newJs;
  if (existingJs.includes(marker_start)) {
    newJs = existingJs.replace(
      new RegExp(`\\/\\* CARDS_DATA_START \\*\\/[\\s\\S]*?\\/\\* CARDS_DATA_END \\*\\/`),
      injection
    );
  } else {
    newJs = injection + '\n\n' + existingJs;
  }
  fs.writeFileSync(SITE_JS, newJs, 'utf8');

  console.log(`ok: ${cards.length} cards indexed → site.js updated`);
  return payload;
}

module.exports = { main };

if (require.main === module) main();

