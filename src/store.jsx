// ---------------------------------------------------------------------------
// App state: a single source of truth (patients + audit log) held in a reducer
// and persisted to localStorage. Every mutating action is funnelled through
// here so permission rules and the audit trail are enforced in one place.
// ---------------------------------------------------------------------------

import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { buildSeed } from './seed.js'
import { isDischargeEligible } from './logic.js'
import { CONFIG } from './constants.js'

const STORAGE_KEY = 'recovery-centre-state-v2'

let _seq = 0
const newId = (p) => `${p}-${Date.now().toString(36)}-${_seq++}`

function init() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (_) { /* ignore */ }
  return buildSeed()
}

function logEntry(state, entry) {
  return [{ id: newId('l'), ts: Date.now(), ...entry }, ...state.log].slice(0, 200)
}

function activeCount(patients) {
  return patients.filter((p) => p.status === 'active').length
}

function reducer(state, action) {
  switch (action.type) {
    // -- Nurse: record a temperature -------------------------------------
    case 'RECORD_TEMP': {
      const { patientId, tempF, by, note = '', needsRecheck = false, escalated = false, overrideReason = '' } = action
      const patients = state.patients.map((p) => {
        if (p.id !== patientId) return p
        const reading = { id: newId('r'), tempF, ts: Date.now(), by, note, needsRecheck, escalated, overrideReason }
        return { ...p, escalated: p.escalated || escalated, readings: [...p.readings, reading] }
      })
      const p = patients.find((x) => x.id === patientId)
      return {
        ...state,
        patients,
        log: logEntry(state, {
          user: by, role: 'nurse', action: 'Recorded temperature',
          detail: `${p.name} — ${tempF}°F`
        })
      }
    }

    case 'SET_ESCALATION': {
      const { patientId, escalated, by } = action
      const target = state.patients.find((p) => p.id === patientId)
      if (!target || target.status !== 'active') return state
      const patients = state.patients.map((p) => p.id === patientId ? { ...p, escalated } : p)
      return {
        ...state, patients,
        log: logEntry(state, {
          user: by, role: 'doctor', action: escalated ? 'Escalated urgent case' : 'Resolved escalation', detail: target.name
        })
      }
    }

    // -- Doctor: log a visit / treatment note ----------------------------
    case 'ADD_VISIT': {
      const { patientId, note, by } = action
      const patients = state.patients.map((p) =>
        p.id === patientId
          ? { ...p, visits: [...p.visits, { id: newId('v'), ts: Date.now(), by, note }] }
          : p
      )
      const p = patients.find((x) => x.id === patientId)
      return {
        ...state, patients,
        log: logEntry(state, { user: by, role: 'doctor', action: 'Logged visit', detail: `${p.name}` })
      }
    }

    // -- Doctor: approve discharge (guarded by eligibility) --------------
    case 'APPROVE_DISCHARGE': {
      const { patientId, by } = action
      const target = state.patients.find((p) => p.id === patientId)
      if (!target || !isDischargeEligible(target)) return state // guard
      const patients = state.patients.map((p) =>
        p.id === patientId ? { ...p, dischargeApproved: true, dischargeApprovedTs: Date.now(), dischargeApprovedBy: by } : p
      )
      return {
        ...state, patients,
        log: logEntry(state, { user: by, role: 'doctor', action: 'Approved discharge', detail: target.name })
      }
    }

    // -- Admin: complete a discharge (frees the bed) ---------------------
    case 'COMPLETE_DISCHARGE': {
      const { patientId, by, destination = '', followUp = '', instructions = '', note = '', checklist = {} } = action
      const target = state.patients.find((p) => p.id === patientId)
      if (!target || !target.dischargeApproved || target.status !== 'active') return state
      const patients = state.patients.map((p) =>
        p.id === patientId
          ? {
              ...p,
              status: 'discharged',
              outcomeBed: p.bed,
              bed: null,
              outcomeTs: Date.now(),
              outcomeBy: by,
              discharge: { destination, followUp, instructions, note, checklist, completedBy: by, completedTs: Date.now() }
            }
          : p
      )
      return {
        ...state, patients,
        log: logEntry(state, { user: by, role: 'admin', action: 'Completed discharge', detail: `${target.name} — bed ${target.bed} released` })
      }
    }

    // -- Doctor: record a death ------------------------------------------
    case 'RECORD_DEATH': {
      const { patientId, note, by } = action
      const target = state.patients.find((p) => p.id === patientId)
      if (!target || target.status !== 'active') return state
      const patients = state.patients.map((p) =>
        p.id === patientId
          ? { ...p, status: 'deceased', bed: null, outcomeTs: Date.now(), outcomeBy: by, outcomeNote: note }
          : p
      )
      return {
        ...state, patients,
        log: logEntry(state, { user: by, role: 'doctor', action: 'Recorded death', detail: target.name })
      }
    }

    // -- Admin: admit a new patient (hard-capped at capacity) ------------
    case 'ADMIT': {
      const {
        name,
        by,
        age = '',
        sex = '',
        reason = '',
        acuity = 'Routine',
        source = 'Walk-in',
        contact = '',
        phone = '',
        notes = ''
      } = action
      if (activeCount(state.patients) >= CONFIG.BED_CAPACITY) return state // guard
      const bed = state.nextBed
      const patient = {
        id: newId('p'), name, bed, admittedTs: Date.now(),
        status: 'active', dischargeApproved: false, readings: [], visits: [],
        onboarding: { age, sex, reason, acuity, source, contact, phone, notes, admittedBy: by }
      }
      return {
        ...state,
        patients: [...state.patients, patient],
        nextBed: state.nextBed + 1,
        log: logEntry(state, { user: by, role: 'admin', action: 'Admitted patient', detail: `${name} — bed ${bed}` })
      }
    }

    case 'RESET':
      return buildSeed()

    default:
      return state
  }
}

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, init)
  const value = useMemo(() => ({ state, dispatch }), [state])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch (_) { /* ignore */ }
  }, [state])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
