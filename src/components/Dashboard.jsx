import { useState, useMemo, useEffect } from 'react'
import { Star, Search } from 'lucide-react'

const CATEGORY_META = {
  'Workday':           { icon: '🏢', accent: '#60a5fa', bg: 'rgba(96,165,250,0.08)',   border: 'rgba(96,165,250,0.18)',  desc: 'EA 設定、BP 流程、Integration、Payroll' },
  'Azure Data Explorer': { icon: '📊', accent: '#3ecf8e', bg: 'rgba(62,207,142,0.08)', border: 'rgba(62,207,142,0.18)', desc: '資料查詢、ETL、Kusto 語法' },
  'Power_Automate':    { icon: '⚡', accent: '#f5a623', bg: 'rgba(245,166,35,0.08)',   border: 'rgba(245,166,35,0.18)',  desc: '自動化流程、寄信、觸發設定' },
  'Claude Code':       { icon: '🤖', accent: '#818cf8', bg: 'rgba(129,140,248,0.08)',  border: 'rgba(129,140,248,0.18)', desc: 'Skills、MCP、Session 筆記' },
  'MCP':               { icon: '🔌', accent: '#f472b6', bg: 'rgba(244,114,182,0.08)',  border: 'rgba(244,114,182,0.18)', desc: 'Model Context Protocol 整合設定' },
  'AppIQ':             { icon: '📱', accent: '#fb923c', bg: 'rgba(251,146,60,0.08)',   border: 'rgba(251,146,60,0.18)',  desc: 'AppIQ 系統操作與設定' },
  'Onboarding':        { icon: '🚀', accent: '#34d399', bg: 'rgba(52,211,153,0.08)',   border: 'rgba(52,211,153,0.18)',  desc: '新人入職流程與資源' },
  'Skill':             { icon: '🎯', accent: '#c084fc', bg: 'rgba(192,132,252,0.08)',  border: 'rgba(192,132,252,0.18)', desc: 'Claude Code Skill 開發與設定' },
  'TrendAI':           { icon: '✨', accent: '#38bdf8', bg: 'rgba(56,189,248,0.08)',   border: 'rgba(56,189,248,0.18)',  desc: 'Trend Micro AI 工具與應用' },
}
const DEFAULT_META = { icon: '📁', accent: '#9DA2AC', bg: 'rgba(157,162,172,0.06)', border: 'rgba(157,162,172,0.12)', desc: '' }
const TYPE_TAGS = ['notes', 'sop', 'instruction', 'claude-code', 'claude']

let _dynamicMeta = {}
function getMeta(name) {
  return { ...DEFAULT_META, ...(_dynamicMeta[name] || {}), ...(CATEGORY_META[name] || {}) }
}
function getNoteType(tags = []) {
  if (tags.includes('sop') || tags.includes('instruction')) return 'instruction'
  if (tags.includes('notes')) return 'notes'
  return null
}
function getCategory(notePath) {
  const parts = notePath.replace(/\\/g, '/').split('/')
  if (parts.length >= 2 && (parts[0] === 'Work' || parts[0] === 'Clippings')) return parts[1]
  return parts[0] || 'Other'
}

export default function Dashboard({ notes, ftResults, pins, onTogglePin, onSelect }) {
  const [activeCategory, setActiveCategoryRaw] = useState(() => localStorage.getItem('lastCategory') || null)
  const [, forceRender] = useState(0)

  useEffect(() => {
    fetch('http://localhost:3001/api/categories')
      .then(r => r.json())
      .then(data => { _dynamicMeta = data; forceRender(n => n + 1) })
      .catch(() => {})
  }, [])
  const setActiveCategory = (cat) => {
    setActiveCategoryRaw(cat)
    if (cat) localStorage.setItem('lastCategory', cat)
    else localStorage.removeItem('lastCategory')
  }
  const isSearching = ftResults !== null

  const pinnedNotes = useMemo(() => {
    if (!pins?.length) return []
    const noteMap = new Map(notes.map(n => [n.path, n]))
    return pins.map(p => noteMap.get(p)).filter(Boolean)
  }, [pins, notes])

  const groups = useMemo(() => {
    const map = {}
    notes.forEach(note => {
      const cat = getCategory(note.path)
      if (!map[cat]) map[cat] = []
      map[cat].push(note)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [notes])

  const filteredGroups = useMemo(() => {
    if (!activeCategory) return groups
    return groups.filter(([cat]) => cat === activeCategory)
  }, [groups, activeCategory])

  return (
    <div style={{ height: '100%', overflowY: 'auto', animation: 'fadeUp 0.3s cubic-bezier(0.16,1,0.3,1)' }}>

      {/* ── 全文搜尋結果 ── */}
      {isSearching ? (
        <div style={{ padding: '32px 48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <Search size={14} color="var(--vp-c-brand-1)" />
            <span style={{ fontSize: '0.875rem', color: 'var(--vp-c-text-1)', fontWeight: 600 }}>搜尋結果</span>
            <span style={{
              fontSize: '0.6875rem', color: 'var(--vp-c-text-2)',
              background: 'rgba(255,255,255,0.04)', padding: '2px 9px', borderRadius: 99,
            }}>{ftResults.length} 筆</span>
          </div>
          {ftResults.length === 0 ? (
            <Empty text="找不到相關筆記" />
          ) : (
            <NoteList notes={ftResults} pins={pins} onSelect={onSelect} onTogglePin={onTogglePin} searchMode />
          )}
        </div>
      ) : (
        <>
          {/* ── Features（分類卡片）── */}
          <div style={{ padding: '40px 48px 24px' }}>
            <p style={{ ...sectionLabel, marginBottom: 16 }}>分類</p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 12, marginBottom: 40,
            }}>
              {groups.map(([cat, catNotes]) => {
                const meta = getMeta(cat)
                const isActive = activeCategory === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(isActive ? null : cat)}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 8,
                      padding: '16px 18px', borderRadius: 10, textAlign: 'left',
                      border: `1px solid ${isActive ? meta.accent : 'var(--vp-c-divider)'}`,
                      background: isActive ? meta.bg : 'var(--vp-c-bg-elv)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!isActive) { e.currentTarget.style.borderColor = meta.border; e.currentTarget.style.background = meta.bg } }}
                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.borderColor = 'var(--vp-c-divider)'; e.currentTarget.style.background = 'var(--vp-c-bg-elv)' } }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '1.375rem', lineHeight: 1 }}>{meta.icon}</span>
                      <span style={{
                        fontSize: '0.625rem', fontWeight: 700,
                        padding: '2px 7px', borderRadius: 99,
                        background: 'rgba(255,255,255,0.06)', color: 'var(--vp-c-text-3)',
                      }}>{catNotes.length}</span>
                    </div>
                    <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: meta.accent }}>{cat}</span>
                    {meta.desc && (
                      <span style={{ fontSize: '0.8125rem', color: 'var(--vp-c-text-2)', lineHeight: 1.5 }}>{meta.desc}</span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* ── 釘選 ── */}
            {pinnedNotes.length > 0 && (
              <div style={{ marginBottom: 40 }}>
                <p style={{ ...sectionLabel, marginBottom: 12 }}>
                  <Star size={10} style={{ display: 'inline', marginRight: 5 }} fill="currentColor" />
                  釘選
                </p>
                <NoteList notes={pinnedNotes} pins={pins} onSelect={onSelect} onTogglePin={onTogglePin} accent="#fbbf24" />
              </div>
            )}

            {/* ── 筆記列表 ── */}
            {filteredGroups.map(([cat, catNotes]) => (
              <div key={cat} style={{ marginBottom: 40 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginBottom: 12, paddingBottom: 8,
                  borderBottom: `1px solid var(--vp-c-divider)`,
                }}>
                  <span>{getMeta(cat).icon}</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: getMeta(cat).accent }}>{cat}</span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--vp-c-text-3)', marginLeft: 2 }}>{catNotes.length} 份</span>
                </div>
                <NoteList
                  notes={catNotes}
                  pins={pins}
                  onSelect={onSelect}
                  onTogglePin={onTogglePin}
                  accent={getMeta(cat).accent}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function NoteList({ notes, pins, onSelect, onTogglePin, accent, searchMode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {notes.map(note => (
        <NoteRow
          key={note.id} note={note}
          accent={accent || getMeta(getCategory(note.path)).accent}
          pinned={pins?.includes(note.path)}
          onSelect={onSelect}
          onTogglePin={onTogglePin}
          searchMode={searchMode}
        />
      ))}
    </div>
  )
}

function NoteRow({ note, onSelect, accent, pinned, onTogglePin, searchMode }) {
  const [hovered, setHovered] = useState(false)
  const type = getNoteType(note.tags)
  const displayTags = (note.tags || []).filter(t => !TYPE_TAGS.includes(t)).slice(0, 3)

  return (
    <div
      onClick={() => onSelect(note)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', borderRadius: 8,
        background: hovered ? 'var(--vp-c-bg-elv)' : 'transparent',
        border: `1px solid ${hovered ? 'var(--vp-c-divider)' : 'transparent'}`,
        cursor: 'pointer', transition: 'all 0.12s',
      }}
    >
      {/* Left accent bar */}
      <div style={{ width: 3, height: 36, borderRadius: 2, background: accent, flexShrink: 0, opacity: 0.5 }} />

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{
            fontSize: '0.9375rem', fontWeight: 500,
            color: hovered ? accent : 'var(--vp-c-text-1)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            transition: 'color 0.12s',
          }}>{note.title}</span>
          {type && (
            <span style={{
              fontSize: '0.625rem', fontWeight: 700, padding: '1px 7px', borderRadius: 99, flexShrink: 0,
              ...(type === 'instruction'
                ? { background: 'rgba(94,106,210,0.12)', color: '#818cf8', border: '1px solid rgba(94,106,210,0.22)' }
                : { background: 'rgba(62,207,142,0.1)', color: '#3ecf8e', border: '1px solid rgba(62,207,142,0.2)' }),
            }}>{type === 'instruction' ? 'Instruction' : '筆記'}</span>
          )}
        </div>
        {(searchMode && note.matchExcerpt) ? (
          <span style={{ fontSize: '0.8125rem', color: 'var(--vp-c-text-2)', lineHeight: 1.5 }}>{note.matchExcerpt}</span>
        ) : displayTags.length > 0 ? (
          <div style={{ display: 'flex', gap: 4 }}>
            {displayTags.map(tag => (
              <span key={tag} style={{
                fontSize: '0.625rem', padding: '1px 6px', borderRadius: 99,
                background: 'rgba(255,255,255,0.04)', color: 'var(--vp-c-text-3)',
                border: '1px solid var(--vp-c-divider)',
              }}>#{tag}</span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Right: date + pin */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: '0.6875rem', color: 'var(--vp-c-text-3)', fontVariantNumeric: 'tabular-nums' }}>{note.date}</span>
        <button
          onClick={e => { e.stopPropagation(); onTogglePin?.(note.path) }}
          title={pinned ? '取消釘選' : '釘選'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 2,
            color: pinned ? '#fbbf24' : 'var(--vp-c-text-3)',
            opacity: pinned ? 1 : hovered ? 0.7 : 0,
            transition: 'opacity 0.12s',
            display: 'flex', alignItems: 'center',
          }}
        ><Star size={12} fill={pinned ? 'currentColor' : 'none'} /></button>
      </div>
    </div>
  )
}

function Empty({ text }) {
  return (
    <div style={{ textAlign: 'center', color: 'var(--vp-c-text-2)', padding: '60px 0' }}>
      <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔍</div>
      <p style={{ fontSize: '0.875rem' }}>{text}</p>
    </div>
  )
}

const sectionLabel = {
  fontSize: '0.6875rem', fontWeight: 700,
  letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'var(--vp-c-text-2)',
}
