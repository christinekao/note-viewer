import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

// Recursively extract plain text from React element tree
function extractText(node) {
  if (node == null) return ''
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (node?.props?.children) return extractText(node.props.children)
  return ''
}

function CopyButton({ getText }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(getText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="copy-btn" style={{
      position: 'absolute', top: 8, right: 8,
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'rgba(22,27,34,0.95)',
      color: copied ? '#4ade80' : 'rgba(255,255,255,0.5)',
      fontSize: '0.6875rem', fontWeight: 500,
      opacity: 0, transition: 'all 0.15s', zIndex: 10,
    }}>
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// Single visual block — children are the highlighted React elements
function SingleBlock({ children, getText }) {
  return (
    <div
      style={{ position: 'relative', margin: '0.5em 0', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', background: '#161b22' }}
      onMouseEnter={e => { const b = e.currentTarget.querySelector('.copy-btn'); if (b) b.style.opacity = '1' }}
      onMouseLeave={e => { const b = e.currentTarget.querySelector('.copy-btn'); if (b) b.style.opacity = '0' }}
    >
      <CopyButton getText={getText} />
      <pre style={{ margin: 0, padding: '14px 16px', overflowX: 'auto' }}>
        {children}
      </pre>
    </div>
  )
}

// Main export — wraps a <pre> block, splits by blank lines if substantial
export default function CodeBlock({ children }) {
  // children = <code className="language-xxx">...</code>  (highlighted)
  const codeEl = Array.isArray(children) ? children[0] : children
  const rawText = extractText(codeEl).replace(/\n$/, '')

  // Split plain text by blank lines
  const textChunks = rawText.split(/\n{2,}/).map(c => c.trim()).filter(Boolean)
  const shouldSplit = textChunks.length > 1 && textChunks.every(c => c.includes('\n') || c.length > 15)

  if (!shouldSplit) {
    return (
      <SingleBlock getText={() => rawText}>
        {codeEl}
      </SingleBlock>
    )
  }

  // Split: rebuild text chunks as plain <code> spans for display
  const className = codeEl?.props?.className || ''
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '1.25em 0' }}>
      {textChunks.map((chunk, i) => (
        <SingleBlock key={i} getText={() => chunk}>
          <code className={className} style={{ fontSize: '0.8125rem', lineHeight: 1.7 }}>
            {chunk}
          </code>
        </SingleBlock>
      ))}
    </div>
  )
}
