import { useCallback, useEffect, useRef, useState } from 'react'
import { PanelLeftClose } from 'lucide-react'

export default function ResizeHandle({ onResize, onHide }) {
  const dragging = useRef(false)
  const [hovered, setHovered] = useState(false)

  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging.current) return
      onResize(e.clientX)
    }
    const onMouseUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onResize])

  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 12, flexShrink: 0, cursor: 'col-resize',
        position: 'relative', zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* 分隔線 */}
      <div style={{
        width: 1, height: '100%', position: 'absolute',
        background: hovered ? 'rgba(94,106,210,0.5)' : 'var(--border)',
        transition: 'background 0.15s',
      }} />

      {/* Hide 按鈕 — hover 才出現 */}
      {hovered && (
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={onHide}
          title="Hide sidebar"
          style={{
            position: 'absolute', top: '50%', transform: 'translateY(-50%)',
            width: 20, height: 20, borderRadius: 6,
            background: 'var(--bg-elevated)',
            border: '1px solid rgba(94,106,210,0.4)',
            cursor: 'pointer', zIndex: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#818cf8', boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          <PanelLeftClose size={11} />
        </button>
      )}
    </div>
  )
}
