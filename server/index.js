import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import matter from 'gray-matter'
import { marked } from 'marked'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
app.use(cors())
app.use(express.json())

// Production: serve Vite build output
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist')
  app.use(express.static(distPath))
}

if (!process.env.VAULT_PATH) {
  console.error('ERROR: VAULT_PATH environment variable is required.')
  console.error('Copy .env.example to .env and set your vault path.')
  process.exit(1)
}

const VAULT_PATH = process.env.VAULT_PATH

// 讓前端可以載入 vault 裡的 HTML 檔案（_html\ 資料夾）
app.use('/vault', express.static(VAULT_PATH))

// 提供 local mermaid，避免 HTML 檔案用 CDN 被 Edge Tracking Prevention 擋
const mermaidPath = path.join(__dirname, '..', 'node_modules', 'mermaid', 'dist', 'mermaid.min.js')
app.get('/mermaid.min.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript')
  fs.createReadStream(mermaidPath).pipe(res)
})

// 提供 local pdfjs
const pdfjsDir = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build')
app.get('/pdfjs/pdf.min.mjs', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript')
  fs.createReadStream(path.join(pdfjsDir, 'pdf.min.mjs')).pipe(res)
})
app.get('/pdfjs/pdf.worker.min.mjs', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript')
  fs.createReadStream(path.join(pdfjsDir, 'pdf.worker.min.mjs')).pipe(res)
})

function extractTags(frontmatterTags, content) {
  // frontmatter tags，統一轉小寫
  const fromFrontmatter = (Array.isArray(frontmatterTags)
    ? frontmatterTags
    : frontmatterTags ? [frontmatterTags] : []
  ).map(t => String(t).toLowerCase())

  // inline #tag，只從 frontmatter 取（避免 content 內 #ADX 造成重複）
  // 若想保留 inline tags，只補 frontmatter 沒有的
  const seen = new Set(fromFrontmatter)
  const stripped = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/^#+\s.*/gm, '')
  const inlineTags = [...stripped.matchAll(/#([a-zA-Z一-鿿][a-zA-Z0-9一-鿿_/-]*)/g)]
    .map(m => m[1].toLowerCase())
    .filter(t => !seen.has(t))

  return [...fromFrontmatter, ...inlineTags]
}

// 從 content 第一個 # heading 取標題（先移除 code block，避免抓到 Python 注釋）
function extractH1(content) {
  const stripped = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '')
  const m = stripped.match(/^#\s+(.+)$/m)
  return m ? m[1].trim() : null
}

// 日期格式化：把 JS Date object 或字串轉成 YYYY-MM-DD
function formatDate(raw) {
  if (!raw) return null
  if (raw instanceof Date) return raw.toISOString().split('T')[0]
  const s = String(raw)
  // 如果已是 YYYY-MM-DD 格式直接回傳
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // 嘗試 parse 後格式化
  const d = new Date(s)
  return isNaN(d.getTime()) ? s : d.toISOString().split('T')[0]
}

// 確保 relPath 不走出 VAULT_PATH（防止 path traversal）
function safeResolvePath(relPath) {
  const resolved = path.resolve(VAULT_PATH, relPath)
  if (!resolved.startsWith(path.resolve(VAULT_PATH) + path.sep) &&
      resolved !== path.resolve(VAULT_PATH)) {
    throw new Error('Path traversal detected')
  }
  return resolved
}

function noteFromFile(relPath) {
  const fullPath = safeResolvePath(relPath)
  const raw = fs.readFileSync(fullPath, 'utf-8')
  const { data, content } = matter(raw)
  const stat = fs.statSync(fullPath)
  return {
    id: relPath,
    // title 固定用檔名，讓側邊欄與檔案系統保持一致
    title: path.basename(relPath, '.md'),
    path: relPath,
    tags: extractTags(data.tags, content),
    date: formatDate(data.date) || stat.mtime.toISOString().split('T')[0],
    content,
    mtime: stat.mtime.getTime(),
  }
}

function readNotesRecursive(dir, base = '') {
  const notes = []
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return notes }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (entry.name === '_pdf' || entry.name === '_html') continue
    const fullPath = path.join(dir, entry.name)
    const relPath = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      notes.push(...readNotesRecursive(fullPath, relPath))
    } else if (entry.name.endsWith('.md')) {
      try {
        const n = noteFromFile(relPath)
        const excerpt = n.content
          .replace(/^#+\s.*/gm, '')
          .replace(/^---+$/gm, '')
          .replace(/\*\*/g, '')
          .replace(/\n+/g, ' ')
          .trim()
          .slice(0, 120)
        notes.push({ ...n, excerpt })
      } catch { }
    } else if (entry.name.toLowerCase().endsWith('.pdf')) {
      const stat = fs.statSync(path.join(dir, entry.name))
      notes.push({
        id: relPath,
        title: entry.name.replace(/\.pdf$/i, ''),
        path: relPath,
        tags: [],
        date: stat.mtime.toISOString().split('T')[0],
        mtime: stat.mtime.getTime(),
        excerpt: 'PDF 文件',
        type: 'pdf',
        url: `/vault/${relPath.replace(/\\/g, '/')}`,
      })
    }
  }
  return notes
}

// GET all notes
app.get('/api/notes', (req, res) => {
  const notes = readNotesRecursive(VAULT_PATH)
  notes.sort((a, b) => b.mtime - a.mtime)
  res.json(notes)
})

// GET single note
app.get('/api/note', (req, res) => {
  try { res.json(noteFromFile(req.query.path)) }
  catch { res.status(404).json({ error: 'Not found' }) }
})

// POST create note
app.post('/api/note/create', (req, res) => {
  let { folder = '', title = '新筆記', tags = [] } = req.body

  // 自動去掉 YYYY-MM-DD_ 前綴，日期寫進 frontmatter
  let extractedDate = null
  const datePrefix = title.match(/^(\d{4}-\d{2}-\d{2})_(.+)$/)
  if (datePrefix) {
    extractedDate = datePrefix[1]
    title = datePrefix[2]
  }

  const fileName = `${title}.md`
  const relPath = folder ? `${folder}/${fileName}` : fileName
  try {
    const fullPath = safeResolvePath(relPath)
    if (fs.existsSync(fullPath)) return res.status(409).json({ error: 'File already exists' })
    const date = extractedDate || new Date().toISOString().split('T')[0]
    const tagsLine = tags.length ? `\ntags: [${tags.join(', ')}]` : ''
    const frontmatter = `---\ntitle: ${title}${tagsLine}\ndate_created: ${date}\ndate_updated: ${date}\n---\n`
    const content = frontmatter + `\n# ${title}\n`
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, content, 'utf-8')
    res.json(noteFromFile(relPath))
  } catch { res.status(400).json({ error: 'Invalid path' }) }
})

// PUT save content（保留既有 frontmatter，H1 變動時自動 rename 檔案）
app.put('/api/note/save', (req, res) => {
  const { path: relPath, content } = req.body
  try {
    const fullPath = safeResolvePath(relPath)
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Not found' })
    const existing = fs.readFileSync(fullPath, 'utf-8')
    const { data } = matter(existing)
    data.date_updated = new Date().toISOString().split('T')[0]
    const newRaw = Object.keys(data).length > 0 ? matter.stringify(content, data) : content
    fs.writeFileSync(fullPath, newRaw, 'utf-8')

    // 若 H1 與檔名不同，自動 rename
    const newH1 = extractH1(content)
    const currentName = path.basename(relPath, '.md')
    let finalRelPath = relPath
    if (newH1 && newH1 !== currentName) {
      const dir = path.dirname(fullPath)
      const newFileName = `${newH1}.md`
      const newFullPath = path.join(dir, newFileName)
      const newRelPath = path.join(path.dirname(relPath), newFileName).replace(/\\/g, '/')
      if (!fs.existsSync(newFullPath)) {
        // 舊 HTML 也跟著 rename
        const oldHtmlPath = path.join(path.dirname(fullPath), '_html', `${currentName}.html`)
        const newHtmlPath = path.join(path.dirname(fullPath), '_html', `${newH1}.html`)
        if (fs.existsSync(oldHtmlPath)) fs.renameSync(oldHtmlPath, newHtmlPath)
        fs.renameSync(fullPath, newFullPath)
        finalRelPath = newRelPath
      }
    }

    // 若已有對應 HTML，自動重新產生
    const finalName = path.basename(finalRelPath, '.md')
    const htmlDir = path.join(path.dirname(safeResolvePath(finalRelPath)), '_html')
    const htmlPath = path.join(htmlDir, `${finalName}.html`)
    if (fs.existsSync(htmlPath)) {
      fs.writeFileSync(htmlPath, buildHtml(noteFromFile(finalRelPath)), 'utf-8')
    }

    res.json({ ...noteFromFile(finalRelPath), renamed: finalRelPath !== relPath })
  } catch { res.status(400).json({ error: 'Invalid path' }) }
})

// PUT rename
app.put('/api/note/rename', (req, res) => {
  const { path: relPath, newTitle } = req.body
  try {
    const fullPath = safeResolvePath(relPath)
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Not found' })
    const dir = path.dirname(fullPath)
    const oldName = path.basename(relPath, '.md')
    const newFileName = `${newTitle}.md`
    const newFullPath = path.join(dir, newFileName)
    const newRelPath = path.join(path.dirname(relPath), newFileName).replace(/\\/g, '/')
    safeResolvePath(newRelPath) // validate new path too
    if (fs.existsSync(newFullPath)) return res.status(409).json({ error: 'File already exists' })

    // 1. 更新 MD 內容：H1 + frontmatter html:/pdf: 路徑
    let raw = fs.readFileSync(fullPath, 'utf-8')
    const hasH1 = /^#\s+.+/m.test(raw)
    raw = hasH1 ? raw.replace(/^#\s+.+/m, `# ${newTitle}`) : `# ${newTitle}\n\n${raw}`
    // 更新 frontmatter 裡所有含 oldName 的路徑
    raw = raw.replace(new RegExp(oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newTitle)
    fs.writeFileSync(fullPath, raw, 'utf-8')

    // 2. 重命名 HTML
    const oldHtmlPath = path.join(dir, '_html', `${oldName}.html`)
    const newHtmlPath = path.join(dir, '_html', `${newTitle}.html`)
    if (fs.existsSync(oldHtmlPath)) fs.renameSync(oldHtmlPath, newHtmlPath)

    // 3. 重命名 PDF（_ref_ 命名規則：{oldName}_ref_*.pdf → {newTitle}_ref_*.pdf）
    const pdfDir = path.join(dir, '_pdf')
    if (fs.existsSync(pdfDir)) {
      const renamePdfsIn = (d) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
          const fullEntry = path.join(d, entry.name)
          if (entry.isDirectory()) { renamePdfsIn(fullEntry); continue }
          if (entry.name.startsWith(oldName + '_ref_') && entry.name.endsWith('.pdf')) {
            const newPdfName = newTitle + entry.name.slice(oldName.length)
            fs.renameSync(fullEntry, path.join(d, newPdfName))
          }
        }
      }
      renamePdfsIn(pdfDir)
    }

    // 4. 重命名 MD 本身
    fs.renameSync(fullPath, newFullPath)

    // 5. 若有 HTML，重新產生（best-effort，失敗不影響 rename）
    if (fs.existsSync(newHtmlPath)) {
      try { fs.writeFileSync(newHtmlPath, buildHtml(noteFromFile(newRelPath)), 'utf-8') }
      catch (e2) { console.error('[rename] buildHtml failed (non-fatal):', e2.message) }
    }

    res.json(noteFromFile(newRelPath))
  } catch (e) { console.error('[rename]', e.message, e.stack); res.status(400).json({ error: e.message || 'Invalid path' }) }
})

// DELETE note or PDF
app.delete('/api/note', (req, res) => {
  const relPath = req.query.path
  try {
    const fullPath = safeResolvePath(relPath)
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Not found' })
    fs.unlinkSync(fullPath)
    res.json({ ok: true })
  } catch { res.status(400).json({ error: 'Invalid path' }) }
})

// PUT update tags only (preserves frontmatter)
app.put('/api/note/tags', (req, res) => {
  const { path: relPath, tags } = req.body
  try {
    const fullPath = safeResolvePath(relPath)
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Not found' })
    const raw = fs.readFileSync(fullPath, 'utf-8')
    const parsed = matter(raw)
    parsed.data.tags = tags
    const newRaw = matter.stringify(parsed.content, parsed.data)
    fs.writeFileSync(fullPath, newRaw, 'utf-8')
    res.json(noteFromFile(relPath))
  } catch { res.status(400).json({ error: 'Invalid path' }) }
})

// PUT move note to another folder
app.put('/api/note/move', (req, res) => {
  const { path: relPath, targetFolder } = req.body
  try {
    const fullPath = safeResolvePath(relPath)
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Not found' })
    const fileName = path.basename(relPath)
    const newRelPath = targetFolder ? `${targetFolder}/${fileName}` : fileName
    const newFullPath = safeResolvePath(newRelPath)
    if (fs.existsSync(newFullPath)) return res.status(409).json({ error: 'File already exists' })
    fs.mkdirSync(path.dirname(newFullPath), { recursive: true })
    fs.renameSync(fullPath, newFullPath)
    res.json(noteFromFile(newRelPath))
  } catch { res.status(400).json({ error: 'Invalid path' }) }
})

// 檢查某個 MD 是否有對應的 _html\ HTML 檔
app.get('/api/note/has-html', (req, res) => {
  const mdPath = req.query.path
  if (!mdPath) return res.json({ exists: false })
  const dir = path.dirname(mdPath).replace(/\\/g, '/')
  const basename = path.basename(mdPath, '.md')

  // 1. 先讀 frontmatter 的 html: 欄位
  let htmlRel = null
  try {
    const mdFull = path.join(VAULT_PATH, mdPath)
    if (fs.existsSync(mdFull)) {
      const { data } = matter(fs.readFileSync(mdFull, 'utf8'))
      if (data.html) {
        // html: 欄位是相對於 MD 所在目錄的路徑
        const resolved = `${dir}/${data.html}`.replace(/\/\.\//g, '/').replace(/\\/g, '/')
        if (fs.existsSync(path.join(VAULT_PATH, resolved))) {
          htmlRel = resolved
        }
      }
    }
  } catch {}

  // 2. fallback：用 basename 推導
  if (!htmlRel) {
    const candidate = `${dir}/_html/${basename}.html`
    if (fs.existsSync(path.join(VAULT_PATH, candidate))) {
      htmlRel = candidate
    }
  }

  if (!htmlRel) return res.json({ exists: false })

  let hasSidebar = false
  try {
    const content = fs.readFileSync(path.join(VAULT_PATH, htmlRel), 'utf8')
    hasSidebar = content.includes('class="sidebar"') || content.includes("class='sidebar'") ||
      content.includes('class="nav-brand"') || content.includes("class='nav-brand'") ||
      content.includes('class="nav-section"') || content.includes("class='nav-section'")
  } catch {}
  res.json({ exists: true, hasSidebar, url: `/vault/${htmlRel}` })
})

// ── Categories ────────────────────────────────────────────────────────────────
const CATEGORIES_FILE = path.join(VAULT_PATH, '_config', 'categories.json')

function readCategories() {
  try { return JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf-8')) }
  catch { return {} }
}
function writeCategories(data) {
  fs.mkdirSync(path.dirname(CATEGORIES_FILE), { recursive: true })
  fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

// GET /api/categories
app.get('/api/categories', (_req, res) => {
  res.json(readCategories())
})

// POST /api/folder/create — 建立資料夾，存 icon/desc 到 categories.json
app.post('/api/folder/create', (req, res) => {
  const { folder, icon = '📁', desc = '', accent, bg, border } = req.body
  if (!folder) return res.status(400).json({ error: 'Missing folder' })
  try {
    const fullPath = safeResolvePath(folder)
    fs.mkdirSync(fullPath, { recursive: true })
    const cats = readCategories()
    cats[folder] = { icon, ...(desc && { desc }), ...(accent && { accent }), ...(bg && { bg }), ...(border && { border }) }
    writeCategories(cats)
    res.json({ ok: true, folder, icon })
  } catch (e) { res.status(400).json({ error: e.message }) }
})

// ── Pins ──────────────────────────────────────────────────────────────────────
const PINS_FILE = path.join(VAULT_PATH, '.kao_oak_pins.json')

function readPins() {
  try { return JSON.parse(fs.readFileSync(PINS_FILE, 'utf-8')) }
  catch { return [] }
}
function writePins(pins) {
  fs.writeFileSync(PINS_FILE, JSON.stringify(pins, null, 2), 'utf-8')
}

// GET 釘選清單
app.get('/api/pins', (_req, res) => {
  res.json(readPins())
})

// POST 切換釘選狀態
app.post('/api/pins/toggle', (req, res) => {
  const { path: notePath } = req.body
  const pins = readPins()
  const idx = pins.indexOf(notePath)
  if (idx >= 0) pins.splice(idx, 1)
  else pins.unshift(notePath) // 釘選加到最前面
  writePins(pins)
  res.json({ pins, pinned: idx < 0 })
})

// ── Full-text Search ───────────────────────────────────────────────────────────
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim()
  if (!q || q.length < 2) return res.json([])

  const notes = readNotesRecursive(VAULT_PATH)
  const results = []

  for (const n of notes) {
    // 同前端的過濾規則
    const p = n.path.replace(/\\/g, '/')
    if (p.startsWith('Wiki/')) continue
    if (p.startsWith('Clippings/Claude 官方課程/')) continue
    if (!p.includes('/')) continue

    const titleMatch = n.title.toLowerCase().includes(q)
    const tagMatch = n.tags.some(t => t.includes(q))
    const contentLower = n.content.toLowerCase()
    const contentIdx = contentLower.indexOf(q)

    if (!titleMatch && !tagMatch && contentIdx < 0) continue

    // 找到內容中匹配位置，截取上下文
    let matchExcerpt = n.excerpt || ''
    if (contentIdx >= 0) {
      const start = Math.max(0, contentIdx - 40)
      const end = Math.min(n.content.length, contentIdx + q.length + 80)
      matchExcerpt = (start > 0 ? '…' : '') +
        n.content.slice(start, end)
          .replace(/\n+/g, ' ')
          .replace(/\*\*/g, '')
          .replace(/^#{1,6}\s/gm, '') +
        (end < n.content.length ? '…' : '')
    }

    results.push({ ...n, content: undefined, matchExcerpt })
    if (results.length >= 30) break
  }

  res.json(results)
})

// ── HTML Export ────────────────────────────────────────────────────────────────
const TYPE_TAGS_SERVER = ['notes', 'sop', 'instruction', 'claude-code', 'claude']

function slugify(text) {
  return text.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w一-鿿-]/g, '')
}

function buildToc(content) {
  const stripped = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '')
  const lines = stripped.split('\n')
  const headings = []
  for (const line of lines) {
    const m = line.match(/^(#{2,4})\s+(.+)$/)
    if (m) headings.push({ level: m[1].length, text: m[2].trim() })
  }
  if (headings.length < 2) return ''
  const items = headings.map(h => {
    const indent = (h.level - 2) * 16
    const id = slugify(h.text)
    return `<a href="#${id}" style="display:block;padding:3px 8px;padding-left:${8 + indent}px;font-size:.8rem;color:var(--toc-c,#9da2ac);text-decoration:none;border-radius:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .15s" onmouseover="this.style.color='#818cf8'" onmouseout="this.style.color='var(--toc-c,#9da2ac)'">${h.text}</a>`
  }).join('\n')
  return `<nav id="toc" style="position:fixed;top:40px;left:0;width:200px;height:calc(100vh - 40px);overflow-y:auto;padding:16px 8px;border-right:1px solid rgba(255,255,255,0.07);background:#0a0a0c">
  <p style="font-size:.625rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;margin:0 0 10px;padding-left:8px">目錄</p>
  ${items}
</nav>`
}

function buildHtml(note) {
  // 讀 MD 的 H1 當顯示標題，沒有 H1 就 fallback 到檔名
  const h1 = extractH1(note.content || '') || note.title
  // 移除 content 開頭的 H1，避免與 <h1> 標籤重複
  const contentBody = (note.content || '').replace(/^#\s+.+\n?/, '')
  const toc = buildToc(contentBody)
  const hasToc = toc !== ''
  const renderer = { heading({ tokens, depth }) { const text = tokens.map(t => t.raw || '').join(''); const id = slugify(text); return `<h${depth} id="${id}">${text}</h${depth}>\n` } }
  const body = marked(contentBody, { renderer })
  const displayTags = (note.tags || []).filter(t => !TYPE_TAGS_SERVER.includes(t))
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${h1}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:'Aptos','Segoe UI',system-ui,sans-serif;font-size:14px;max-width:820px;margin:${hasToc ? '0 auto 0 220px' : '0 auto'};padding:48px 28px 80px;color:#ededed;line-height:1.75;background:#0a0a0c}
    h1{font-size:1.75rem;font-weight:700;letter-spacing:-.03em;margin:0 0 10px;color:#fff}
    h2{font-size:1.2rem;font-weight:600;margin:36px 0 10px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:8px;color:#f0f0f2}
    h3{font-size:1rem;font-weight:600;margin:24px 0 8px;color:#e0e0e2}
    p{margin:0 0 14px;color:#d0d0d4}
    pre{background:#141720;padding:16px;border-radius:8px;overflow-x:auto;font-size:13px;border:1px solid rgba(255,255,255,0.06)}
    code{font-family:'Consolas','Fira Code',monospace;font-size:.875em;background:rgba(255,255,255,0.08);padding:1px 6px;border-radius:4px;color:#c8d0ff}
    pre code{background:none;padding:0;color:#cdd6f4}
    table{border-collapse:collapse;width:100%;margin:16px 0}
    th,td{border:1px solid rgba(255,255,255,0.1);padding:8px 12px;text-align:left}
    th{background:rgba(255,255,255,0.06);font-weight:600;color:#f0f0f2}
    tr:hover td{background:rgba(255,255,255,0.03)}
    blockquote{border-left:3px solid #5E6AD2;margin:0 0 14px;padding:4px 16px;color:#9da2ac;background:rgba(94,106,210,0.06);border-radius:0 6px 6px 0}
    a{color:#818cf8}
    hr{border:none;border-top:1px solid rgba(255,255,255,0.08);margin:28px 0}
    .meta{color:#6b7280;font-size:.8rem;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;gap:10px;align-items:center;flex-wrap:wrap}
    .tag{background:rgba(94,106,210,0.15);color:#818cf8;padding:2px 9px;border-radius:99px;font-size:.7rem;font-weight:500;border:1px solid rgba(94,106,210,0.25)}
    li{margin-bottom:4px;color:#d0d0d4}
    img{max-width:100%;border-radius:8px}
    .mermaid{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:20px;margin:1.25em 0;text-align:center;overflow:auto}
    .mermaid svg{max-width:100%;height:auto}
  </style>
</head>
<body>
  ${toc}
  <h1>${h1}</h1>
  <div class="meta">
    ${note.date ? `<span>${note.date}</span>` : ''}
    ${displayTags.map(t => `<span class="tag">#${t}</span>`).join('')}
  </div>
  ${body}
  <script src="/mermaid.min.js"></script>
  <script>
    if (typeof mermaid !== 'undefined') {
      mermaid.initialize({ startOnLoad: false, theme: 'dark' });
      document.querySelectorAll('pre code.language-mermaid').forEach(function(el, i) {
        var container = document.createElement('div');
        container.className = 'mermaid';
        el.parentNode.replaceWith(container);
        mermaid.render('mermaid-html-' + i, el.textContent.trim())
          .then(function(r) { container.innerHTML = r.svg; })
          .catch(function(e) { container.textContent = 'Mermaid error: ' + e.message; });
      });
    }
  </script>
</body>
</html>`
}

app.post('/api/note/export-html', (req, res) => {
  const { path: relPath } = req.body
  try {
    safeResolvePath(relPath) // validate before proceeding
    const note = noteFromFile(relPath)
    const dir = path.dirname(relPath).replace(/\\/g, '/')
    const basename = path.basename(relPath, '.md')
    const htmlDir = safeResolvePath(`${dir}/_html`)
    const htmlRel = `${dir}/_html/${basename}.html`
    fs.mkdirSync(htmlDir, { recursive: true })
    fs.writeFileSync(path.join(htmlDir, `${basename}.html`), buildHtml(note), 'utf-8')
    res.json({ ok: true, url: `/vault/${htmlRel}` })
  } catch (e) {
    res.status(e.message === 'Path traversal detected' ? 400 : 500).json({ error: e.message })
  }
})

// ── PDF ───────────────────────────────────────────────────────────────────────
const PDF_DIR = path.join(VAULT_PATH, '_pdf')

// GET 列出所有 PDF
app.get('/api/pdfs', (_req, res) => {
  try {
    if (!fs.existsSync(PDF_DIR)) return res.json([])
    const files = fs.readdirSync(PDF_DIR)
      .filter(f => f.toLowerCase().endsWith('.pdf'))
      .sort()
    res.json(files.map(f => ({
      filename: f,
      name: f.replace(/\.pdf$/i, ''),
      url: `/vault/_pdf/${encodeURIComponent(f)}`,
    })))
  } catch { res.json([]) }
})

// POST 匯入 PDF（base64 body）
app.post('/api/pdf/import', (req, res) => {
  const { filename, data } = req.body
  if (!filename || !data) return res.status(400).json({ error: 'Missing filename or data' })
  if (!filename.toLowerCase().endsWith('.pdf')) return res.status(400).json({ error: 'Not a PDF' })
  // 防止 path traversal
  const safeName = path.basename(filename)
  try {
    fs.mkdirSync(PDF_DIR, { recursive: true })
    fs.writeFileSync(path.join(PDF_DIR, safeName), Buffer.from(data, 'base64'))
    res.json({ ok: true, filename: safeName, url: `/vault/_pdf/${encodeURIComponent(safeName)}` })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE PDF
app.delete('/api/pdf', (req, res) => {
  const safeName = path.basename(req.query.filename || '')
  if (!safeName) return res.status(400).json({ error: 'Missing filename' })
  const fullPath = path.join(PDF_DIR, safeName)
  if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Not found' })
  try { fs.unlinkSync(fullPath); res.json({ ok: true }) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

// SPA fallback — must be after all API routes
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist')
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')))
}

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Notes server running on http://localhost:${PORT}`))
