import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function Dialog({ title, children, onClose }) {
  const backdropRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(2,2,3,0.7)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: '#0d0d10', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 14, padding: '24px', width: 360, maxWidth: '90vw',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 24px 64px rgba(0,0,0,0.6)',
        animation: 'fadeUp 0.2s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--fg)', flex: 1 }}>{title}</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--fg-muted)', display: 'flex', padding: 2, borderRadius: 4,
          }}>
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function DialogInput({ label, value, onChange, placeholder, onSubmit }) {
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  return (
    <div>
      {label && <p style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', marginBottom: 8 }}>{label}</p>}
      <input
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSubmit?.() }}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '8px 12px', borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.04)', color: 'var(--fg)',
          fontSize: '0.875rem', outline: 'none',
          boxSizing: 'border-box',
        }}
        onFocus={e => { e.target.style.borderColor = 'rgba(94,106,210,0.5)' }}
        onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)' }}
      />
    </div>
  )
}

export function DialogActions({ children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
      {children}
    </div>
  )
}

export function Btn({ children, onClick, variant = 'default' }) {
  const styles = {
    default: { background: 'rgba(255,255,255,0.06)', color: 'var(--fg-muted)', border: '1px solid var(--border)' },
    primary: { background: 'rgba(94,106,210,0.2)', color: '#818cf8', border: '1px solid rgba(94,106,210,0.4)', boxShadow: '0 0 12px rgba(94,106,210,0.1)' },
    danger: { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' },
  }
  return (
    <button onClick={onClick} style={{
      padding: '7px 16px', borderRadius: 7, cursor: 'pointer',
      fontSize: '0.8125rem', fontWeight: 500, transition: 'all 0.15s',
      ...styles[variant],
    }}>
      {children}
    </button>
  )
}
