// Doctor: clinical reviewer & decision-maker. Sees temp + visit status for the
// day, the no-fever streak, recent readings; logs visits, approves discharge
// once the criterion is met, and records deaths. Febrile / not-yet-seen
// patients sort to the top.
import React, { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { ROLES, CONFIG } from '../constants.js'
import {
  todayStatus, visitedToday, noFeverStreak, isDischargeEligible,
  isHighFever, workflowStatus
} from '../logic.js'
import { Badge, TempBadge, Modal } from './ui.jsx'
import PatientDrawer from './PatientDrawer.jsx'

export default function DoctorView() {
  const { state, dispatch } = useStore()
  const me = ROLES.doctor.user
  const [visitFor, setVisitFor] = useState(null)
  const [deathFor, setDeathFor] = useState(null)
  const [historyFor, setHistoryFor] = useState(null)
  const [search, setSearch] = useState('')

  const active = state.patients.filter((p) => p.status === 'active')
  const q = search.trim().toLowerCase()
  const rows = useMemo(() => {
    return active
      .filter((p) => (q ? p.name.toLowerCase().includes(q) || String(p.bed) === q : true))
      .map((p) => ({
        p,
        today: todayStatus(p),
        visit: visitedToday(p),
        streak: noFeverStreak(p),
        eligible: isDischargeEligible(p),
        workflow: workflowStatus(p)
      }))
      .sort((a, b) => priority(a) - priority(b) || a.p.bed - b.p.bed)
  }, [active, q])

  return (
    <div>
      <div className="view-head">
        <div>
          <h2>Clinical review</h2>
          <p className="muted">Febrile and not-yet-seen patients are listed first. Review after the day's temperature is in.</p>
        </div>
      </div>

      <input
        className="search"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search patient by name or bed #…"
      />

      <div className="card-list">
        {rows.map((row) => (
          <DoctorRow
            key={row.p.id} row={row}
            onVisit={() => setVisitFor(row.p)}
            onHistory={() => setHistoryFor(row.p.id)}
            onEscalation={(escalated) => dispatch({ type: 'SET_ESCALATION', patientId: row.p.id, escalated, by: me })}
            onApprove={() => dispatch({ type: 'APPROVE_DISCHARGE', patientId: row.p.id, by: me })}
            onDeath={() => setDeathFor(row.p)}
          />
        ))}
      </div>

      {visitFor && (
        <VisitModal patient={visitFor} onClose={() => setVisitFor(null)}
          onSave={(note) => { dispatch({ type: 'ADD_VISIT', patientId: visitFor.id, note, by: me }); setVisitFor(null) }} />
      )}
      {deathFor && (
        <DeathModal patient={deathFor} onClose={() => setDeathFor(null)}
          onSave={(note) => { dispatch({ type: 'RECORD_DEATH', patientId: deathFor.id, note, by: me }); setDeathFor(null) }} />
      )}
      {historyFor && <PatientDrawer patientId={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  )
}

// lower number = higher priority
function priority(row) {
  if (row.workflow.escalated) return -1
  if (row.today.status === 'febrile') return 0
  if (row.today.status === 'none') return 1
  if (!row.visit.visited) return 2
  return 3
}

function DoctorRow({ row, onVisit, onHistory, onEscalation, onApprove, onDeath }) {
  const { p, today, visit, streak, eligible, workflow } = row
  const highFever = today.readings.some((r) => isHighFever(r.tempF))

  return (
    <div className={`patient-row doctor-row ${highFever ? 'row-alert' : ''}`}>
      <div className="pr-bed">#{p.bed}</div>
      <div className="pr-main">
        <div className="pr-name">
          {p.name}
          {highFever && <Badge tone="danger" title="High fever flagged">HIGH FEVER</Badge>}
          {workflow.escalated && <Badge tone="danger">URGENT</Badge>}
          {workflow.needsRecheck && <Badge tone="warn">Recheck requested</Badge>}
          {workflow.readyForReview && <Badge tone="info">Ready for review</Badge>}
          {p.dischargeApproved
            ? <Badge tone="info" title="Approved — awaiting bed release by admin">Discharge approved</Badge>
            : eligible && <Badge tone="ok" title="Meets 3-day no-fever criterion">Discharge-ready</Badge>}
        </div>
        <div className="pr-meta">
          <TempBadge status={today.status} value={today.readings.length ? today.readings[today.readings.length - 1].tempF : null} />
          {visit.visited
            ? <Badge tone="info" title={visit.visits[visit.visits.length - 1].note}>Visited by {visit.visits[visit.visits.length - 1].by}</Badge>
            : <Badge tone="warn">Review pending</Badge>}
          <span className="muted" title="Consecutive no-fever days">streak {streak}/{CONFIG.NO_FEVER_DAYS_REQUIRED}</span>
        </div>
      </div>
      <div className="pr-actions col">
        <button className="btn" onClick={onHistory}>View history</button>
        <button className={workflow.escalated ? 'btn btn-ghost-danger' : 'btn'} onClick={() => onEscalation(!workflow.escalated)}>
          {workflow.escalated ? 'Resolve escalation' : 'Mark urgent'}
        </button>
        <button className="btn" onClick={onVisit}>Log visit</button>
        <button className="btn btn-primary" disabled={!eligible || p.dischargeApproved} onClick={onApprove}
          title={p.dischargeApproved ? 'Already approved — awaiting bed release' : eligible ? 'Approve discharge' : `Needs ${CONFIG.NO_FEVER_DAYS_REQUIRED} consecutive no-fever days`}>
          {p.dischargeApproved ? 'Approved ✓' : 'Approve discharge'}
        </button>
        <button className="btn btn-ghost-danger" onClick={onDeath}>Record death</button>
      </div>
    </div>
  )
}

function VisitModal({ patient, onClose, onSave }) {
  const [note, setNote] = useState('')
  const today = todayStatus(patient)
  const noTemp = today.status === 'none'
  const already = visitedToday(patient)
  return (
    <Modal title={`Log visit — ${patient.name}`} onClose={onClose}>
      {noTemp && <div className="alert alert-warn">⚠ No temperature recorded for {patient.name} today. You can still proceed, but reviewing before the reading is in is discouraged.</div>}
      {already.visited && <div className="alert alert-warn">⚠ Already visited today by {already.visits[already.visits.length - 1].by}.</div>}
      <div className="form-row">
        <label>Treatment / visit note</label>
        <textarea autoFocus rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Assessment, plan, medication…" />
      </div>
      <div className="form-meta muted">{ROLES.doctor.user} · {new Date().toLocaleString()}</div>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!note.trim()} onClick={() => onSave(note.trim())}>Save note</button>
      </div>
    </Modal>
  )
}

function DeathModal({ patient, onClose, onSave }) {
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState(false)
  return (
    <Modal title={`Record death — ${patient.name}`} onClose={onClose}>
      <div className="alert alert-danger">This is irreversible and frees bed #{patient.bed}. It feeds the facility mortality metric.</div>
      <div className="form-row">
        <label>Cause / note (optional)</label>
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <label className="toggle"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> I confirm this record is correct.</label>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" disabled={!confirm} onClick={() => onSave(note.trim())}>Record death</button>
      </div>
    </Modal>
  )
}
