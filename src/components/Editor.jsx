import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { Save, X, Eye, Code2 } from 'lucide-react'

export default function Editor({ note, onSave, onCancel }) {
  const [content, setContent] = useState(note.content || '')
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    await onSave(content)
    setSaving(false)
  }

  const handleKeyDown = (e) => {
    // Ctrl+S to save
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); handleSave() }
    // Esc to cancel
    if (e.key === 'Escape') onCancel()
    // Tab → insert 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault()
      const el = textareaRef.current
      const start = el.selectionStart
      const end = el.selectionEnd
      const newVal = content.slice(0, start) + '  ' + content.slice(end)
      setContent(newVal)
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2
      })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Editor toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 16px', borderBottom: '1px solid var(--border)',
        background: 'rgba(5,5,6,0.6)', flexShrink: 0,
      }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', marginRight: 'auto' }}>
          편집 중: <span style={{ color: 'var(--fg)' }}>{note.title}</span>
          <span style={{ fontSize: '0.6875rem', marginLeft: 8, opacity: 0.5 }}>Ctrl+S 儲存 · Esc 取消</span>
        </span>

        <button onClick={() => setPreview(p => !p)} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
          border: '1px solid var(--border)', fontSize: '0.75rem',
          background: preview ? 'rgba(94,106,210,0.15)' : 'rgba(255,255,255,0.04)',
          color: preview ? '#818cf8' : 'var(--fg-muted)',
          transition: 'all 0.15s',
        }}>
          {preview ? <Code2 size={12} /> : <Eye size={12} />}
          {preview ? '編輯' : '預覽'}
        </button>

        <button onClick={onCancel} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
          border: '1px solid var(--border)', fontSize: '0.75rem',
          background: 'rgba(255,255,255,0.04)', color: 'var(--fg-muted)',
        }}>
          <X size={12} /> 取消
        </button>

        <button onClick={handleSave} disabled={saving} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
          border: '1px solid rgba(94,106,210,0.5)', fontSize: '0.75rem',
          background: 'rgba(94,106,210,0.2)', color: '#818cf8',
          fontWeight: 500, opacity: saving ? 0.6 : 1,
          boxShadow: '0 0 12px rgba(94,106,210,0.15)',
        }}>
          <Save size={12} /> {saving ? '儲存中…' : '儲存'}
        </button>
      </div>

      {/* Editor body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {!preview ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            style={{
              flex: 1, resize: 'none', border: 'none', outline: 'none',
              background: 'transparent', color: 'var(--fg)',
              fontFamily: "'Fira Code', 'Consolas', monospace",
              fontSize: '0.875rem', lineHeight: 1.7,
              padding: '28px 40px',
              caretColor: '#818cf8',
            }}
          />
        ) : (
          <div style={{ flex: 1, overflow: 'auto', padding: '28px 40px', maxWidth: 720, margin: '0 auto', width: '100%' }}>
            <div className="prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {content}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
