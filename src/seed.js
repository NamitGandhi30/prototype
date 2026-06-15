// ---------------------------------------------------------------------------
// Curated, DETERMINISTic demo data — small enough to trace a single patient
// across every role. 10 active patients with distinct, story-driven states,
// plus a back-catalogue of completed outcomes so the facility metrics have
// history. Generated relative to "today" so the discharge clock always lines
// up no matter when you run it.
//
// Tip for the demo: record a temperature for "Aarav Sharma" as the nurse —
// it lifts him to a 3-day no-fever streak, so the doctor can then approve his
// discharge and admin can release his bed. One patient, the whole pipeline.
// ---------------------------------------------------------------------------

let _seq = 0
const nid = (p) => `${p}-${_seq++}`

// Fixed temperatures so the demo is identical every run.
const TEMP = { clear: 98.4, fever: 101.2, highFever: 103.4 }

function dayAt(daysAgo, hour, minute = 15) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, minute, 0, 0)
  return d.getTime()
}

// pattern chars map today -> older, left to right:
//   c = clear reading   f = febrile reading   F = high febrile reading
//   - = no reading that day
function patient({ name, bed, pattern, approved = false, visitNote }) {
  const readings = []
  pattern.split('').forEach((ch, daysAgo) => {
    if (ch === 'c') readings.push({ id: nid('r'), tempF: TEMP.clear, ts: dayAt(daysAgo, 8), by: 'Nurse Ortiz' })
    else if (ch === 'f') readings.push({ id: nid('r'), tempF: TEMP.fever, ts: dayAt(daysAgo, 8), by: 'Nurse Ortiz' })
    else if (ch === 'F') readings.push({ id: nid('r'), tempF: TEMP.highFever, ts: dayAt(daysAgo, 8), by: 'Nurse Ortiz' })
  })
  const visits = []
  if (visitNote) visits.push({ id: nid('v'), ts: dayAt(0, 10), by: 'Dr. Lee', note: visitNote })
  return {
    id: nid('p'), name, bed,
    admittedTs: dayAt(pattern.length + 1, 9),
    status: 'active', dischargeApproved: approved,
    readings, visits
  }
}

export function buildSeed() {
  _seq = 0
  const active = [
    // ⭐ Demo star: pending today, 2 clear behind. Record a clear temp now and
    //    his streak hits 3 -> discharge-ready.
    patient({ name: 'Aarav Sharma', bed: 1, pattern: '-cc' }),
    // Already discharge-ready (4 clear days). Doctor can approve immediately.
    patient({ name: 'Maria Garcia', bed: 2, pattern: 'cccc', visitNote: 'Afebrile, stable. Reviewing for discharge.' }),
    // High fever TODAY -> HIGH FEVER flag, top of doctor's list.
    patient({ name: 'Chen Wong', bed: 3, pattern: 'Fcc' }),
    // Just admitted: only a pending temp, no history.
    patient({ name: 'Fatima Khan', bed: 4, pattern: '-' }),
    // Mid-recovery, streak 2.
    patient({ name: 'James Miller', bed: 5, pattern: 'cc' }),
    // Fever yesterday broke the streak -> streak 1 today.
    patient({ name: 'Priya Patel', bed: 6, pattern: 'cfc' }),
    // Persistently febrile.
    patient({ name: 'Omar Hassan', bed: 7, pattern: 'fff' }),
    // Clear today + yesterday, older fever -> streak 2.
    patient({ name: 'Lena Novak', bed: 8, pattern: 'ccf' }),
    // Doctor-approved, sitting in the admin discharge queue.
    patient({ name: 'Diego Ramos', bed: 9, pattern: 'ccc', approved: true, visitNote: 'Meets criterion. Cleared for discharge.' }),
    patient({ name: 'Yuki Tanaka', bed: 10, pattern: 'cccc', approved: true, visitNote: 'Afebrile 4 days. Ready for bed release.' })
  ]

  // ---- completed outcomes for the facility dashboard ----------------------
  // 22 recovered + 3 deaths => 88% recovery / 12% mortality (within benchmark).
  const FIRST = ['Noah', 'Amara', 'Tomas', 'Ines', 'Kwame', 'Sara', 'Viktor', 'Mei', 'Hugo', 'Zara', 'Pablo', 'Nadia', 'Ravi', 'Elsa', 'Kofi', 'Anita', 'Liam', 'Rosa', 'Igor', 'Tara', 'Hana', 'Ben', 'Ada', 'Cyrus', 'Nell']
  const LAST = ['Brown', 'Okoye', 'Silva', 'Costa', 'Mensah', 'Ali', 'Petrov', 'Lin', 'Dubois', 'Haddad']
  const outcomes = []
  for (let k = 0; k < 22; k++) {
    outcomes.push({
      id: nid('p'), name: `${FIRST[k % FIRST.length]} ${LAST[k % LAST.length]}`,
      bed: null, admittedTs: dayAt(12 + (k % 6), 9), status: 'discharged',
      dischargeApproved: true, readings: [], visits: [],
      outcomeTs: dayAt(2 + (k % 8), 14), outcomeBy: 'Admin Patel'
    })
  }
  for (let k = 0; k < 3; k++) {
    outcomes.push({
      id: nid('p'), name: `${FIRST[(k + 22) % FIRST.length]} ${LAST[(k + 5) % LAST.length]}`,
      bed: null, admittedTs: dayAt(15 + k, 9), status: 'deceased',
      dischargeApproved: false, readings: [], visits: [],
      outcomeTs: dayAt(4 + k, 16), outcomeBy: 'Dr. Lee', outcomeNote: 'Cardiac complication.'
    })
  }

  const patients = [...active, ...outcomes]
  return {
    patients,
    nextBed: 11,
    log: [
      { id: nid('l'), ts: dayAt(0, 8), user: 'Nurse Ortiz', role: 'nurse', action: 'Recorded temperature', detail: 'Morning round started' }
    ]
  }
}
