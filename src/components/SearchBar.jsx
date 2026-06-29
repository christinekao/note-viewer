import { forwardRef } from 'react'
import { Search, X } from 'lucide-react'

// forwardRef 讓 App.jsx 可以用 ref 聚焦 input（鍵盤快捷鍵 /）
const SearchBar = forwardRef(function SearchBar({ value, onChange }, ref) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <Search size={13} color="var(--fg-muted)" style={{ position: 'absolute', left: 10, pointerEvents: 'none' }} />
      <input
        ref={ref}
        type="text"
        placeholder="搜尋… (/ 聚焦)"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '5px 28px 5px 30px',
          color: 'var(--fg)',
          fontSize: '0.8125rem',
          outline: 'none',
          width: 210,
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
        onFocus={e => {
          e.target.style.borderColor = 'rgba(94,106,210,0.5)'
          e.target.style.boxShadow = '0 0 0 3px rgba(94,106,210,0.12)'
        }}
        onBlur={e => {
          e.target.style.borderColor = 'var(--border)'
          e.target.style.boxShadow = 'none'
        }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          style={{
            position: 'absolute', right: 8,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--fg-muted)', display: 'flex', padding: 0,
          }}
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
})

export default SearchBar
