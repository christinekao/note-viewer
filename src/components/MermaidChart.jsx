import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    darkMode: true,
    background: '#0a0a0c',
    primaryColor: '#5E6AD2',
    primaryTextColor: '#EDEDEF',
    primaryBorderColor: 'rgba(255,255,255,0.1)',
    lineColor: '#8A8F98',
    secondaryColor: 'rgba(94,106,210,0.15)',
    tertiaryColor: 'rgba(255,255,255,0.05)',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '14px',
  },
})

let counter = 0

export default function MermaidChart({ code }) {
  const ref = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!ref.current || !code) return

    // Fresh ID every effect run — avoids StrictMode double-mount collision
    const id = `mermaid-render-${++counter}`

    // Remove stale element mermaid may have left in <body>
    document.getElementById(id)?.remove()

    setError(null)
    const normalized = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    mermaid.render(id, normalized)
      .then(({ svg }) => {
        if (!ref.current) return
        ref.current.innerHTML = svg
        const svgEl = ref.current.querySelector('svg')
        if (svgEl) {
          svgEl.style.maxWidth = '100%'
          svgEl.style.height = 'auto'
          svgEl.style.display = 'block'
          svgEl.style.margin = '0 auto'
        }
      })
      .catch(err => {
        setError(err.message || 'Mermaid render error')
      })
  }, [code])

  if (error) {
    return (
      <div style={{
        padding: '12px 16px', borderRadius: 8,
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.2)',
        color: '#f87171', fontSize: '0.8125rem',
        fontFamily: 'monospace',
      }}>
        Mermaid error: {error}
      </div>
    )
  }

  return (
    <div ref={ref} style={{
      padding: '20px', borderRadius: 10, margin: '1.25em 0',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid var(--border)',
      overflow: 'auto',
    }} />
  )
}
