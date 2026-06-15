// Nurse: the data-entry frontline. One job — get every active patient measured
// exactly once today. Pending patients float to the top; a progress meter and
// per-patient status badge kill the "measured twice or not at all" problem.
import React, { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { ROLES, CONFIG } from '../constants.js'
import { todayStatus, latestReading, noFeverStreak, validateTemp } from '../logic.js'
import { Badge, TempBadge, Modal, Bar, fmtTime } from './ui.jsx'

export default function NurseView() {
  const { state, dispatch } = useStore()
  const me = ROLES.nurse.user
  const [pendingOnly, setPendingOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [target, setTarget] = useState(null)
  const [toast, setToast] = useState(null)

  const active = state.patients.filter((p) => p.status === 'active')
  const rows = useMemo(() => {
    return active
      .map((p) => ({ p, today: todayStatus(p) }))
      .sort((a, b) => {
        const rank = (s) => (s === 'none' ? 0 : s === 'febrile' ? 1 : 2)
        return rank(a.today.status) - rank(b.today.status) || a.p.bed - b.p.bed
      })
  }, [active])

  const measured = rows.filter((r) => r.today.status !== 'none').length
  const q = search.trim().toLowerCase()
  const visible = rows
    .filter((r) => (pendingOnly ? r.today.status === 'none' : true))
    .filter((r) => (q ? r.p.name.toLowerCase().includes(q) || String(r.p.bed) === q : true))

  return (
    <div>
      <div className="view-head">
        <div>
          <h2>Today's round</h2>
          <p className="muted">Record each patient's temperature once. Pending patients are listed first.</p>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} />
          Show pending only
        </label>
      </div>

      {toast && <div className="toast">✓ {toast}</div>}

      <input
        className="search"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search patient by name or bed #…"
      />

      <div className="progress-card">
        <div className="progress-top">
          <span><strong>{measured}</strong> of <strong>{rows.length}</strong> measured today</span>
          <span className="muted">{rows.length - measured} pending</span>
        </div>
        <Bar pct={rows.length ? measured / rows.length : 0} tone={measured === rows.length ? 'ok' : 'brand'} />
      </div>

      <div className="card-list">
        {visible.map(({ p, today }) => {
          const last = latestReading(p)
          const streak = noFeverStreak(p)
          return (
            <div className="patient-row" key={p.id}>
              <div className="pr-bed">#{p.bed}</div>
              <div className="pr-main">
                <div className="pr-name">{p.name}</div>
                <div className="pr-meta">
                  {last ? <>Last: {last.tempF}°F · {fmtTime(last.ts)}</> : 'No readings yet'}
                  {' · '}<span title="Consecutive no-fever days">streak {streak}/{CONFIG.NO_FEVER_DAYS_REQUIRED}</span>
                </div>
              </div>
              <div className="pr-status">
                <TempBadge status={today.status} value={today.status !== 'none' && today.readings.length ? today.readings[today.readings.length - 1].tempF : null} />
              </div>
              <div className="pr-actions">
                <button className="btn btn-primary" onClick={() => setTarget(p)}>
                  {today.status === 'none' ? 'Record temp' : 'Record again'}
                </button>
              </div>
            </div>
          )
        })}
        {visible.length === 0 && <div className="empty">All patients measured for today. 🎉</div>}
      </div>

      {target && (
        <RecordTempModal
          patient={target}
          onClose={() => setTarget(null)}
          onSave={(tempF) => {
            dispatch({ type: 'RECORD_TEMP', patientId: target.id, tempF, by: me })
            setToast(`Recorded ${tempF}°F for ${target.name}. Now visible to the doctor.`)
            setTimeout(() => setToast(null), 4000)
            setTarget(null)
          }}
        />
      )}
    </div>
  )
}

function RecordTempModal({ patient, onClose, onSave }) {
  const [val, setVal] = useState('')
  const today = todayStatus(patient)
  const num = parseFloat(val)
  const check = val === '' ? { ok: false } : validateTemp(num)
  const alreadyToday = today.status !== 'none'

  return (
    <Modal title={`Record temperature — ${patient.name}`} onClose={onClose}>
      <div className="form-row">
        <label>Temperature (°F)</label>
        <input
          autoFocus type="number" step="0.1" inputMode="decimal"
          value={val} onChange={(e) => setVal(e.target.value)}
          placeholder="e.g. 98.6"
        />
      </div>

      {val !== '' && check.error && <div className="alert alert-danger">{check.error}</div>}
      {check.ok && check.warn && <div className="alert alert-warn">⚠ {check.warn}</div>}
      {alreadyToday && (
        <div className="alert alert-warn">
          ⚠ A temperature was already recorded for {patient.name} today
          ({today.readings.map((r) => `${r.tempF}°F`).join(', ')}). Recording another will
          keep both — if <em>any</em> reading today is febrile, the whole day counts as febrile.
        </div>
      )}

      <div className="form-meta muted">
        Recorded by {ROLES.nurse.user} · {new Date().toLocaleString()}
      </div>

      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!check.ok} onClick={() => onSave(num)}>
          Save reading
        </button>
      </div>
    </Modal>
  )
}
