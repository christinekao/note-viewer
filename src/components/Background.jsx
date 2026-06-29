export default function Background() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
      background: 'var(--vp-c-bg)',
    }} />
  )
}
