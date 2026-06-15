// ---------------------------------------------------------------------------
// Pure domain logic. These functions encode the "invisible" rules from Q3 —
// fever definition, the discharge clock, eligibility, and facility metrics.
// Kept side-effect-free so they can be unit-tested independently of the UI.
// ---------------------------------------------------------------------------

import { CONFIG } from './constants.js'

// The facility "day" is a local calendar day. dayKey collapses a timestamp to
// the day it belongs to so all per-day logic resets on the day boundary.
export function dayKey(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function isFebrile(tempF) {
  return tempF >= CONFIG.FEVER_THRESHOLD_F
}

export function isHighFever(tempF) {
  return tempF >= CONFIG.HIGH_FEVER_F
}

// Validate a raw temperature entry. Returns { ok, error?, warn? }.
export function validateTemp(tempF) {
  if (Number.isNaN(tempF)) return { ok: false, error: 'Enter a number.' }
  if (tempF < CONFIG.TEMP_MIN_VALID_F || tempF > CONFIG.TEMP_MAX_VALID_F) {
    return {
      ok: false,
      error: `Reading must be between ${CONFIG.TEMP_MIN_VALID_F}°F and ${CONFIG.TEMP_MAX_VALID_F}°F — looks like a data error.`
    }
  }
  if (isHighFever(tempF)) {
    return { ok: true, warn: `High fever (≥${CONFIG.HIGH_FEVER_F}°F) — flag to doctor.` }
  }
  return { ok: true }
}

// Group a patient's readings into { dayKey: [readings...] }.
function readingsByDay(readings) {
  const map = {}
  for (const r of readings) {
    const k = dayKey(r.ts)
    ;(map[k] ||= []).push(r)
  }
  return map
}

// A day's fever status:
//   'none'    -> no reading exists that day (can't certify it)
//   'febrile' -> at least one febrile reading (any febrile reading makes the
//                whole day febrile, so a later normal reading can't "clear" it)
//   'clear'   -> a reading exists and none were febrile
export function dayStatusFor(readings) {
  if (!readings || readings.length === 0) return 'none'
  return readings.some((r) => isFebrile(r.tempF)) ? 'febrile' : 'clear'
}

// Today's reading status for a patient.
export function todayStatus(patient, today = Date.now()) {
  const k = dayKey(today)
  const todays = (patient.readings || []).filter((r) => dayKey(r.ts) === k)
  return { status: dayStatusFor(todays), readings: todays }
}

// Consecutive no-fever days counting backward from today.
//   - a 'clear' day extends the streak
//   - a 'febrile' day resets it to zero
//   - a 'none' (un-measured) PAST day is a gap that breaks the streak — you
//     cannot certify a day you never measured
//   - 'none' on TODAY does not break it: today simply isn't done yet
export function noFeverStreak(patient, today = Date.now()) {
  const byDay = readingsByDay(patient.readings || [])
  let streak = 0
  const cursor = new Date(today)
  cursor.setHours(12, 0, 0, 0) // anchor to midday to avoid DST edge cases
  for (let offset = 0; offset < 60; offset++) {
    const d = new Date(cursor)
    d.setDate(cursor.getDate() - offset)
    const status = dayStatusFor(byDay[dayKey(d.getTime())])
    if (status === 'clear') {
      streak++
    } else if (status === 'none' && offset === 0) {
      continue // today pending — neither counts nor breaks
    } else {
      break // febrile any day, or an un-measured past day
    }
  }
  return streak
}

export function isDischargeEligible(patient, today = Date.now()) {
  return (
    patient.status === 'active' &&
    noFeverStreak(patient, today) >= CONFIG.NO_FEVER_DAYS_REQUIRED
  )
}

export function visitedToday(patient, today = Date.now()) {
  const k = dayKey(today)
  const v = (patient.visits || []).filter((x) => dayKey(x.ts) === k)
  return { visited: v.length > 0, visits: v }
}

export function latestReading(patient) {
  if (!patient.readings || patient.readings.length === 0) return null
  return [...patient.readings].sort((a, b) => b.ts - a.ts)[0]
}

// Most recent N readings, newest first.
export function recentReadings(patient, n = 5) {
  return [...(patient.readings || [])].sort((a, b) => b.ts - a.ts).slice(0, n)
}

// ---- Facility-level metrics (facility-lead dashboard) ----------------------
export function facilityMetrics(patients) {
  const active = patients.filter((p) => p.status === 'active')
  const discharged = patients.filter((p) => p.status === 'discharged')
  const deceased = patients.filter((p) => p.status === 'deceased')
  const outcomes = discharged.length + deceased.length

  return {
    activeCount: active.length,
    occupancy: active.length,
    capacity: CONFIG.BED_CAPACITY,
    occupancyPct: active.length / CONFIG.BED_CAPACITY,
    dischargedCount: discharged.length,
    deceasedCount: deceased.length,
    outcomes,
    successRate: outcomes ? discharged.length / outcomes : null,
    mortalityRate: outcomes ? deceased.length / outcomes : null
  }
}
