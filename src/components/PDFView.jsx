import { FileText, Trash2 } from 'lucide-react'

export default function PDFView({ pdf, onDelete }) {
  const handleDelete = async () => {
    if (!confirm(`確定要從 vault 刪除「${pdf.name}」？`)) return
    await fetch(`http://localhost:3001/api/note?path=${encodeURIComponent(pdf.path)}`, { method: 'DELETE' })
    onDelete()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 16px', height: 40, flexShrink: 0,
        borderBottom: '1px solid var(--vp-c-divider)',
        background: 'rgba(27,27,31,0.94)',
      }}>
        <FileText size={13} color="var(--vp-c-brand-1)" />
        <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--vp-c-text-1)', flex: 1 }}>
          {pdf.name}
        </span>
        <button
          onClick={handleDelete}
          title="從 vault 刪除"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--fg-muted)', padding: '4px 8px', borderRadius: 6,
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: '0.6875rem', transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--fg-muted)'}
        >
          <Trash2 size={12} />
          <span>刪除</span>
        </button>
      </div>

      {/* PDF iframe — 瀏覽器原生渲染，圖片完整保留 */}
      <iframe
        src={pdf.url}
        style={{ flex: 1, border: 'none', width: '100%', background: '#fff' }}
        title={pdf.name}
      />
    </div>
  )
}
