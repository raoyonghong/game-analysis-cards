# 游戏竞品分析卡片库 — 项目说明

## 项目用途
为竞品游戏自动生成标准化 HTML 数据分析卡片，并托管到 Netlify 网站供团队在线浏览。

---

## 目录结构

```
02_Projects/
├── index.html          # 网站首页（卡片库入口）
├── site.css            # 网站样式
├── site.js             # 前端逻辑（含内嵌的卡片索引数据）
├── cards-index.json    # 卡片索引备份（JSON）
├── refresh_index.js    # 刷新网站索引的脚本（每次新增卡片后运行）
├── 竞品分析_*.html     # 每款游戏的数据卡片（命名规则：竞品分析_英文短名.html）
```

临时脚本（存放在 `C:/Users/yonghong.rao/AppData/Local/Temp/`）：
- `generate_comp_cards.js` — 批量生成 HTML 数据卡片
- `fetch_game_icons.js` — 从 Google Play / App Store 抓取游戏图标 URL
- `game-icons.json` / `game-meta.json` — 图标 URL + 游戏子分类
- `batch_game_0~10.json` — 每款游戏的 Sensor Tower 原始数据
- `batch_collect2.js` — 通过 Edge 调试端口批量采集 Sensor Tower 数据

---

## GitHub 仓库

**GitHub：** https://github.com/raoyonghong/game-analysis-cards

任何设备换了都可以用：
```bash
git clone https://github.com/raoyonghong/game-analysis-cards
cd game-analysis-cards
```

---

## 多设备工作流（换了电脑怎么操作）

### 首次在新设备上使用
```bash
# 1. 安装依赖工具
npm install -g netlify-cli

# 2. 克隆项目（路径随意，不再绑定固定目录）
git clone https://github.com/raoyonghong/game-analysis-cards
cd game-analysis-cards

# 3. 登录 GitHub CLI（如果需要）
gh auth login

# 4. 登录 Netlify CLI（如果需要）
netlify login
```

### 日常新增卡片后，更新网站只需两步
```bash
# 1. 提交所有改动
git add .
git commit -m "新增 xxx 卡片"
git push origin master

# ↑ push 后 Netlify 自动触发部署，约 30 秒网站自动更新
# 不需要再手动跑 netlify deploy
```

---

登录账号：raoyonghong@126.com
Netlify 管理后台：https://app.netlify.com/projects/boisterous-hotteok-f473bf

---

## 新增游戏卡片的标准流程

### 用户需要提供
```
游戏名称：xxx
商店链接：https://play.google.com/store/apps/details?id=com.xxx
          或 https://apps.apple.com/us/app/xxx/id123456789
```
> 可以一次性提供多款游戏清单。

### Claude 自动执行的步骤

1. **通过 Edge 调试端口从 Sensor Tower 采集数据**
   - Edge 须开启远程调试（`--remote-debugging-port=9222`）
   - Sensor Tower 页面须保持已登录状态（站点：app.sensortower-china.com）
   - 采集内容：概览文本、Top5 国家分布、月度时间序列（`/api/apps/timeseries/regions`）
   - 输出：`C:/Users/yonghong.rao/AppData/Local/Temp/batch_game_N.json`

2. **生成 HTML 数据卡片**
   - 脚本：`C:/Users/yonghong.rao/AppData/Local/Temp/generate_comp_cards.js`
   - 输出：`竞品分析_<英文短名>.html` → `02_Projects/`
   - 卡片包含 4 个维度：基础概览、近30天核心指标、月度趋势图、Top5 国家表现 + 数据洞察

3. **获取游戏图标和子分类**
   - 脚本：`C:/Users/yonghong.rao/AppData/Local/Temp/fetch_game_icons.js`
   - 图标来源：Google Play `og:image` / App Store iTunes Lookup API
   - 子分类来源：Sensor Tower overviewText 中的 Game IQ `子分类` 字段
   - 输出：`game-icons.json`（结构：`{ slug: { iconUrl, genre } }`）

4. **刷新网站索引并部署**
   ```bash
   node "C:/Users/yonghong.rao/Desktop/Claude_Code_Workspace/02_Projects/refresh_index.js"
   netlify deploy --dir "C:/Users/yonghong.rao/Desktop/Claude_Code_Workspace/02_Projects" --prod
   ```

---

## 关键技术细节

### Edge 远程调试端口
- URL：`ws://127.0.0.1:9222`
- 查看所有标签页：`curl http://127.0.0.1:9222/json/list`
- Sensor Tower 工作标签页 ID 示例（每次重启可能变化，需重新查）：`AC9BB4B80D89A28F931924F8ED6D481A`
- 用此标签页的上下文执行 `fetch('/api/apps/timeseries/regions', ...)` 带 credentials 的请求

### Sensor Tower 数据采集要点
- `unified_app_id`：从 Sensor Tower URL 中读取（如 `683fe85f0a50128948da1631`）
- `package_id`：Android 包名（如 `com.xxx.yyy`）或 iOS 数字 AppID（如 `6745767745`）
- `revenue` 字段单位是**分（cents）**，展示前须 ÷100 换算为美元
- 所有地区列表（ALL_REGIONS）在 `batch_collect2.js` 顶部有完整定义

### 卡片 HTML 结构
- 模板参考：`竞品分析_WarDrone.html`（最新生成格式）
- 图表库：Chart.js 4.4.0（CDN）
- 每款游戏配色由 slug 哈希决定，6 套调色板循环

### 网站首页数据注入方式
- `refresh_index.js` 运行后会把索引数据以 `window.__CARDS_INDEX__ = {...}` 形式内嵌到 `site.js` 开头
- 这样双击 `index.html` 直接打开也能正常显示（不依赖 fetch）

---

## 已完成的游戏（12 张）

| slug | 游戏名 | 游戏类型 | 平台 |
|------|--------|---------|------|
| StoneAgeIdleAdventure | 스톤에이지 키우기 | 放置RPG | Android |
| WarDrone | War Drone: 3D Shooting Games | 狙击手 | Android |
| DreamMania | Dream Mania - Match 3 Games | 交换消除 | Android |
| ParadisePaws | Paradise Paws: Merge Animals | 三合 | Android |
| DrillCollect | Drill & Collect: idle mine dig | 放置经营 | Android |
| HillClimbRacing2 | Hill Climb Racing 2 | 街机驾驶 | Android |
| Warframe | Warframe | FPS / 3PS | Android |
| Skullgirls | Skullgirls: Fighting RPG | 1v1格斗 | Android |
| HeadBall2 | Head Ball 2 - Online Soccer | 街机体育 | Android |
| WingsOfHeroes | Wings of Heroes: Plane Games | 车辆射击 | Android |
| FeedTheDeep | Feed the Deep | 其他街机 | iOS |
| ZombieMiner | Idle Zombie Miner: Gold Tycoon | 放置经营 | iOS/Android |
