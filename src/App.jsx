import { useState, useEffect, useCallback, useRef } from 'react'
import Sidebar from './components/Sidebar'
import NoteView from './components/NoteView'
import SearchBar from './components/SearchBar'
import Background from './components/Background'
import ResizeHandle from './components/ResizeHandle'
import Dashboard from './components/Dashboard'
import Dialog, { DialogInput, DialogActions, Btn } from './components/Dialog'
import { FileText, Pencil, Trash2, SquarePen, Hash, Plus, Star, FileDown } from 'lucide-react'
import { API } from './config'
import PDFView from './components/PDFView'
const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 480
const SIDEBAR_DEFAULT = 280

export default function App() {
  const [notes, setNotes] = useState([])
  const [selected, setSelected] = useState(null)
  const [noteContent, setNoteContent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [noteLoading, setNoteLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [toast, setToast] = useState(null) // { msg, type: 'ok'|'err' }
  const [sidebarW, setSidebarW] = useState(SIDEBAR_DEFAULT)
  const [headings, setHeadings] = useState([])
  const [activeHeading, setActiveHeading] = useState(null)
  const [editing, setEditing] = useState(false)

  // PDF
  const [pdfs, setPdfs] = useState([])
  const [selectedPdf, setSelectedPdf] = useState(null)

  const loadPdfs = useCallback(() => {
    fetch(`${API}/api/pdfs`).then(r => r.json()).then(setPdfs).catch(() => {})
  }, [])
  useEffect(() => { loadPdfs() }, [loadPdfs])

  const handleSelectPdf = useCallback((pdf) => {
    setSelectedPdf(pdf)
    setSelected(null)
    setNoteContent(null)
    setEditing(false)
  }, [])

  // Pins（釘選）
  const [pins, setPins] = useState([])

  // 全文搜尋結果（null = 未搜尋，array = 搜尋結果）
  const [ftResults, setFtResults] = useState(null)

  // SearchBar ref（鍵盤快捷鍵 / 聚焦用）
  const searchRef = useRef(null)

  // Dialogs
  const [dialog, setDialog] = useState(null) // { type: 'rename'|'delete'|'create'|'addTag', ... }
  const [dialogInput, setDialogInput] = useState('')
  const [dialogTags, setDialogTags] = useState('')

  const loadNotes = useCallback(() => {
    fetch(`${API}/api/notes`)
      .then(r => r.json())
      .then(data => { setNotes(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { loadNotes() }, [loadNotes])

  // 載入釘選清單
  const loadPins = useCallback(() => {
    fetch(`${API}/api/pins`).then(r => r.json()).then(setPins).catch(() => {})
  }, [])
  useEffect(() => { loadPins() }, [loadPins])

  // 切換釘選
  const togglePin = useCallback(async (notePath) => {
    const res = await fetch(`${API}/api/pins/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: notePath }),
    })
    const { pins: newPins } = await res.json()
    setPins(newPins)
  }, [])

  // 全文搜尋（debounce 300ms）
  useEffect(() => {
    if (!search || search.length < 2) { setFtResults(null); return }
    const t = setTimeout(() => {
      fetch(`${API}/api/search?q=${encodeURIComponent(search)}`)
        .then(r => r.json())
        .then(setFtResults)
        .catch(() => setFtResults([]))
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }, [])

  // 匯入 PDF
  const handleImportPdf = useCallback(async (filename, base64) => {
    try {
      const res = await fetch(`${API}/api/pdf/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, data: base64 }),
      })
      const data = await res.json()
      if (data.ok) { loadPdfs(); showToast(`已匯入 ${data.filename}`) }
      else showToast('匯入失敗', 'err')
    } catch { showToast('匯入失敗', 'err') }
  }, [loadPdfs, showToast])

  // 匯出 HTML
  const handleExportHtml = useCallback(async () => {
    if (!noteContent) return
    try {
      const res = await fetch(`${API}/api/note/export-html`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: noteContent.path }),
      })
      const data = await res.json()
      if (data.ok) showToast('HTML 已匯出')
      else showToast('匯出失敗', 'err')
    } catch {
      showToast('匯出失敗', 'err')
    }
  }, [noteContent, showToast])

  const openNote = useCallback(async (note) => {
    if (note.type === 'pdf') {
      setSelectedPdf(note)
      setSelected(null)
      setNoteContent(null)
      setEditing(false)
      return
    }
    setSelectedPdf(null)
    setSelected(note.id)
    setEditing(false)
    setNoteLoading(true)
    setHeadings([])
    setActiveHeading(null)
    try {
      const res = await fetch(`${API}/api/note?path=${encodeURIComponent(note.path)}`)
      setNoteContent(await res.json())
    } catch { setNoteContent(null) }
    setNoteLoading(false)
  }, [])

  // 回到 Dashboard（取消選取）
  const goHome = useCallback(() => {
    setSelected(null)
    setNoteContent(null)
    setEditing(false)
    setSelectedPdf(null)
  }, [])

  const handleSave = useCallback(async (content) => {
    if (!noteContent) return
    const res = await fetch(`${API}/api/note/save`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: noteContent.path, content }),
    })
    const updated = await res.json()
    setNoteContent(updated)
    setEditing(false)
    loadNotes()
  }, [noteContent, loadNotes])

  const handleRename = useCallback(async () => {
    if (!dialogInput.trim() || !noteContent) return
    const res = await fetch(`${API}/api/note/rename`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: noteContent.path, newTitle: dialogInput.trim() }),
    })
    const data = await res.json()
    if (!res.ok) {
      alert(data.error === 'File already exists' ? '同名檔案已存在' : `重新命名失敗：${data.error}`)
      return
    }
    setSelected(data.id)
    setDialog(null)
    loadNotes()
    // 重新 fetch 完整內容（含更新後的 H1）
    setNoteLoading(true)
    try {
      const full = await fetch(`${API}/api/note?path=${encodeURIComponent(data.path)}`)
      setNoteContent(await full.json())
    } catch { setNoteContent(data) }
    setNoteLoading(false)
  }, [dialogInput, noteContent, loadNotes])

  const handleDelete = useCallback(async () => {
    if (!noteContent) return
    await fetch(`${API}/api/note?path=${encodeURIComponent(noteContent.path)}`, { method: 'DELETE' })
    setSelected(null)
    setNoteContent(null)
    setDialog(null)
    loadNotes()
  }, [noteContent, loadNotes])

  const handleMove = useCallback(async (notePath, targetFolder) => {
    await fetch(`${API}/api/note/move`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: notePath, targetFolder }),
    })
    loadNotes()
  }, [loadNotes])

  const handleCreate = useCallback(async () => {
    const title = dialogInput.trim() || '新筆記'
    const folder = dialog?.folder || ''
    const tags = dialogTags.split(',').map(t => t.trim()).filter(Boolean)
    const res = await fetch(`${API}/api/note/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, title, tags }),
    })
    if (!res.ok) { alert('已有同名檔案'); return }
    const newNote = await res.json()
    setDialog(null)
    loadNotes()
    openNote(newNote)
    setTimeout(() => setEditing(true), 100)
  }, [dialogInput, dialog, loadNotes, openNote])

  const openCreateDialog = useCallback((folder = '') => {
    setDialogInput('新筆記')
    setDialogTags('')
    setDialog({ type: 'create', folder })
  }, [])

  const filtered = notes.filter(n => {
    if (n.path.startsWith('Wiki/')) return false
    if (n.path.startsWith('Clippings/Claude 官方課程/')) return false
    if (!n.path.includes('/')) return false
    const q = search.toLowerCase()
    return !q || n.title.toLowerCase().includes(q) || n.excerpt?.toLowerCase().includes(q)
  })

  // 全域鍵盤快捷鍵（放在 filtered 定義之後，才能在 dependency 裡用它）
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.contentEditable === 'true'
      if (editing) return

      if (e.key === '/' && !isInput) {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'Escape' && !isInput) {
        if (search) setSearch('')
        else if (selected) goHome()
      } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !isInput && selected) {
        e.preventDefault()
        const idx = filtered.findIndex(n => n.id === selected)
        if (idx < 0) return
        const next = e.key === 'ArrowDown' ? idx + 1 : idx - 1
        if (next >= 0 && next < filtered.length) openNote(filtered[next])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editing, search, selected, filtered, openNote, goHome])

  const handleSidebarResize = useCallback((clientX) => {
    setSidebarW(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, clientX)))
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <Background />

      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? sidebarW : 0,
        minWidth: sidebarOpen ? sidebarW : 0,
        overflow: 'hidden',
        transition: 'width 0.15s, min-width 0.15s',
        borderRight: '1px solid var(--vp-c-divider)',
        background: 'rgba(22,22,24,0.97)',
        backdropFilter: 'blur(24px)',
        display: 'flex', flexDirection: 'column',
        zIndex: 10, flexShrink: 0, position: 'relative',
      }}>
        <Sidebar
          notes={filtered}
          loading={loading}
          selected={selected}
          onSelect={openNote}
          onCreateNote={openCreateDialog}
          onMove={handleMove}
          onToggle={() => setSidebarOpen(false)}
          onImportPdf={handleImportPdf}
        />
      </aside>

      {sidebarOpen && <ResizeHandle onResize={handleSidebarResize} onHide={() => setSidebarOpen(false)} />}

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, position: 'relative', zIndex: 1 }}>
        {/* Topbar — VitePress nav */}
        <header style={{
          height: 'var(--vp-nav-height)', display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 24px', borderBottom: '1px solid var(--vp-c-divider)',
          background: 'rgba(27,27,31,0.94)', backdropFilter: 'blur(24px)',
          flexShrink: 0, position: 'sticky', top: 0, zIndex: 20,
        }}>
          {/* 只有 sidebar 收起時才在 header 顯示漢堡按鈕 */}
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--fg-muted)', padding: 6, borderRadius: 6,
              display: 'flex', alignItems: 'center', transition: 'color 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--fg)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--fg-muted)'}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="1" y="3" width="13" height="1.5" rx="0.75" fill="currentColor"/>
                <rect x="1" y="6.75" width="13" height="1.5" rx="0.75" fill="currentColor"/>
                <rect x="1" y="10.5" width="13" height="1.5" rx="0.75" fill="currentColor"/>
              </svg>
            </button>
          )}

          <div
            onClick={goHome}
            style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 'auto', cursor: 'pointer' }}
            title="回首頁"
          >
            <div style={{
              width: 22, height: 22, borderRadius: 6,
              background: 'linear-gradient(135deg, var(--vp-c-brand-1) 0%, var(--vp-c-brand-3) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 12px var(--vp-c-brand-soft)',
            }}>
              <FileText size={11} color="white" />
            </div>
            <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--vp-c-text-1)', letterSpacing: '-0.02em' }}>
              Kao_oaK
              {!selected && <span style={{ color: 'var(--vp-c-brand-3)', marginLeft: 4, fontWeight: 400 }}>Notes</span>}
            </span>
            {(noteContent || selectedPdf) && (
              <>
                <span style={{ color: 'var(--vp-c-divider)', margin: '0 2px' }}>/</span>
                <span style={{ fontSize: '0.875rem', color: 'var(--vp-c-text-2)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {noteContent?.title ?? selectedPdf?.name}
                </span>
              </>
            )}
          </div>

          {/* Note actions */}
          {noteContent && !editing && (
            <div style={{ display: 'flex', gap: 4 }}>
              {/* 釘選按鈕 */}
              <ActionBtn
                icon={<Star size={13} fill={pins.includes(noteContent.path) ? 'currentColor' : 'none'} />}
                label={pins.includes(noteContent.path) ? '取消釘選' : '釘選'}
                onClick={() => togglePin(noteContent.path)}
                active={pins.includes(noteContent.path)}
              />
              <ActionBtn icon={<SquarePen size={13} />} label="編輯" onClick={() => setEditing(true)} />
              <ActionBtn icon={<Pencil size={13} />} label="重新命名" onClick={() => { setDialogInput(noteContent.title); setDialog({ type: 'rename' }) }} />
              <ActionBtn icon={<Hash size={13} />} label="加 Tag" onClick={() => { setDialogInput(''); setDialog({ type: 'addTag' }) }} />
              {/* 匯出 HTML */}
              <ActionBtn icon={<FileDown size={13} />} label="匯出 HTML" onClick={handleExportHtml} />
              <ActionBtn icon={<Trash2 size={13} />} label="刪除" danger onClick={() => setDialog({ type: 'delete' })} />
            </div>
          )}

          <SearchBar ref={searchRef} value={search} onChange={setSearch} />
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {selectedPdf ? (
            <PDFView
              pdf={selectedPdf}
              onDelete={() => { setSelectedPdf(null); loadNotes() }}
            />
          ) : !selected ? (
            <Dashboard
              notes={filtered}
              ftResults={ftResults}
              pins={pins}
              onTogglePin={togglePin}
              onSelect={openNote}
            />
          ) : (
            <NoteView
              note={noteContent}
              loading={noteLoading}
              editing={editing}
              onSave={handleSave}
              onCancelEdit={() => setEditing(false)}
              onStartEdit={() => setEditing(true)}
              onHeadingsChange={setHeadings}
              onActiveHeadingChange={setActiveHeading}
              headings={headings}
              activeHeading={activeHeading}
              onNoteUpdate={(updated) => { setNoteContent(updated); loadNotes() }}
            />
          )}
        </div>
      </main>

      {/* Dialogs */}
      {dialog?.type === 'rename' && (
        <Dialog title="重新命名" onClose={() => setDialog(null)}>
          <DialogInput label="新名稱" value={dialogInput} onChange={setDialogInput} onSubmit={handleRename} />
          <DialogActions>
            <Btn onClick={() => setDialog(null)}>取消</Btn>
            <Btn variant="primary" onClick={handleRename}>確認</Btn>
          </DialogActions>
        </Dialog>
      )}

      {dialog?.type === 'delete' && (
        <Dialog title="刪除筆記" onClose={() => setDialog(null)}>
          <p style={{ fontSize: '0.875rem', color: 'var(--fg-muted)', lineHeight: 1.6 }}>
            確定要刪除「<span style={{ color: 'var(--fg)', fontWeight: 500 }}>{noteContent?.title}</span>」嗎？<br />
            <span style={{ color: '#f87171', fontSize: '0.8125rem' }}>此操作無法復原。</span>
          </p>
          <DialogActions>
            <Btn onClick={() => setDialog(null)}>取消</Btn>
            <Btn variant="danger" onClick={handleDelete}>刪除</Btn>
          </DialogActions>
        </Dialog>
      )}

      {dialog?.type === 'create' && (
        <Dialog title="新增筆記" onClose={() => setDialog(null)}>
          <DialogInput label="筆記名稱" value={dialogInput} onChange={setDialogInput} placeholder="筆記名稱" onSubmit={handleCreate} />
          <div style={{ marginTop: 12 }}>
            <DialogInput label="Tags（逗號分隔，不含 #）" value={dialogTags} onChange={setDialogTags} placeholder="例：notes, workday, toi" onSubmit={handleCreate} />
          </div>
          <DialogActions>
            <Btn onClick={() => setDialog(null)}>取消</Btn>
            <Btn variant="primary" onClick={handleCreate}>建立</Btn>
          </DialogActions>
        </Dialog>
      )}

      {dialog?.type === 'addTag' && (() => {
        const commitAddTag = async () => {
          const tag = dialogInput.trim()
          if (!tag || !noteContent) return
          await handleSave(noteContent.content + `\n#${tag}`)
          setDialog(null)
        }
        return (
          <Dialog title="加入 Tag" onClose={() => setDialog(null)}>
            <DialogInput label="Tag 名稱（不含 #）" value={dialogInput} onChange={setDialogInput} placeholder="例：work、todo" onSubmit={commitAddTag} />
            <DialogActions>
              <Btn onClick={() => setDialog(null)}>取消</Btn>
              <Btn variant="primary" onClick={commitAddTag}>加入</Btn>
            </DialogActions>
          </Dialog>
        )
      })()}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, pointerEvents: 'none',
          background: toast.type === 'err' ? 'rgba(239,68,68,0.15)' : 'rgba(62,207,142,0.15)',
          border: `1px solid ${toast.type === 'err' ? 'rgba(239,68,68,0.35)' : 'rgba(62,207,142,0.35)'}`,
          color: toast.type === 'err' ? '#f87171' : '#3ecf8e',
          padding: '8px 20px', borderRadius: 8,
          fontSize: '0.8125rem', fontWeight: 500,
          animation: 'fadeUp 0.2s cubic-bezier(0.16,1,0.3,1)',
          backdropFilter: 'blur(8px)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

function ActionBtn({ icon, label, onClick, danger, active }) {
  // active = 釘選狀態（顯示為金黃色）
  const baseColor = danger ? '#f87171' : active ? '#fbbf24' : 'var(--fg-muted)'
  return (
    <button onClick={onClick} title={label} style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
      border: active ? '1px solid rgba(251,191,36,0.3)' : '1px solid transparent',
      fontSize: '0.75rem', fontWeight: 500,
      background: active ? 'rgba(251,191,36,0.08)' : 'none',
      transition: 'all 0.15s',
      color: baseColor,
    }}
      onMouseEnter={e => {
        e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.1)' : active ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.06)'
        e.currentTarget.style.borderColor = danger ? 'rgba(239,68,68,0.3)' : active ? 'rgba(251,191,36,0.4)' : 'var(--border)'
        e.currentTarget.style.color = danger ? '#f87171' : active ? '#fbbf24' : 'var(--fg)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = active ? 'rgba(251,191,36,0.08)' : 'none'
        e.currentTarget.style.borderColor = active ? 'rgba(251,191,36,0.3)' : 'transparent'
        e.currentTarget.style.color = baseColor
      }}
    >
      {icon}
      <span style={{ fontSize: '0.6875rem' }}>{label}</span>
    </button>
  )
}
