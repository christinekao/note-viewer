import { useState, useMemo, useRef } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, Plus, FileType } from 'lucide-react'

const COLLAPSE_FOLDERS = ['Clippings']

function buildTree(notes) {
  const root = { children: {}, notes: [], actualPath: '' }
  notes.forEach(note => {
    let parts = note.path.replace(/\\/g, '/').split('/')
    let collapsedPrefix = null
    if (parts.length > 1 && COLLAPSE_FOLDERS.includes(parts[0])) {
      collapsedPrefix = parts[0]
      parts = parts.slice(1)
    }
    const displayFolders = parts.slice(0, -1)
    let node = root
    let currentActualPath = collapsedPrefix || ''
    displayFolders.forEach(folder => {
      currentActualPath = currentActualPath ? `${currentActualPath}/${folder}` : folder
      if (!node.children[folder]) {
        node.children[folder] = { children: {}, notes: [], actualPath: currentActualPath }
      }
      node = node.children[folder]
    })
    node.notes.push(note)
  })
  return root
}

export default function Sidebar({ notes, loading, selected, onSelect, onCreateNote, onMove, onToggle, onImportPdf }) {
  const [collapsed, setCollapsed] = useState({})
  const tree = useMemo(() => buildTree(notes), [notes])
  const toggle = (path) => setCollapsed(p => ({ ...p, [path]: !p[path] }))
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]
      onImportPdf(file.name, base64)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      minWidth: 'var(--sidebar-w)', overflow: 'hidden',
    }}>

      {/* Sidebar header */}
      <div style={{
        height: 'var(--vp-nav-height)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px',
        borderBottom: '1px solid var(--vp-c-divider)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--vp-c-text-2)', letterSpacing: '0.05em' }}>
          Kao_oaK Notes
        </span>
        <button
          onClick={onToggle}
          title="收起側邊欄"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--vp-c-text-3)', padding: 4, borderRadius: 5,
            display: 'flex', alignItems: 'center',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--vp-c-text-1)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--vp-c-text-3)'}
        >
          <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
            <rect x="1" y="3"    width="13" height="1.5" rx="0.75" fill="currentColor"/>
            <rect x="1" y="6.75" width="13" height="1.5" rx="0.75" fill="currentColor"/>
            <rect x="1" y="10.5" width="13" height="1.5" rx="0.75" fill="currentColor"/>
          </svg>
        </button>
      </div>

      {/* File tree */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 8px 16px', minHeight: 0 }}>

        {/* Section header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 8px', marginBottom: 8,
        }}>
          <span style={sectionLabelStyle}>
            筆記 {notes.length > 0 && <span style={{ opacity: 0.5 }}>({notes.length})</span>}
          </span>
          <button
            onClick={() => onCreateNote('')}
            title="新增筆記"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--vp-c-text-3)', display: 'flex', padding: '2px 4px',
              borderRadius: 4,
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--vp-c-brand-1)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--vp-c-text-3)'}
          >
            <Plus size={13} />
          </button>
        </div>

        {loading ? <LoadingDots /> : (
          <TreeNode
            node={tree}
            path=""
            depth={0}
            collapsed={collapsed}
            toggle={toggle}
            selected={selected}
            onSelect={onSelect}
            onMove={onMove}
          />
        )}

      </div>
    </div>
  )
}

function TreeNode({ node, path, depth, collapsed, toggle, selected, onSelect, onMove }) {
  const [dragOver, setDragOver] = useState(null)

  const handleDragOver = (e, folderName) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(folderName) }
  const handleDragLeave = () => setDragOver(null)
  const handleDrop = (e, child) => {
    e.preventDefault(); setDragOver(null)
    const notePath = e.dataTransfer.getData('text/plain')
    if (!notePath || !onMove) return
    const currentFolder = notePath.replace(/\\/g, '/').split('/').slice(0, -1).join('/')
    if (currentFolder === child.actualPath) return
    onMove(notePath, child.actualPath)
  }

  return (
    <div>
      {Object.entries(node.children)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, child]) => {
          const fullPath = path ? `${path}/${name}` : name
          const isCollapsed = collapsed[fullPath]
          const isDropTarget = dragOver === name

          return (
            <div key={fullPath}>
              {/* Folder row */}
              <button
                onClick={() => toggle(fullPath)}
                onDragOver={e => handleDragOver(e, name)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, child)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 8px',
                  paddingLeft: 8 + depth * 12,
                  borderRadius: 6,
                  border: isDropTarget ? '1px dashed var(--vp-c-brand-2)' : '1px solid transparent',
                  background: isDropTarget ? 'var(--vp-c-brand-soft)' : 'none',
                  cursor: 'pointer',
                  color: isDropTarget ? 'var(--vp-c-brand-1)' : 'var(--vp-c-text-2)',
                  transition: 'all 0.12s',
                  marginBottom: 1,
                }}
                onMouseEnter={e => { if (!isDropTarget) e.currentTarget.style.background = 'var(--vp-c-bg-elv)' }}
                onMouseLeave={e => { if (!isDropTarget) e.currentTarget.style.background = 'none' }}
              >
                <span style={{ color: 'var(--vp-c-text-3)', flexShrink: 0 }}>
                  {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                </span>
                {isDropTarget
                  ? <FolderOpen size={12} color="var(--vp-c-brand-1)" style={{ flexShrink: 0 }} />
                  : isCollapsed
                    ? <Folder size={12} color="var(--vp-c-brand-1)" style={{ opacity: 0.7, flexShrink: 0 }} />
                    : <FolderOpen size={12} color="var(--vp-c-brand-1)" style={{ flexShrink: 0 }} />
                }
                <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {name}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '0.625rem', color: 'var(--vp-c-text-3)', paddingRight: 2, flexShrink: 0 }}>
                  {countNotes(child)}
                </span>
              </button>

              {!isCollapsed && (
                <div style={{
                  marginLeft: 8 + depth * 12,
                  borderLeft: '1px solid var(--vp-c-divider)',
                  paddingLeft: 8, marginBottom: 2,
                }}>
                  <TreeNode
                    node={child} path={fullPath} depth={depth + 1}
                    collapsed={collapsed} toggle={toggle}
                    selected={selected} onSelect={onSelect} onMove={onMove}
                  />
                </div>
              )}
            </div>
          )
        })}

      {node.notes
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((note, i) => (
          <NoteItem
            key={note.id} note={note}
            isSelected={selected === note.id}
            onSelect={onSelect} depth={depth}
            delay={i * 0.02}
          />
        ))}
    </div>
  )
}

function countNotes(node) {
  return node.notes.length + Object.values(node.children).reduce((s, c) => s + countNotes(c), 0)
}

function NoteItem({ note, isSelected, onSelect, depth = 0, delay }) {
  const isPdf = note.type === 'pdf'
  const handleDragStart = (e) => {
    if (isPdf) return
    e.dataTransfer.setData('text/plain', note.path)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <button
      draggable={!isPdf}
      onDragStart={handleDragStart}
      onClick={() => onSelect(note)}
      style={{
        width: '100%', textAlign: 'left',
        padding: '5px 8px',
        paddingLeft: 8 + depth * 12,
        borderRadius: isSelected ? '0 6px 6px 0' : 6,
        border: '1px solid transparent',
        borderLeft: isSelected
          ? `2px solid ${isPdf ? '#f97316' : 'var(--vp-c-brand-1)'}`
          : '2px solid transparent',
        background: isSelected
          ? isPdf ? 'rgba(249,115,22,0.08)' : 'var(--vp-c-brand-soft)'
          : 'transparent',
        cursor: 'pointer', marginBottom: 1,
        transition: 'all 0.12s',
        animation: 'fadeUp 0.25s cubic-bezier(0.16,1,0.3,1) both',
        animationDelay: `${delay}s`,
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--vp-c-bg-elv)' }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {isPdf
          ? <FileType size={11} color={isSelected ? '#f97316' : '#9a6b4b'} style={{ flexShrink: 0 }} />
          : <FileText size={11} color={isSelected ? 'var(--vp-c-brand-1)' : 'var(--vp-c-text-3)'} style={{ flexShrink: 0 }} />
        }
        <span style={{
          fontSize: '0.8125rem',
          fontWeight: isSelected ? 500 : 400,
          color: isSelected
            ? isPdf ? '#f97316' : 'var(--vp-c-brand-1)'
            : 'var(--vp-c-text-2)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {note.title}
        </span>
      </div>
    </button>
  )
}

const sectionLabelStyle = {
  fontSize: '0.6875rem', fontWeight: 700,
  letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--vp-c-text-2)',
}

function LoadingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '16px 8px', justifyContent: 'center' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 4, height: 4, borderRadius: '50%',
          background: 'var(--vp-c-text-3)',
          animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:0.3}50%{opacity:0.8}}`}</style>
    </div>
  )
}
