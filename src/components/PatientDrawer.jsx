// Shared, read-only patient-detail drawer. Slides in from the right and shows
// ONE patient's full picture in a single place: status summary, a temperature
// sparkline, the complete reading history, and every visit note. Reads the
// patient live from the store by id, so it updates the moment a temp is added.
import React from 'react'
import { useStore } from '../store.jsx'
import { CONFIG } from '../constants.js'
import {
  todayStatus, noFeverStreak, isDischargeEligible, isFebrile, isHighFever
} from '../logic.js'
import { Badge, fmtTime } from './ui.jsx'

export default function PatientDrawer({ patientId, onClose }) {
  const { state } = useStore()
  const p = state.patients.find((x) => x.id === patientId)
  if (!p) return null

  const today = todayStatus(p)
  const streak = noFeverStreak(p)
  const eligible = isDischargeEligible(p)
  const readingsDesc = [...p.readings].sort((a, b) => b.ts - a.ts)
  const visitsDesc = [...p.visits].sort((a, b) => b.ts - a.ts)

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <div className="drawer-name">{p.name}</div>
            <div className="muted small">Bed #{p.bed ?? '—'} · admitted {fmtTime(p.admittedTs)}</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="drawer-body">
          {/* status summary */}
          <div className="drawer-badges">
            <StatusBadge status={p.status} />
            {today.status === 'febrile' && <Badge tone="danger">Febrile today</Badge>}
            {today.status === 'clear' && <Badge tone="ok">Measured today</Badge>}
            {today.status === 'none' && p.status === 'active' && <Badge tone="warn">Temp pending</Badge>}
            {p.dischargeApproved && <Badge tone="info">Discharge approved</Badge>}
            {p.escalated && <Badge tone="danger">Urgent escalation</Badge>}
            {eligible && !p.dischargeApproved && <Badge tone="ok">Discharge-ready</Badge>}
          </div>

          <div className="drawer-stats">
            <div><span className="ds-val">{streak}/{CONFIG.NO_FEVER_DAYS_REQUIRED}</span><span className="ds-lbl">no-fever streak</span></div>
            <div><span className="ds-val">{p.readings.length}</span><span className="ds-lbl">readings</span></div>
            <div><span className="ds-val">{p.visits.length}</span><span className="ds-lbl">visits</span></div>
          </div>

          {/* temperature trend */}
          <section className="drawer-section">
            <h4>Temperature trend</h4>
            <Sparkline readings={p.readings} />
          </section>

          {/* full reading history */}
          <section className="drawer-section">
            <h4>Reading history</h4>
            {readingsDesc.length === 0 && <div className="muted small">No readings recorded yet.</div>}
            <div className="timeline">
              {readingsDesc.map((r) => (
                <div className="reading-record" key={r.id}>
                  <div className="tl-row">
                    <span className={`tl-dot ${isFebrile(r.tempF) ? 'hot' : 'cool'}`} />
                    <span className="tl-temp">{r.tempF}°F{isHighFever(r.tempF) ? ' high' : ''}</span>
                    <span className="muted small">{fmtTime(r.ts)} · {r.by}</span>
                  </div>
                  {(r.note || r.needsRecheck || r.escalated || r.overrideReason) && (
                    <div className="reading-context">
                      {r.note && <div>{r.note}</div>}
                      <div className="drawer-badges">
                        {r.needsRecheck && <Badge tone="warn">Needs recheck</Badge>}
                        {r.escalated && <Badge tone="danger">Escalated</Badge>}
                        {r.overrideReason && <Badge tone="neutral">Repeat: {r.overrideReason}</Badge>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* visit notes */}
          <section className="drawer-section">
            <h4>Visit notes</h4>
            {visitsDesc.length === 0 && <div className="muted small">No visits logged yet.</div>}
            {visitsDesc.map((v) => (
              <div className="drawer-note" key={v.id}>
                <div>“{v.note}”</div>
                <div className="muted small">{v.by} · {fmtTime(v.ts)}</div>
              </div>
            ))}
          </section>

          {p.outcomeTs && (
            <section className="drawer-section">
              <h4>Outcome</h4>
              <div className="small">
                {p.status === 'discharged' ? 'Discharged' : 'Deceased'} · {fmtTime(p.outcomeTs)} · {p.outcomeBy}
                {p.outcomeNote && <div className="muted">{p.outcomeNote}</div>}
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  )
}

function StatusBadge({ status }) {
  if (status === 'discharged') return <Badge tone="ok">Discharged</Badge>
  if (status === 'deceased') return <Badge tone="danger">Deceased</Badge>
  return <Badge tone="neutral">Active</Badge>
}

// Lightweight inline SVG sparkline with the fever threshold drawn in.
function Sparkline({ readings }) {
  const data = [...readings].sort((a, b) => a.ts - b.ts).slice(-12)
  if (data.length === 0) return <div className="muted small">No data yet.</div>

  const W = 300, H = 70, PAD = 10
  const temps = data.map((d) => d.tempF)
  const min = Math.min(97, ...temps) - 0.5
  const max = Math.max(102, CONFIG.FEVER_THRESHOLD_F + 1, ...temps) + 0.5
  const x = (i) => PAD + (data.length === 1 ? (W - 2 * PAD) / 2 : (i * (W - 2 * PAD)) / (data.length - 1))
  const y = (t) => H - PAD - ((t - min) / (max - min)) * (H - 2 * PAD)
  const feverY = y(CONFIG.FEVER_THRESHOLD_F)
  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.tempF).toFixed(1)}`).join(' ')

  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      <line x1={PAD} x2={W - PAD} y1={feverY} y2={feverY} stroke="#e0a33a" strokeDasharray="4 3" strokeWidth="1" />
      <text x={W - PAD} y={feverY - 4} textAnchor="end" fontSize="9" fill="#b45309">fever {CONFIG.FEVER_THRESHOLD_F}°F</text>
      {data.length > 1 && <path d={path} fill="none" stroke="#2563eb" strokeWidth="2" />}
      {data.map((d, i) => (
        <circle key={d.id} cx={x(i)} cy={y(d.tempF)} r="3.5"
          fill={isFebrile(d.tempF) ? '#dc2626' : '#16a34a'} stroke="#fff" strokeWidth="1.5" />
      ))}
    </svg>
  )
}
