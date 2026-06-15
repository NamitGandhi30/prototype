// Admin / front desk: throughput owner. Live occupancy vs the 74-bed cap, the
// doctor-approved discharge queue (completing one is what actually frees a
// bed), and an admit form that hard-blocks at capacity.
import React, { useState } from 'react'
import { useStore } from '../store.jsx'
import { ROLES, CONFIG } from '../constants.js'
import { facilityMetrics } from '../logic.js'
import { Badge, Bar, fmtTime } from './ui.jsx'

export default function AdminView() {
  const { state, dispatch } = useStore()
  const me = ROLES.admin.user
  const m = facilityMetrics(state.patients)
  const full = m.occupancy >= CONFIG.BED_CAPACITY

  const queue = state.patients.filter((p) => p.status === 'active' && p.dischargeApproved)
  const [name, setName] = useState('')

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
                  <div className="pr-meta muted">Approved by Dr. — admitted {fmtTime(p.admittedTs)}</div>
                </div>
                <div className="pr-actions">
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
    </div>
  )
}
