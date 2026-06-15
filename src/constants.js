// ---------------------------------------------------------------------------
// Single source of clinical + operational config (Q3: "make this a config value,
// not hardcoded"). Change a rule here and the whole app follows.
// ---------------------------------------------------------------------------

export const CONFIG = {
  // A reading at or above this is "febrile".
  FEVER_THRESHOLD_F: 100.4,
  // At or above this, raise a high-fever alert to the doctor.
  HIGH_FEVER_F: 103,
  // Anything outside this range is treated as a data-entry error, not a reading.
  TEMP_MIN_VALID_F: 95,
  TEMP_MAX_VALID_F: 110,
  // Consecutive no-fever days required before a patient is discharge-eligible.
  NO_FEVER_DAYS_REQUIRED: 3,
  // Hard bed cap for the facility.
  BED_CAPACITY: 74,
  // Quality benchmarks for the facility-lead dashboard.
  SUCCESS_BENCHMARK: 0.85, // recoveries / outcomes should stay >= 85%
  MORTALITY_BENCHMARK: 0.15 // deaths / outcomes should stay <= 15%
}

// Roles are the backbone of the permission model (Q1). Each role sees one view
// and owns a disjoint set of actions.
export const ROLES = {
  nurse: {
    key: 'nurse',
    label: 'Nurse',
    user: 'Nurse Adams',
    email: 'nurse@recovery.demo',
    tagline: 'Daily temperature capture',
    color: '#2563eb'
  },
  doctor: {
    key: 'doctor',
    label: 'Doctor',
    user: 'Dr. Lee',
    email: 'doctor@recovery.demo',
    tagline: 'Clinical review & discharge approval',
    color: '#0d9488'
  },
  admin: {
    key: 'admin',
    label: 'Admin / Front desk',
    user: 'Admin Patel',
    email: 'admin@recovery.demo',
    tagline: 'Admissions & bed throughput',
    color: '#9333ea'
  },
  lead: {
    key: 'lead',
    label: 'Facility lead',
    user: 'Dr. Rao (Head)',
    email: 'lead@recovery.demo',
    tagline: 'Quality & safety oversight (read-only)',
    color: '#b45309'
  }
}

export const ROLE_ORDER = ['nurse', 'doctor', 'admin', 'lead']

export const DEMO_PASSWORD = 'demo123'
