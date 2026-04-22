# scripts/ — 竞品分析卡片工具链

所有脚本通过相对路径运行，从项目根目录 clone 下来即可在任意机器上使用。

## 前置条件

1. **Edge 必须用调试端口启动**，且 Sensor Tower 已登录：
   ```bash
   # Windows：先杀光所有 Edge 进程（必须，否则旧实例会占用但不开调试端口）
   taskkill //IM msedge.exe //F
   # 再用默认 profile 启动（保留登录态）
   powershell -Command "Start-Process 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' -ArgumentList '--remote-debugging-port=9222','https://app.sensortower-china.com/'"
   ```
   验证：`curl http://127.0.0.1:9222/json/version` 返回 JSON（不是 404）。

2. 安装依赖：`cd scripts && npm install`

## 工作流

```bash
# 1. 搜索游戏名 → 得到 unified_app_id
node search_games.js "Polygun Arena: Online Shooter" "Punch TV"

# 2. 把游戏清单（name/slug/uid）填入 batch_collect.js 顶部的 GAMES 数组，然后采集
node batch_collect.js       # 输出 .data/batch_<slug>.json

# 3. 把相同清单（带 badge/subtitleExtra/tags）填入 generate_comp_cards.js 顶部的 GAMES，然后生成
node generate_comp_cards.js # 输出 ../竞品分析_<slug>.html

# 4. 更新 game-meta.json（icon/genre/总量）
node update_meta.js

# 5. 注入中/英语言切换（幂等可重复）
cd .. && node patch_card_lang.js

# 6. 刷新索引
node refresh_index.js

# 7. 提交推送（Netlify 自动部署，~30s）
git add . && git commit -m "新增 xxx 卡片" && git push origin master
```

## 文件说明

| 文件 | 作用 |
|------|------|
| `cdp.js` | CDP WebSocket 工具模块（Edge DevTools Protocol 客户端） |
| `search_games.js` | 通过 `/api/autocomplete_search` 按游戏名找 `unified_app_id` |
| `batch_collect.js` | 采集 overview + 月度销售估算（iOS + Android） |
| `generate_comp_cards.js` | 从 `.data/batch_*.json` 生成竞品分析 HTML 卡片 |
| `update_meta.js` | 提取图标/子类/总量更新 `../game-meta.json` |
| `patch_card_icon.js` | 把卡片 header 的文字 badge 替换为真图标 |
| `admin_server.js` | 本地管理服务（增删卡片） — 见下方 "Admin 本地管理服务" |
| `site-admin.js` | 管理员 UI 浮层（+按钮 + × 删除按钮） |
| `.data/` | 采集的原始 JSON（git 忽略） |

## Admin 本地管理服务（新增/删除卡片）

首页 `index.html` 支持管理员在本机增删卡片并即时推到 GitHub（Netlify 自动部署）。

**架构**：`scripts/admin_server.js`（本地 127.0.0.1:9876）+ `scripts/site-admin.js`（浏览器内 UI 浮层）。公网用户 ping 不通本地服务器，看不到任何管理按钮；只在本机开着服务器时，FAB + 删除按钮才会显现。

### 启动

```bash
# 1. 保证 Edge 带调试端口启动、ST 已登录（同"前置条件"）
# 2. 启动管理服务器
cd scripts
node admin_server.js
# → admin server listening on http://127.0.0.1:9876
```

### 使用

- 打开 `index.html`（file:// 或 Netlify 线上都行） → 右下角出现紫色 `+` FAB
- **新增**：点 `+` → 输入密码 `180722` → 输入游戏名 → 输入数据来源链接（可留空） → 服务器自动跑全流程（搜索 uid → 采集 → 生成 HTML → 补语言/图标 → 更新 meta → 刷新索引 → `git add/commit/push`） → 页面自动刷新显示新卡片
- **删除**：鼠标悬浮任意卡片 → 右上角出现红色 `×` → 点击 → 密码 → 二次确认 → 删文件、删 meta 条目、刷新索引、git push → 页面自动刷新
- 密码在 sessionStorage 里缓存，同一会话内不重复问

### 安全边界

- 服务器只绑 `127.0.0.1`，不对 LAN 开放
- 密码 `180722` 硬编码在 `site-admin.js` 和 `admin_server.js`（用户明确要求）— 只防误操作，不防恶意
- 删除接口强校验 slug 格式：`/^竞品分析_[A-Za-z0-9_]+$/`
- 所有 git 命令用 `execFileSync` 数组参数，不拼字符串
- 任何流程出错不触发 commit，前端显示 `step` 字段帮定位

### 端点

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/ping` | 无需密码，返回 `{ok:true}`，用于前端探活 |
| POST | `/api/add` | `{password, name, url}` → 编排新增 + git push |
| POST | `/api/delete` | `{password, slug}` → 删除 + git push（slug 形如 `竞品分析_Foo`） |

---

| `.data/` | 采集的原始 JSON（git 忽略） |

## ST API 要点（2026-04 实测）

- **搜索**：`GET /api/autocomplete_search?entity_type=app&expand_entities=true&os=unified&term=<name>` → `data.entities[0].app_id` 即 unified_app_id
- **概览**：`GET /api/unified/apps/<uid>` → 含 `worldwide_release_date`、`worldwide_last_30_days_*`、`icon_url`、`sub_genre`、`sub_apps[]`
- **月度时序**（按国家）：
  - `GET /api/ios/serialized_sales_report_estimates?start_date=...&end_date=...&date_granularity=monthly&unified_app_ids[]=<uid>`
  - `GET /api/android/serialized_sales_report_estimates?...`
  - iOS 行 schema：`[unix_ts, cc, revenue_cents, downloads, iap_revenue_cents, iap_downloads]` — 全球值需 `r+iap_r`、`d+iap_d`
  - Android 行 schema：`[unix_ts, cc, revenue_cents, downloads]`
  - `countries[]` 参数对此端点**无效**（总返回所有国家），按国家拆分要从返回结果中自行聚合

**已失效的 API（文档里老版本，不要用）**：
- `/api/apps/timeseries/regions` → 404
- `/api/apps/timeseries/unified_apps` 带 `regions`/`countries`/`group_by`/`breakdown_attribute` → 422
- `/api/unified/serialized_sales_report_estimates` → 404（只有 ios/android 两条路径）
