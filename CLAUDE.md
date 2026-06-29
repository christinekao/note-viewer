# 02_note-viewer — CLAUDE.md

## 專案簡介
Kao_oaK 個人知識庫的互動式 note viewer。讀取 Obsidian vault，以 VitePress 風格的深色介面呈現筆記。

## 架構

```
02_note-viewer/
├── server/index.js        Express API server（port 3001，ESM 模組）
├── src/
│   ├── App.jsx            主 layout（nav + sidebar + content + dialog）
│   ├── index.css          CSS variables（VitePress tokens）
│   └── components/
│       ├── Dashboard.jsx   首頁（分類卡片 + 筆記列表）
│       ├── Sidebar.jsx     側邊欄（folder tree，預設隱藏）
│       ├── NoteView.jsx    筆記閱讀 / 編輯（TOC 在左側）
│       ├── Editor.jsx      MD 編輯器
│       ├── MermaidChart.jsx Mermaid 圖表
│       ├── CodeBlock.jsx   程式碼區塊
│       ├── SearchBar.jsx   搜尋
│       ├── Dialog.jsx      對話框（rename / delete / create / addTag）
│       ├── Background.jsx  背景特效
│       └── ResizeHandle.jsx 側邊欄拖曳調整寬度
```

## 資料來源
- Vault 路徑：`D:\OneDrive - TrendMicro\Obsidian\Kao_oaK`
- 環境變數 `VAULT_PATH` 可覆蓋預設路徑

## 啟動

**Windows：** PowerShell Constrained Language Mode 會擋住 `npm run dev`，請改用：

```bat
cd "D:\OneDrive - TrendMicro\Claude Code\02_note-viewer"
start.bat
```

或分開開：
```bat
# terminal 1 — server
node server/index.js

# terminal 2 — vite（若 npm run dev 失敗）
node node_modules/vite/bin/vite.js
```

- Express：http://localhost:3001
- Vite：http://localhost:5173

## 啟動（Mac）

```bash
# 方法一（推薦）
npm run dev   # 同時跑 server + vite

# 方法二（分開）
# terminal 1
node server/index.js

# terminal 2
node node_modules/vite/bin/vite.js
```

如果 port 被舊 process 佔住，先清乾淨：
```bash
lsof -ti:3001,5173,5174,5175,5176,5177 | xargs kill -9 2>/dev/null
```

## API 端點（server/index.js）

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET  | /api/notes | 讀取全部筆記（含 frontmatter）|
| GET  | /api/note?path= | 讀取單一筆記完整內容 |
| GET  | /api/search?q= | 全文搜尋（最多 30 筆）|
| POST | /api/note/create | 新增筆記 |
| PUT  | /api/note/save | 儲存內容（保留 frontmatter）|
| PUT  | /api/note/rename | 重新命名（MD + HTML + `_ref_` PDF + frontmatter 路徑全部同步）|
| PUT  | /api/note/move | 移動資料夾 |
| PUT  | /api/note/tags | 更新 tags |
| DELETE | /api/note?path= | 刪除筆記 |
| GET  | /api/pins | 讀取釘選清單 |
| POST | /api/pins/toggle | 切換釘選 |
| POST | /api/note/export-html | 匯出 HTML 到 `_html/` |
| GET  | /api/note/has-html | 檢查是否有對應 HTML（回傳 `exists`, `hasSidebar`, `url`）|
| GET  | /mermaid.min.js | serve mermaid（用 createReadStream，不用 sendFile）|
| GET  | /pdfjs/pdf.min.mjs | serve pdfjs |

## 已知技術細節與坑

### server/index.js
- ESM 模組，需要手動定義 `__dirname`：
  ```js
  import { fileURLToPath } from 'url'
  import { dirname } from 'path'
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  ```
- `res.sendFile` 在 Windows 路徑含空格時會 404，改用 `fs.createReadStream().pipe(res)`
- **rename 端點同步範圍**：MD + HTML + `_ref_` PDF（用 `oldName + '_ref_'` prefix 搜尋）+ frontmatter 裡的 `html:` / `pdf:` 路徑。buildHtml 失敗不影響 rename 主流程（non-fatal）
- **has-html 邏輯**：先讀 frontmatter 的 `html:` 欄位，找不到才 fallback 到 `_html/{basename}.html`；回傳 `hasSidebar`（偵測 `class="sidebar"` 或 `class='sidebar'`）

### MermaidChart.jsx
- React StrictMode 會 double-mount，同 ID 會衝突 → 每次 render 在 useEffect 內動態產生新 ID
- SVG render 後要手動設 `maxWidth: '100%'`、`height: 'auto'` 才可見
- HTML 內的 Mermaid 用 `\n` 換行會 syntax error，要改成 `<br/>`

### NoteView.jsx
- **Rules of Hooks**：所有 useEffect / useCallback 必須在 `if (loading) return` 之前宣告
- Scroll container 是 `<article ref={contentRef}>`，不是 document
  - TOC 點擊跳轉用 `getBoundingClientRect()` + `scrollBy()`
  - 內文錨點連結（`<a href="#...">`）也要攔截，用 link 文字比對 heading text 做 fallback（因為 markdown 錨點 slug 格式跟我們的 heading id 格式不同）
- **左側 TOC 拖曳**：寬度 180px 初始值，delta 方向是 `e.clientX - tocDragStart.current.x`（正向）；用 `requestAnimationFrame` 節流，避免每個 mousemove 觸發 re-render
- rename 完成後要重新 fetch 完整筆記內容（`/api/note?path=`）才會更新 H1 顯示
- **Inline rename**：title 旁邊的 ✏️ icon，Enter/✓ 呼叫 `/api/note/rename`；不用舊的 Dialog
- **HTML view**：iframe 顯示 HTML，toolbar 有藍色 `HTML` badge 標示目前在 HTML 版本
  - `hasSidebar = true` → iframe 佔滿整個 content 區，不顯示外部 TOC
  - `hasSidebar = false` → 以前會顯示外部 TOC（從 MD heading 抓），現已改為所有 HTML 直接在檔案裡加 sidebar，外部 TOC 不再使用

### Dashboard.jsx
- `activeCategory` 用 `localStorage.getItem('lastCategory')` 初始化，切換分類時寫入，點空白清除
- 回首頁後選取的分類會自動恢復

### App.jsx
- Sidebar 預設隱藏：`useState(false)`
- rename dialog 預填值用 `noteContent.title`（H1 text），不是檔名

### CSS（src/index.css）
- `.prose h1 { display: none }` — 所有 MD view 的 H1 隱藏，避免跟 note viewer header 重複顯示

## CSS 設計規範
VitePress 官方 CSS token（定義在 `src/index.css`）：

- 背景：`--vp-c-bg` `--vp-c-bg-alt` `--vp-c-bg-elv`
- 文字：`--vp-c-text-1/2/3`
- 品牌色：`--vp-c-brand-1` (#5672cd)
- 分隔線：`--vp-c-divider`
- Nav 高度：`--vp-nav-height` (64px)

## 筆記過濾規則
Sidebar / Dashboard 過濾掉：
- `Wiki/` 開頭
- `Clippings/Claude 官方課程/` 開頭
- 根目錄（無子資料夾）的 md 檔
- create 時若 title 有 `YYYY-MM-DD_` 前綴，server 自動去掉前綴作為檔名，日期寫進 frontmatter `date:` 欄位

## Dashboard 分類卡片
`CATEGORY_META` 定義在 `Dashboard.jsx`，包含 icon、accent 顏色、desc。
新增 vault 分類時要同步新增 meta，否則顯示灰色預設樣式。

### 動態 category meta（skill 建立 folder 時用）
- `POST /api/folder/create` — `{ folder, icon, desc? }` → 建目錄 + 存進 `_config/categories.json`
- `GET /api/categories` — 回傳 categories.json 內容
- Dashboard 啟動時自動 fetch，merge 進 CATEGORY_META（hardcoded 優先）
- **Skill 負責根據 folder 名稱自動選擇合適的 emoji icon**
