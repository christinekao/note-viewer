import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import MDEditor from '@uiw/react-md-editor'
import rehypeHighlight from 'rehype-highlight'
import { Hash, Loader2, Save, X, Pencil, Check } from 'lucide-react'
import CodeBlock from './CodeBlock'
import MermaidChart from './MermaidChart'
import { API } from '../config'
const TYPE_TAGS = ['notes', 'sop', 'instruction', 'claude-code', 'claude']

// Split content into alternating md/mermaid segments so mermaid never goes through react-markdown
function splitContent(content) {
  if (!content) return [{ type: 'md', text: '' }]
  const segments = []
  const regex = /```mermaid[^\n]*\n([\s\S]*?)```/g
  let lastIndex = 0, match
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) segments.push({ type: 'md', text: content.slice(lastIndex, match.index) })
    segments.push({ type: 'mermaid', code: match[1].trim() })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < content.length) segments.push({ type: 'md', text: content.slice(lastIndex) })
  return segments.length ? segments : [{ type: 'md', text: content }]
}

export default function NoteView({
  note, loading, editing,
  onSave, onCancelEdit, onStartEdit,
  onHeadingsChange, onActiveHeadingChange,
  headings, activeHeading, onNoteUpdate,
}) {
  const contentRef = useRef(null)
  const iframeRef = useRef(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [tocW, setTocW] = useState(180)
  const tocDragStart = useRef(null) // { x, w }
  const rafId = useRef(null)
  const [htmlUrl, setHtmlUrl] = useState(null)
  const [showHtml, setShowHtml] = useState(false)
  const [htmlHasSidebar, setHtmlHasSidebar] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameVal, setRenameVal] = useState('')
  const [renameLoading, setRenameLoading] = useState(false)
  const renameInputRef = useRef(null)

  // 每次切換 note 時，重設 showHtml 並檢查是否有對應 HTML
  useEffect(() => {
    setShowHtml(false)
    setHtmlHasSidebar(false)
    if (!note?.path) { setHtmlUrl(null); return }
    fetch(`${API}/api/note/has-html?path=${encodeURIComponent(note.path)}`)
      .then(r => r.json())
      .then(({ exists, url, hasSidebar }) => {
        if (exists) {
          // encode each path segment (space→%20, &→%26 etc.) but keep /
          const encoded = url.split('/').map(seg => encodeURIComponent(seg)).join('/')
          setHtmlUrl(encoded)
        } else {
          setHtmlUrl(null)
        }
        setShowHtml(exists)
        setHtmlHasSidebar(!!hasSidebar)
      })
      .catch(() => setHtmlUrl(null))
  }, [note?.path])

  useEffect(() => {
    if (editing && note) setDraft(note.content || '')
  }, [editing, note?.id])

  const doRename = useCallback(async () => {
    const newTitle = renameVal.trim()
    if (!newTitle || newTitle === note.title) { setRenaming(false); return }
    setRenameLoading(true)
    try {
      const r = await fetch(`${API}/api/note/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: note.path, newTitle }),
      })
      if (!r.ok) { const e = await r.json(); alert(e.error || 'Rename failed'); return }
      const updated = await r.json()
      onNoteUpdate(updated)
      setRenaming(false)
    } finally {
      setRenameLoading(false)
    }
  }, [renameVal, note, onNoteUpdate])

  // Extract headings
  useEffect(() => {
    if (!note?.content) { onHeadingsChange([]); return }
    const lines = note.content.split('\n')
    const found = []
    lines.forEach((line, i) => {
      const m = line.match(/^(#{1,3})\s+(.+)/)
      if (m) {
        const id = `h-${i}-` + m[2].toLowerCase().replace(/[^\w一-鿿]+/g, '-').replace(/^-|-$/g, '')
        found.push({ level: m[1].length, text: m[2], id })
      }
    })
    onHeadingsChange(found)
    onActiveHeadingChange(null)
  }, [note?.id, note?.content, onHeadingsChange, onActiveHeadingChange])

  // IntersectionObserver for TOC
  useEffect(() => {
    if (!contentRef.current || editing) return
    const els = contentRef.current.querySelectorAll('h1,h2,h3')
    if (!els.length) return
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) onActiveHeadingChange(e.target.id) })
    }, { rootMargin: '-10% 0px -70% 0px' })
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [note?.id, editing, onActiveHeadingChange])

  const handleSave = useCallback(async () => {
    setSaving(true)
    await onSave(draft)
    setSaving(false)
  }, [draft, onSave])

  // Keyboard shortcuts
  useEffect(() => {
    if (!editing) return
    const h = (e) => {
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); handleSave() }
      if (e.key === 'Escape') onCancelEdit()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [editing, draft, handleSave, onCancelEdit])

  // TOC drag — must be before any early return to satisfy Rules of Hooks
  useEffect(() => {
    const onMove = (e) => {
      if (!tocDragStart.current) return
      if (rafId.current) cancelAnimationFrame(rafId.current)
      rafId.current = requestAnimationFrame(() => {
        const delta = e.clientX - tocDragStart.current.x
        setTocW(Math.min(400, Math.max(120, tocDragStart.current.w + delta)))
      })
    }
    const onUp = () => {
      if (!tocDragStart.current) return
      if (rafId.current) { cancelAnimationFrame(rafId.current); rafId.current = null }
      tocDragStart.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Loader2 size={18} color="var(--fg-muted)" style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (!note) return null

  // ── EDIT MODE ──
  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }} data-color-mode="dark">
        <MDEditor
          value={draft}
          onChange={val => setDraft(val || '')}
          height="100%"
          preview="live"
          style={{ flex: 1, background: '#080809', border: 'none', borderRadius: 0 }}
          visibleDragbar={false}
        />

        {/* Floating save bar */}
        <div style={{
          position: 'fixed', bottom: 24, right: 28, zIndex: 200,
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#0d0d10', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, padding: '8px 12px',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.5)',
          animation: 'fadeUp 0.2s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <span style={{ fontSize: '0.6875rem', color: 'var(--fg-muted)', marginRight: 4 }}>Ctrl+S · Esc</span>
          <button onClick={onCancelEdit} style={btnStyle('default')}><X size={12} /> 取消</button>
          <button onClick={handleSave} disabled={saving} style={{ ...btnStyle('primary'), opacity: saving ? 0.6 : 1 }}>
            <Save size={12} /> {saving ? '儲存中…' : '儲存'}
          </button>
        </div>
      </div>
    )
  }

  // ── VIEW MODE：有 HTML → 顯示 iframe ──
  if (htmlUrl && showHtml && !editing) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            padding: '8px 20px', borderBottom: '1px solid var(--border)',
            background: 'var(--vp-c-bg)', gap: 8, flexShrink: 0,
          }}>
            <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 4, background: 'rgba(79,142,247,0.15)', color: 'var(--vp-c-brand)', border: '1px solid rgba(79,142,247,0.3)' }}>HTML</span>
            <button onClick={onStartEdit} style={btnStyle('default')} title="編輯 MD 原始檔">編輯 MD</button>
            <button onClick={() => setShowHtml(false)} style={btnStyle('default')} title="回到 Markdown 檢視">← 回 MD 檢視</button>
          </div>
          <iframe
            ref={iframeRef}
            src={htmlUrl}
            style={{ flex: 1, border: 'none', width: '100%' }}
            title={note.title}
          />
        </div>
      </div>
    )
  }

  // ── VIEW MODE ──
  return (
    <div id="main-content-area" style={{ display: 'flex', height: '100%' }}>

      {/* TOC — left side */}
      {headings && headings.length > 1 && (
        <aside style={{
          width: tocW, flexShrink: 0, padding: '44px 0 44px 16px',
          position: 'sticky', top: 'var(--vp-nav-height)', alignSelf: 'flex-start',
          maxHeight: 'calc(100vh - var(--vp-nav-height))', overflowY: 'auto',
          borderRight: '1px solid var(--vp-c-divider)',
        }}>
          <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 10, paddingLeft: 8 }}>目錄</p>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {headings.map(h => {
              const isActive = activeHeading === h.id
              return (
                <a key={h.id} href={`#${h.id}`}
                  onClick={e => {
                    e.preventDefault()
                    const el = contentRef.current?.querySelector(`#${CSS.escape(h.id)}`)
                    if (el && contentRef.current) {
                      const elRect = el.getBoundingClientRect()
                      const containerRect = contentRef.current.getBoundingClientRect()
                      contentRef.current.scrollBy({ top: elRect.top - containerRect.top - 16, behavior: 'smooth' })
                    }
                  }}
                  style={{
                    display: 'block', textDecoration: 'none', padding: '3px 8px',
                    paddingLeft: h.level === 1 ? 8 : h.level === 2 ? 16 : 24,
                    borderRadius: 5, fontSize: '0.75rem', lineHeight: 1.5,
                    color: isActive ? '#818cf8' : 'var(--fg-muted)',
                    background: isActive ? 'rgba(94,106,210,0.1)' : 'transparent',
                    borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                    transition: 'all 0.15s', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--fg)' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--fg-muted)' }}
                >
                  {h.text}
                </a>
              )
            })}
          </nav>
        </aside>
      )}

      {/* TOC resize handle */}
      {headings && headings.length > 1 && (
        <div
          onMouseDown={(e) => { tocDragStart.current = { x: e.clientX, w: tocW }; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none' }}
          style={{ width: 16, alignSelf: 'stretch', cursor: 'col-resize', flexShrink: 0, transition: 'background 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(94,106,210,0.25)'}
          onMouseLeave={e => { if (!tocDragStart.current) e.currentTarget.style.background = 'transparent' }}
        >
          <div style={{ width: 3, height: 32, borderRadius: 2, background: 'rgba(94,106,210,0.4)', pointerEvents: 'none' }} />
        </div>
      )}

      <article
        ref={contentRef}
        style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '44px 48px 80px', animation: 'fadeUp 0.3s cubic-bezier(0.16,1,0.3,1)' }}
      >
        <div style={{ marginBottom: 36, paddingBottom: 28, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            {renaming ? (
              <>
                <input
                  ref={renameInputRef}
                  value={renameVal}
                  onChange={e => setRenameVal(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter') await doRename()
                    if (e.key === 'Escape') setRenaming(false)
                  }}
                  style={{
                    flex: 1, fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.03em',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--vp-c-brand)',
                    borderRadius: 6, padding: '4px 10px', color: '#fff', outline: 'none',
                  }}
                />
                <button onClick={doRename} disabled={renameLoading} style={btnStyle('primary')} title="確認改名">
                  {renameLoading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={12} />}
                </button>
                <button onClick={() => setRenaming(false)} style={btnStyle('default')} title="取消"><X size={12} /></button>
              </>
            ) : (
              <>
                <h1 style={{
                  fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.25,
                  background: 'linear-gradient(to bottom, #fff 0%, rgba(237,237,239,0.85) 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0,
                }}>
                  {note.title}
                </h1>
                <button
                  onClick={() => { setRenameVal(note.title); setRenaming(true); setTimeout(() => renameInputRef.current?.select(), 50) }}
                  style={{ ...btnStyle('default'), padding: '3px 7px', opacity: 0.5, flexShrink: 0 }}
                  title="改名"
                ><Pencil size={11} /></button>
              </>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {note.date && <span style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)' }}>{note.date}</span>}
            <TagEditor note={note} onNoteUpdate={onNoteUpdate} />
            {htmlUrl && (
              <button
                onClick={() => setShowHtml(true)}
                style={{ ...btnStyle('primary'), fontSize: '0.6875rem', padding: '2px 10px' }}
                title="切換到 HTML 檢視"
              >HTML 版本</button>
            )}
          </div>
        </div>

        <div className="prose">
          {splitContent(note.content).map((seg, i) =>
            seg.type === 'mermaid' ? (
              <MermaidChart key={i} code={seg.code} />
            ) : (
              <ReactMarkdown
                key={i}
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, [rehypeHighlight, { ignoreMissing: true }]]}
                components={{
                  h1: () => null,
                  h2: ({ children }) => <HeadingWithId level={2} note={note}>{children}</HeadingWithId>,
                  h3: ({ children }) => <HeadingWithId level={3} note={note}>{children}</HeadingWithId>,
                  a({ href, children, ...props }) {
                    if (href?.startsWith('#')) {
                      return <a href={href} {...props} onClick={e => {
                        e.preventDefault()
                        const container = contentRef.current
                        if (!container) return
                        const raw = decodeURIComponent(href.slice(1))
                        let el = container.querySelector(`[id="${raw}"]`)
                        if (!el) {
                          // 用 link 文字內容比對 heading text
                          const linkText = e.currentTarget.textContent.replace(/^\d+\.\s*/, '').trim().toLowerCase()
                          el = Array.from(container.querySelectorAll('h1,h2,h3,h4,h5,h6'))
                            .find(h => h.textContent.toLowerCase().includes(linkText))
                        }
                        if (el) {
                          const elRect = el.getBoundingClientRect()
                          const containerRect = container.getBoundingClientRect()
                          container.scrollBy({ top: elRect.top - containerRect.top - 16, behavior: 'smooth' })
                        }
                      }}>{children}</a>
                    }
                    return <a href={href} target="_blank" rel="noreferrer" {...props}>{children}</a>
                  },
                  pre({ node, children }) {
                    const codeNode = node?.children?.[0]
                    const cls = codeNode?.properties?.className || []
                    if (cls.includes('language-mermaid')) {
                      const text = codeNode?.children?.[0]?.value || ''
                      return <MermaidChart code={text.trim()} />
                    }
                    return <CodeBlock>{children}</CodeBlock>
                  },
                }}
              >
                {seg.text}
              </ReactMarkdown>
            )
          )}
        </div>
      </article>

    </div>
  )
}

const btnStyle = (v) => ({
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500,
  ...(v === 'primary'
    ? { border: '1px solid rgba(94,106,210,0.5)', background: 'rgba(94,106,210,0.2)', color: '#818cf8', boxShadow: '0 0 12px rgba(94,106,210,0.15)' }
    : { border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: 'var(--fg-muted)' })
})

function HeadingWithId({ level, children, note }) {
  const text = flattenChildren(children)
  const lines = (note?.content || '').split('\n')
  const idx = lines.findIndex(l => l.match(new RegExp(`^#{${level}}\\s+${escapeRe(text)}`)))
  const id = idx >= 0
    ? `h-${idx}-` + text.toLowerCase().replace(/[^\w一-鿿]+/g, '-').replace(/^-|-$/g, '')
    : text.toLowerCase().replace(/\s+/g, '-')
  const Tag = `h${level}`
  return <Tag id={id}>{children}</Tag>
}

function flattenChildren(c) {
  if (typeof c === 'string') return c
  if (Array.isArray(c)) return c.map(flattenChildren).join('')
  if (c?.props?.children) return flattenChildren(c.props.children)
  return ''
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

// ── Tag Editor ──
function TagEditor({ note, onNoteUpdate }) {
  // 分離：type tags（隱藏但保留）vs 顯示 tags
  const typeTags = useMemo(() => (note.tags || []).filter(t => TYPE_TAGS.includes(t)), [note.tags])
  const [tags, setTags] = useState(() => (note.tags || []).filter(t => !TYPE_TAGS.includes(t)))
  const [editIdx, setEditIdx] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [adding, setAdding] = useState(false)
  const [addVal, setAddVal] = useState('')
  const [dragIdx, setDragIdx] = useState(null)

  // note 切換時重設
  useEffect(() => {
    setTags((note.tags || []).filter(t => !TYPE_TAGS.includes(t)))
    setEditIdx(null); setAdding(false)
  }, [note.id])

  const save = useCallback(async (newTags) => {
    const allTags = [...typeTags, ...newTags]
    const res = await fetch(`${API}/api/note/tags`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: note.path, tags: allTags }),
    })
    const updated = await res.json()
    onNoteUpdate && onNoteUpdate(updated)
  }, [note.path, typeTags, onNoteUpdate])

  const commitEdit = useCallback(async () => {
    if (editIdx === null) return
    const newTags = [...tags]
    const val = editVal.trim().replace(/^#/, '')
    if (val) newTags[editIdx] = val
    else newTags.splice(editIdx, 1)
    setTags(newTags); setEditIdx(null)
    await save(newTags)
  }, [editIdx, editVal, tags, save])

  const deleteTag = useCallback(async (i) => {
    const newTags = tags.filter((_, idx) => idx !== i)
    setTags(newTags)
    await save(newTags)
  }, [tags, save])

  const commitAdd = useCallback(async () => {
    const val = addVal.trim().replace(/^#/, '')
    setAdding(false); setAddVal('')
    if (!val) return
    const newTags = [...tags, val]
    setTags(newTags)
    await save(newTags)
  }, [addVal, tags, save])

  // Drag to reorder
  const onDragStart = (i) => setDragIdx(i)
  const onDragOver = (e, i) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === i) return
    const t = [...tags]
    const [moved] = t.splice(dragIdx, 1)
    t.splice(i, 0, moved)
    setTags(t); setDragIdx(i)
  }
  const onDragEnd = async () => { setDragIdx(null); await save(tags) }

  const chipStyle = (dragging) => ({
    display: 'inline-flex', alignItems: 'center', gap: 3,
    fontSize: '0.6875rem', fontWeight: 500, padding: '2px 6px 2px 8px', borderRadius: 99,
    background: 'rgba(94,106,210,0.1)', color: '#818cf8',
    border: '1px solid rgba(94,106,210,0.22)',
    cursor: 'grab', userSelect: 'none',
    opacity: dragging ? 0.35 : 1, transition: 'opacity 0.1s',
  })

  const inputStyle = {
    fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 99,
    background: 'rgba(94,106,210,0.15)', color: '#818cf8',
    border: '1px solid rgba(94,106,210,0.5)', outline: 'none',
    minWidth: 50,
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
      {tags.map((tag, i) => (
        editIdx === i ? (
          <input
            key={i} autoFocus value={editVal}
            onChange={e => setEditVal(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditIdx(null) }}
            style={{ ...inputStyle, width: Math.max(50, editVal.length * 9) }}
          />
        ) : (
          <span
            key={i}
            draggable
            onDragStart={() => onDragStart(i)}
            onDragOver={e => onDragOver(e, i)}
            onDragEnd={onDragEnd}
            style={chipStyle(dragIdx === i)}
          >
            <Hash size={9} />
            <span onClick={() => { setEditIdx(i); setEditVal(tag) }} style={{ cursor: 'text' }}>{tag}</span>
            <button
              onClick={() => deleteTag(i)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 2px', color: '#818cf8', opacity: 0.5, lineHeight: 1, fontSize: '0.75rem' }}
            >×</button>
          </span>
        )
      ))}

      {adding ? (
        <input
          autoFocus value={addVal} placeholder="新 tag"
          onChange={e => setAddVal(e.target.value)}
          onBlur={commitAdd}
          onKeyDown={e => { if (e.key === 'Enter') commitAdd(); if (e.key === 'Escape') { setAdding(false); setAddVal('') } }}
          style={{ ...inputStyle, width: 70 }}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{
            fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 99,
            background: 'none', color: 'var(--fg-muted)',
            border: '1px dashed rgba(255,255,255,0.15)', cursor: 'pointer',
          }}
        >+ tag</button>
      )}
    </div>
  )
}
