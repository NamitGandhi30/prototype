// Admin / front desk: throughput owner. Handles richer patient onboarding,
// discharge completion, bed pressure, and handoff aging.
import React, { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { ROLES, CONFIG } from '../constants.js'
import { dayKey, facilityMetrics } from '../logic.js'
import { Badge, Bar, Modal, StatCard, fmtTime, timeAgo } from './ui.jsx'
import PatientDrawer from './PatientDrawer.jsx'

const EMPTY_ADMISSION = {
  name: '',
  age: '',
  sex: '',
  reason: '',
  acuity: 'Routine',
  source: 'Walk-in',
  contact: '',
  phone: '',
  notes: ''
}

const EMPTY_DISCHARGE = {
  destination: 'Home',
  followUp: '',
  instructions: '',
  note: '',
  checklist: {
    identity: false,
    medicines: false,
    followup: false,
    billing: false
  }
}

export default function AdminView() {
  const { state, dispatch } = useStore()
  const me = ROLES.admin.user
  const m = useMemo(() => facilityMetrics(state.patients), [state.patients])
  const full = m.occupancy >= CONFIG.BED_CAPACITY

  const queue = useMemo(
    () => state.patients
      .filter((p) => p.status === 'active' && p.dischargeApproved)
      .sort((a, b) => (a.dischargeApprovedTs || 0) - (b.dischargeApprovedTs || 0)),
    [state.patients]
  )
  const dischargeHistory = useMemo(
    () => state.patients
      .filter((p) => p.status === 'discharged')
      .sort((a, b) => (b.outcomeTs || 0) - (a.outcomeTs || 0))
      .slice(0, 8),
    [state.patients]
  )
  const analytics = useMemo(() => adminAnalytics(state.patients, queue, m), [m, queue, state.patients])

  const [admission, setAdmission] = useState(EMPTY_ADMISSION)
  const [historyFor, setHistoryFor] = useState(null)
  const [dischargeFor, setDischargeFor] = useState(null)

  const ageNum = Number(admission.age)
  const ageInvalid = admission.age && (Number.isNaN(ageNum) || ageNum < 0 || ageNum > 120)
  const canAdmit = !full && admission.name.trim() && admission.reason.trim() && !ageInvalid

  const updateAdmission = (field, value) => {
    setAdmission((current) => ({ ...current, [field]: value }))
  }

  const admit = (event) => {
    event.preventDefault()
    if (!canAdmit) return
    dispatch({
      type: 'ADMIT',
      by: me,
      name: admission.name.trim(),
      age: admission.age.trim(),
      sex: admission.sex,
      reason: admission.reason.trim(),
      acuity: admission.acuity,
      source: admission.source,
      contact: admission.contact.trim(),
      phone: admission.phone.trim(),
      notes: admission.notes.trim()
    })
    setAdmission(EMPTY_ADMISSION)
  }

  return (
    <div>
      <div className="view-head">
        <div>
          <h2>Admissions & beds</h2>
          <p className="muted">Tighter intake, deliberate discharge completion, and a clearer picture of bed flow.</p>
        </div>
      </div>

      <div className="stat-grid admin-stat-grid">
        <StatCard label="Bed pressure" value={`${m.occupancy}/${CONFIG.BED_CAPACITY}`} sub={`${CONFIG.BED_CAPACITY - m.occupancy} free beds`} tone={m.occupancyPct > 0.9 ? 'warn' : 'neutral'} />
        <StatCard label="Ready to release" value={queue.length} sub={queue.length ? `oldest handoff ${analytics.oldestQueueWait}` : 'no admin queue'} tone={queue.length ? 'warn' : 'ok'} />
        <StatCard label="Avg active stay" value={analytics.avgActiveStay} sub={`longest ${analytics.longestActiveStay}`} tone="neutral" />
        <StatCard label="Today flow" value={`+${analytics.admissionsToday} / -${analytics.dischargesToday}`} sub="admitted / discharged" tone={analytics.dischargesToday >= analytics.admissionsToday ? 'ok' : 'warn'} />
      </div>

      <div className="occupancy-card admin-flow-card">
        <div className="progress-top">
          <span><strong>{m.occupancy}</strong> / {CONFIG.BED_CAPACITY} beds occupied</span>
          <span className={full ? 'pill pill-danger' : 'pill pill-ok'}>{full ? 'FULL' : `${CONFIG.BED_CAPACITY - m.occupancy} free`}</span>
        </div>
        <Bar pct={m.occupancyPct} tone={full ? 'danger' : m.occupancyPct > 0.9 ? 'warn' : 'brand'} />
        <div className="admin-analytics-strip">
          <span><strong>{analytics.highAcuity}</strong> high acuity active</span>
          <span><strong>{analytics.routineAcuity}</strong> routine active</span>
          <span><strong>{analytics.queueShare}</strong> of active beds awaiting release</span>
        </div>
      </div>

      {queue.length > 0 && (
        <div className="handoff-alert">
          <strong>{queue.length} doctor handoff{queue.length === 1 ? '' : 's'} ready</strong>
          <span>Oldest handoff has been waiting {analytics.oldestQueueWait}. Complete discharge processing to open capacity.</span>
        </div>
      )}

      <div className="two-col admin-main-grid">
        <section className="panel">
          <h3>Discharge queue <Badge tone={queue.length ? 'warn' : 'ok'}>{queue.length}</Badge></h3>
          <p className="muted small">Doctor-approved, awaiting checklist, destination, and release notes.</p>
          <div className="card-list">
            {queue.map((p) => (
              <div className="patient-row admin-queue-row" key={p.id}>
                <div className="pr-bed">#{p.bed}</div>
                <div className="pr-main">
                  <div className="pr-name">
                    {p.name}
                    {p.onboarding?.acuity && <Badge tone={p.onboarding.acuity === 'High' ? 'danger' : p.onboarding.acuity === 'Watch' ? 'warn' : 'neutral'}>{p.onboarding.acuity}</Badge>}
                  </div>
                  <div className="pr-meta muted">
                    {p.dischargeApprovedBy || 'Doctor'} handoff
                    {p.dischargeApprovedTs ? ` ${timeAgo(p.dischargeApprovedTs)}` : ''} - admitted {fmtTime(p.admittedTs)}
                  </div>
                  {p.onboarding?.reason && <div className="queue-reason">{p.onboarding.reason}</div>}
                </div>
                <div className="pr-actions">
                  <button className="btn" onClick={() => setHistoryFor(p.id)}>History</button>
                  <button className="btn btn-primary" onClick={() => setDischargeFor(p)}>
                    Complete form
                  </button>
                </div>
              </div>
            ))}
            {queue.length === 0 && <div className="empty">No patients awaiting discharge.</div>}
          </div>
        </section>

        <section className="panel onboarding-panel">
          <h3>Patient onboarding <Badge tone={full ? 'danger' : 'info'}>{full ? 'blocked' : `bed #${state.nextBed}`}</Badge></h3>
          <p className="muted small">{full ? 'Facility is at capacity. Complete a discharge before admitting.' : 'Capture the minimum operational context before the first clinical round.'}</p>
          <form onSubmit={admit}>
            <div className="form-grid">
              <div className="form-row field-span-2">
                <label>Patient name</label>
                <input value={admission.name} onChange={(e) => updateAdmission('name', e.target.value)} placeholder="Full name" disabled={full} />
              </div>
              <div className="form-row">
                <label>Age</label>
                <input value={admission.age} onChange={(e) => updateAdmission('age', e.target.value)} placeholder="e.g. 42" inputMode="numeric" disabled={full} />
              </div>
              <div className="form-row">
                <label>Sex</label>
                <select value={admission.sex} onChange={(e) => updateAdmission('sex', e.target.value)} disabled={full}>
                  <option value="">Not specified</option>
                  <option>Female</option>
                  <option>Male</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="form-row">
                <label>Acuity</label>
                <select value={admission.acuity} onChange={(e) => updateAdmission('acuity', e.target.value)} disabled={full}>
                  <option>Routine</option>
                  <option>Watch</option>
                  <option>High</option>
                </select>
              </div>
              <div className="form-row">
                <label>Source</label>
                <select value={admission.source} onChange={(e) => updateAdmission('source', e.target.value)} disabled={full}>
                  <option>Walk-in</option>
                  <option>Referral</option>
                  <option>Transfer</option>
                  <option>Readmission</option>
                </select>
              </div>
              <div className="form-row field-span-2">
                <label>Reason for admission</label>
                <input value={admission.reason} onChange={(e) => updateAdmission('reason', e.target.value)} placeholder="Primary recovery need or diagnosis" disabled={full} />
              </div>
              <div className="form-row">
                <label>Emergency contact</label>
                <input value={admission.contact} onChange={(e) => updateAdmission('contact', e.target.value)} placeholder="Name" disabled={full} />
              </div>
              <div className="form-row">
                <label>Contact phone</label>
                <input value={admission.phone} onChange={(e) => updateAdmission('phone', e.target.value)} placeholder="Phone" disabled={full} />
              </div>
              <div className="form-row field-span-2">
                <label>Intake notes</label>
                <textarea rows={3} value={admission.notes} onChange={(e) => updateAdmission('notes', e.target.value)} placeholder="Mobility, allergies, isolation needs, family context" disabled={full} />
              </div>
            </div>
            {ageInvalid && <div className="alert alert-danger">Age should be a number between 0 and 120.</div>}
            {full && <div className="alert alert-danger">All {CONFIG.BED_CAPACITY} beds are occupied. Complete a discharge to free a bed before admitting.</div>}
            <div className="admission-summary">
              <span>Next bed <strong>#{state.nextBed}</strong></span>
              <span>{admission.acuity} acuity</span>
              <span>{admission.source}</span>
            </div>
            <button className="btn btn-primary signin-submit" type="submit" disabled={!canAdmit}>
              Admit patient
            </button>
          </form>
        </section>
      </div>

      <section className="panel discharge-log">
        <h3>Recent discharge log <Badge tone="neutral">{dischargeHistory.length}</Badge></h3>
        <div className="table-list">
          {dischargeHistory.map((p) => (
            <button className="table-row discharge-table-row" key={p.id} onClick={() => setHistoryFor(p.id)}>
              <span><strong>{p.name}</strong><small>Bed #{p.outcomeBed || '-'}</small></span>
              <span><strong>{fmtTime(p.outcomeTs)}</strong><small>{timeAgo(p.outcomeTs)}</small></span>
              <span><strong>{p.discharge?.destination || 'Discharged'}</strong><small>{p.outcomeBy}</small></span>
            </button>
          ))}
          {dischargeHistory.length === 0 && <div className="empty">No completed discharges yet.</div>}
        </div>
      </section>

      {dischargeFor && (
        <DischargeModal
          patient={dischargeFor}
          onClose={() => setDischargeFor(null)}
          onSave={(details) => {
            dispatch({ type: 'COMPLETE_DISCHARGE', patientId: dischargeFor.id, by: me, ...details })
            setDischargeFor(null)
          }}
        />
      )}
      {historyFor && <PatientDrawer patientId={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  )
}

function DischargeModal({ patient, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_DISCHARGE)
  const checklistDone = Object.values(form.checklist).every(Boolean)
  const canSave = form.destination && form.followUp && form.instructions.trim() && checklistDone

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const toggle = (field) => {
    setForm((current) => ({
      ...current,
      checklist: { ...current.checklist, [field]: !current.checklist[field] }
    }))
  }

  return (
    <Modal title={`Discharge ${patient.name}`} onClose={onClose}>
      <div className="discharge-brief">
        <div><span>Bed</span><strong>#{patient.bed}</strong></div>
        <div><span>Approved</span><strong>{patient.dischargeApprovedTs ? timeAgo(patient.dischargeApprovedTs) : 'ready'}</strong></div>
        <div><span>Admitted</span><strong>{fmtTime(patient.admittedTs)}</strong></div>
      </div>

      <div className="form-grid">
        <div className="form-row">
          <label>Discharge destination</label>
          <select value={form.destination} onChange={(e) => update('destination', e.target.value)}>
            <option>Home</option>
            <option>Family care</option>
            <option>Step-down facility</option>
            <option>Transferred hospital</option>
          </select>
        </div>
        <div className="form-row">
          <label>Follow-up date</label>
          <input type="date" value={form.followUp} onChange={(e) => update('followUp', e.target.value)} />
        </div>
        <div className="form-row field-span-2">
          <label>Patient instructions</label>
          <textarea rows={3} value={form.instructions} onChange={(e) => update('instructions', e.target.value)} placeholder="Medication, symptoms to watch, return precautions" />
        </div>
        <div className="form-row field-span-2">
          <label>Admin note</label>
          <textarea rows={2} value={form.note} onChange={(e) => update('note', e.target.value)} placeholder="Transport, documents, family handoff" />
        </div>
      </div>

      <div className="checklist-grid">
        <ChecklistItem checked={form.checklist.identity} onChange={() => toggle('identity')}>Identity verified</ChecklistItem>
        <ChecklistItem checked={form.checklist.medicines} onChange={() => toggle('medicines')}>Medicines explained</ChecklistItem>
        <ChecklistItem checked={form.checklist.followup} onChange={() => toggle('followup')}>Follow-up booked</ChecklistItem>
        <ChecklistItem checked={form.checklist.billing} onChange={() => toggle('billing')}>Billing cleared</ChecklistItem>
      </div>

      {!checklistDone && <div className="alert alert-warn">Complete every checklist item before releasing the bed.</div>}

      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!canSave} onClick={() => onSave(form)}>
          Release bed
        </button>
      </div>
    </Modal>
  )
}

function ChecklistItem({ checked, onChange, children }) {
  return (
    <label className={`check-card ${checked ? 'checked' : ''}`}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span>{children}</span>
    </label>
  )
}

function adminAnalytics(patients, queue, metrics) {
  const now = Date.now()
  const today = dayKey(now)
  const active = patients.filter((p) => p.status === 'active')
  const dischargedToday = patients.filter((p) => p.status === 'discharged' && p.outcomeTs && dayKey(p.outcomeTs) === today).length
  const admissionsToday = patients.filter((p) => p.admittedTs && dayKey(p.admittedTs) === today).length
  const activeStayMs = active.map((p) => now - p.admittedTs)
  const avgActiveMs = activeStayMs.length ? activeStayMs.reduce((sum, n) => sum + n, 0) / activeStayMs.length : null
  const longestActiveMs = activeStayMs.length ? Math.max(...activeStayMs) : null
  const oldestQueueMs = queue.length && queue[0].dischargeApprovedTs ? now - queue[0].dischargeApprovedTs : null
  const highAcuity = active.filter((p) => p.onboarding?.acuity === 'High').length
  const routineAcuity = active.filter((p) => !p.onboarding?.acuity || p.onboarding.acuity === 'Routine').length
  const queuePct = metrics.activeCount ? queue.length / metrics.activeCount : 0

  return {
    admissionsToday,
    dischargesToday: dischargedToday,
    avgActiveStay: formatDuration(avgActiveMs),
    longestActiveStay: formatDuration(longestActiveMs),
    oldestQueueWait: formatDuration(oldestQueueMs),
    highAcuity,
    routineAcuity,
    queueShare: `${Math.round(queuePct * 100)}%`
  }
}

function formatDuration(ms) {
  if (ms == null) return 'none'
  const hours = Math.max(1, Math.round(ms / 3600000))
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  const rem = hours % 24
  return rem ? `${days}d ${rem}h` : `${days}d`
}
