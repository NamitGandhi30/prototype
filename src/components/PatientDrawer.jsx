// Shared, read-only patient-detail drawer. Shows one patient's full picture:
// status summary, onboarding context, temperature trend, readings, visits, and
// final discharge/death details when available.
import React, { useMemo } from 'react'
import { useStore } from '../store.jsx'
import { CONFIG } from '../constants.js'
import {
  todayStatus, noFeverStreak, isDischargeEligible, isFebrile, isHighFever
} from '../logic.js'
import { Badge, fmtTime } from './ui.jsx'

export default function PatientDrawer({ patientId, onClose }) {
  const { state } = useStore()
  const p = state.patients.find((x) => x.id === patientId)
  const readings = p?.readings ?? []
  const visits = p?.visits ?? []
  const readingsDesc = useMemo(() => [...readings].sort((a, b) => b.ts - a.ts), [readings])
  const visitsDesc = useMemo(() => [...visits].sort((a, b) => b.ts - a.ts), [visits])
  if (!p) return null

  const today = todayStatus(p)
  const streak = noFeverStreak(p)
  const eligible = isDischargeEligible(p)

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <div className="drawer-name">{p.name}</div>
            <div className="muted small">Bed #{p.bed ?? '-'} - admitted {fmtTime(p.admittedTs)}</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">x</button>
        </div>

        <div className="drawer-body">
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

          {p.onboarding && (
            <section className="drawer-section">
              <h4>Onboarding</h4>
              <div className="drawer-detail-grid">
                <Detail label="Age" value={p.onboarding.age || 'Not specified'} />
                <Detail label="Sex" value={p.onboarding.sex || 'Not specified'} />
                <Detail label="Acuity" value={p.onboarding.acuity || 'Routine'} />
                <Detail label="Source" value={p.onboarding.source || 'Walk-in'} />
                <Detail label="Reason" value={p.onboarding.reason || 'Not recorded'} wide />
                <Detail label="Emergency contact" value={p.onboarding.contact || 'Not recorded'} />
                <Detail label="Phone" value={p.onboarding.phone || 'Not recorded'} />
                {p.onboarding.notes && <Detail label="Intake notes" value={p.onboarding.notes} wide />}
              </div>
            </section>
          )}

          <section className="drawer-section">
            <h4>Temperature trend</h4>
            <Sparkline readings={p.readings} />
          </section>

          <section className="drawer-section">
            <h4>Reading history</h4>
            {readingsDesc.length === 0 && <div className="muted small">No readings recorded yet.</div>}
            <div className="timeline">
              {readingsDesc.map((r) => (
                <div className="reading-record" key={r.id}>
                  <div className="tl-row">
                    <span className={`tl-dot ${isFebrile(r.tempF) ? 'hot' : 'cool'}`} />
                    <span className="tl-temp">{r.tempF}F{isHighFever(r.tempF) ? ' high' : ''}</span>
                    <span className="muted small">{fmtTime(r.ts)} - {r.by}</span>
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

          <section className="drawer-section">
            <h4>Visit notes</h4>
            {visitsDesc.length === 0 && <div className="muted small">No visits logged yet.</div>}
            {visitsDesc.map((v) => (
              <div className="drawer-note" key={v.id}>
                <div>"{v.note}"</div>
                <div className="muted small">{v.by} - {fmtTime(v.ts)}</div>
              </div>
            ))}
          </section>

          {p.outcomeTs && (
            <section className="drawer-section">
              <h4>Outcome</h4>
              <div className="small">
                {p.status === 'discharged' ? 'Discharged' : 'Deceased'} - {fmtTime(p.outcomeTs)} - {p.outcomeBy}
                {p.outcomeNote && <div className="muted">{p.outcomeNote}</div>}
              </div>
            </section>
          )}

          {p.discharge && (
            <section className="drawer-section">
              <h4>Discharge details</h4>
              <div className="drawer-detail-grid outcome-details">
                <Detail label="Destination" value={p.discharge.destination || 'Not recorded'} />
                <Detail label="Follow-up" value={p.discharge.followUp || 'Not booked'} />
                <Detail label="Instructions" value={p.discharge.instructions || 'Not recorded'} wide />
                {p.discharge.note && <Detail label="Admin note" value={p.discharge.note} wide />}
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

function Detail({ label, value, wide = false }) {
  return (
    <div className={wide ? 'detail-card wide' : 'detail-card'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

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
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Temperature sparkline">
      <line x1={PAD} x2={W - PAD} y1={feverY} y2={feverY} stroke="#b83d38" strokeDasharray="3 3" opacity=".55" />
      <path d={path} fill="none" stroke="#155c50" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (
        <circle key={d.id} cx={x(i)} cy={y(d.tempF)} r="3.5" fill={isFebrile(d.tempF) ? '#b83d38' : '#277b55'} />
      ))}
    </svg>
  )
}
