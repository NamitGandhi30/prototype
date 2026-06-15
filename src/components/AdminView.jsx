// Admin / front desk: throughput owner. Live occupancy vs the 74-bed cap, the
// doctor-approved discharge queue (completing one is what actually frees a
// bed), and an admit form that hard-blocks at capacity.
import React, { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { ROLES, CONFIG } from '../constants.js'
import { facilityMetrics } from '../logic.js'
import { Badge, Bar, fmtTime, timeAgo } from './ui.jsx'
import PatientDrawer from './PatientDrawer.jsx'

export default function AdminView() {
  const { state, dispatch } = useStore()
  const me = ROLES.admin.user
  const m = useMemo(() => facilityMetrics(state.patients), [state.patients])
  const full = m.occupancy >= CONFIG.BED_CAPACITY

  const queue = useMemo(
    () => state.patients.filter((p) => p.status === 'active' && p.dischargeApproved),
    [state.patients]
  )
  const dischargeHistory = useMemo(
    () => state.patients
      .filter((p) => p.status === 'discharged')
      .sort((a, b) => (b.outcomeTs || 0) - (a.outcomeTs || 0))
      .slice(0, 8),
    [state.patients]
  )
  const [name, setName] = useState('')
  const [historyFor, setHistoryFor] = useState(null)

  return (
    <div>
      <div className="view-head">
        <div>
          <h2>Admissions & beds</h2>
          <p className="muted">Discharge approval (doctor) and bed release (you) are two steps — a bed frees only when you complete it.</p>
        </div>
      </div>

      <div className="occupancy-card">
        <div className="progress-top">
          <span><strong>{m.occupancy}</strong> / {CONFIG.BED_CAPACITY} beds occupied</span>
          <span className={full ? 'pill pill-danger' : 'pill pill-ok'}>{full ? 'FULL' : `${CONFIG.BED_CAPACITY - m.occupancy} free`}</span>
        </div>
        <Bar pct={m.occupancyPct} tone={full ? 'danger' : m.occupancyPct > 0.9 ? 'warn' : 'brand'} />
      </div>

      {queue.length > 0 && (
        <div className="handoff-alert">
          <strong>{queue.length} doctor handoff{queue.length === 1 ? '' : 's'} ready</strong>
          <span>Complete discharge processing to release {queue.length === 1 ? 'the bed' : 'beds'}.</span>
        </div>
      )}

      <div className="two-col">
        <section className="panel">
          <h3>Discharge queue <Badge tone="info">{queue.length}</Badge></h3>
          <p className="muted small">Doctor-approved, awaiting bed release.</p>
          <div className="card-list">
            {queue.map((p) => (
              <div className="patient-row" key={p.id}>
                <div className="pr-bed">#{p.bed}</div>
                <div className="pr-main">
                  <div className="pr-name">{p.name}</div>
                  <div className="pr-meta muted">
                    {p.dischargeApprovedBy || 'Doctor'} handoff
                    {p.dischargeApprovedTs ? ` ${timeAgo(p.dischargeApprovedTs)}` : ''} · admitted {fmtTime(p.admittedTs)}
                  </div>
                </div>
                <div className="pr-actions">
                  <button className="btn" onClick={() => setHistoryFor(p.id)}>History</button>
                  <button className="btn btn-primary" onClick={() => dispatch({ type: 'COMPLETE_DISCHARGE', patientId: p.id, by: me })}>
                    Release bed
                  </button>
                </div>
              </div>
            ))}
            {queue.length === 0 && <div className="empty">No patients awaiting discharge.</div>}
          </div>
        </section>

        <section className="panel">
          <h3>Admit patient</h3>
          <p className="muted small">{full ? 'Blocked — facility at capacity.' : 'Assigns the next available bed.'}</p>
          <div className="form-row">
            <label>Patient name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" disabled={full} />
          </div>
          {full && <div className="alert alert-danger">All {CONFIG.BED_CAPACITY} beds are occupied. Complete a discharge to free a bed before admitting.</div>}
          <button
            className="btn btn-primary"
            disabled={full || !name.trim()}
            onClick={() => { dispatch({ type: 'ADMIT', name: name.trim(), by: me }); setName('') }}
          >
            Admit to bed #{state.nextBed}
          </button>
        </section>
      </div>

      <section className="panel discharge-log">
        <h3>Recent discharge log <Badge tone="neutral">{dischargeHistory.length}</Badge></h3>
        <div className="table-list">
          {dischargeHistory.map((p) => (
            <button className="table-row" key={p.id} onClick={() => setHistoryFor(p.id)}>
              <span><strong>{p.name}</strong><small>Bed #{p.outcomeBed || '—'}</small></span>
              <span><strong>{fmtTime(p.outcomeTs)}</strong><small>{timeAgo(p.outcomeTs)}</small></span>
              <span><strong>Discharged</strong><small>{p.outcomeBy}</small></span>
            </button>
          ))}
        </div>
      </section>
      {historyFor && <PatientDrawer patientId={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  )
}
