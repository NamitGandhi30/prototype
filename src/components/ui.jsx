// Small presentational primitives shared across role views.
import React, { useEffect } from 'react'

export function Badge({ tone = 'neutral', children, title }) {
  return <span className={`badge badge-${tone}`} title={title}>{children}</span>
}

// Maps a day-status / streak into a coloured badge.
export function TempBadge({ status, value }) {
  if (status === 'febrile') return <Badge tone="danger">Febrile{value ? ` · ${value}°F` : ''}</Badge>
  if (status === 'clear') return <Badge tone="ok">Recorded{value ? ` · ${value}°F` : ''}</Badge>
  return <Badge tone="warn">Temp pending</Badge>
}

export function StatCard({ label, value, sub, tone = 'neutral' }) {
  return (
    <div className={`stat stat-${tone}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function Bar({ pct, tone = 'brand' }) {
  const clamped = Math.max(0, Math.min(1, pct))
  return (
    <div className="bar">
      <div className={`bar-fill bar-${tone}`} style={{ width: `${clamped * 100}%` }} />
    </div>
  )
}

export function Modal({ title, children, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>
}

export function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export function fmtTime(ts) {
  return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
