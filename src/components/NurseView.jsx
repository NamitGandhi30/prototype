// Nurse: the data-entry frontline. One job — get every active patient measured
// exactly once today. Pending patients float to the top; a progress meter and
// per-patient status badge kill the "measured twice or not at all" problem.
import React, { useDeferredValue, useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { ROLES, CONFIG } from '../constants.js'
import { todayStatus, latestReading, noFeverStreak, validateTemp, workflowStatus } from '../logic.js'
import { Badge, TempBadge, Modal, Bar, fmtTime } from './ui.jsx'
import PatientDrawer from './PatientDrawer.jsx'

export default function NurseView() {
  const { state, dispatch } = useStore()
  const me = ROLES.nurse.user
  const [pendingOnly, setPendingOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [target, setTarget] = useState(null)
  const [historyFor, setHistoryFor] = useState(null)
  const [toast, setToast] = useState(null)
  const deferredSearch = useDeferredValue(search)

  const rows = useMemo(() => {
    return state.patients
      .filter((p) => p.status === 'active')
      .map((p) => ({
        p,
        last: latestReading(p),
        streak: noFeverStreak(p),
        today: todayStatus(p),
        workflow: workflowStatus(p)
      }))
      .sort((a, b) => {
        const rank = (row) => row.workflow.escalated ? 0 : row.workflow.needsRecheck ? 1 : row.today.status === 'none' ? 2 : row.today.status === 'febrile' ? 3 : 4
        return rank(a) - rank(b) || a.p.bed - b.p.bed
      })
  }, [state.patients])

  const measured = useMemo(() => rows.filter((r) => r.today.status !== 'none').length, [rows])
  const q = deferredSearch.trim().toLowerCase()
  const visible = useMemo(() => {
    return rows
      .filter((r) => (pendingOnly ? r.today.status === 'none' : true))
      .filter((r) => (q ? r.p.name.toLowerCase().includes(q) || String(r.p.bed) === q : true))
  }, [pendingOnly, q, rows])

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
        {visible.map(({ p, today, workflow, last, streak }) => {
          return (
            <div className="patient-row" key={p.id}>
              <div className="pr-bed">#{p.bed}</div>
              <div className="pr-main">
                <div className="pr-name">
                  {p.name}
                  {workflow.escalated && <Badge tone="danger">Escalated</Badge>}
                  {workflow.needsRecheck && <Badge tone="warn">Needs recheck</Badge>}
                  {workflow.readyForReview && <Badge tone="info">Ready for doctor</Badge>}
                </div>
                <div className="pr-meta">
                  {last ? <>Last: {last.tempF}°F · {fmtTime(last.ts)}</> : 'No readings yet'}
                  {' · '}<span title="Consecutive no-fever days">streak {streak}/{CONFIG.NO_FEVER_DAYS_REQUIRED}</span>
                </div>
              </div>
              <div className="pr-status">
                <TempBadge status={today.status} value={today.status !== 'none' && today.readings.length ? today.readings[today.readings.length - 1].tempF : null} />
              </div>
              <div className="pr-actions">
                <button className="btn" onClick={() => setHistoryFor(p.id)}>View history</button>
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
          onSave={(reading) => {
            dispatch({ type: 'RECORD_TEMP', patientId: target.id, by: me, ...reading })
            setToast(`Recorded ${reading.tempF}°F for ${target.name}. Now visible to the doctor.`)
            setTimeout(() => setToast(null), 4000)
            setTarget(null)
          }}
        />
      )}
      {historyFor && <PatientDrawer patientId={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  )
}

function RecordTempModal({ patient, onClose, onSave }) {
  const [val, setVal] = useState('')
  const [note, setNote] = useState('')
  const [needsRecheck, setNeedsRecheck] = useState(false)
  const [escalated, setEscalated] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const today = todayStatus(patient)
  const num = parseFloat(val)
  const check = val === '' ? { ok: false } : validateTemp(num)
  const alreadyToday = today.status !== 'none'
  const abnormal = check.ok && num >= CONFIG.FEVER_THRESHOLD_F
  const canSave = check.ok && (!alreadyToday || overrideReason.trim()) && (!abnormal || note.trim())

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

      {alreadyToday && (
        <div className="form-row">
          <label>Reason for repeat reading</label>
          <select value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)}>
            <option value="">Select a required reason</option>
            <option>Previous entry was incorrect</option>
            <option>Doctor requested a recheck</option>
            <option>Patient condition changed</option>
          </select>
        </div>
      )}

      <div className="form-row">
        <label>Clinical note {abnormal ? '(required for abnormal reading)' : '(optional)'}</label>
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Symptoms, context, or handoff note" />
      </div>

      <div className="capture-options">
        <label className="toggle"><input type="checkbox" checked={needsRecheck} onChange={(e) => setNeedsRecheck(e.target.checked)} /> Needs recheck</label>
        <label className="toggle"><input type="checkbox" checked={escalated} onChange={(e) => setEscalated(e.target.checked)} /> Escalate to doctor</label>
      </div>

      <div className="form-meta muted">
        Recorded by {ROLES.nurse.user} · {new Date().toLocaleString()}
      </div>

      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!canSave} onClick={() => onSave({ tempF: num, note: note.trim(), needsRecheck, escalated, overrideReason })}>
          Save reading
        </button>
      </div>
    </Modal>
  )
}
