# Recovery Centre — Workflow Prototype

A role-based, execution-first React app for the recovery-centre case study. It makes sure each
patient is **measured once per day, reviewed once per day, and discharged on time when eligible** —
the three things the current journal-based process gets wrong.

## Run it

```bash
npm install
npm run dev      # opens http://localhost:5173
```

Choose a demo account on the sign-in screen and use password **`demo123`**. Each account opens its
role-specific workspace; sign out to switch between Nurse, Doctor, Admin, and Facility lead.
Data persists in your browser (localStorage); **Reset demo data** in the quick bar restores the seed.

## How the code maps to the analysis

### Q1 — roles (`src/components/*View.jsx`)
Each role gets one view and a disjoint set of actions:

| Role | View | Owns |
|---|---|---|
| Nurse | `NurseView` | Record temperature; per-patient "pending / recorded" status; round progress meter |
| Doctor | `DoctorView` | Log visit, approve discharge (gated), record death; febrile/not-seen sort to top |
| Admin / front desk | `AdminView` | Live occupancy vs cap, discharge queue, admit (hard-capped) |
| Facility lead | `FacilityView` | Read-only: recovery vs 85%, mortality vs 15%, occupancy, audit feed |

### Q3 — business rules
- **Fever / discharge clock** — `src/logic.js`: `isFebrile`, `dayStatusFor`, `noFeverStreak`,
  `isDischargeEligible`. A day is "clear" only if it has a reading and none are febrile; any
  febrile reading makes the whole day febrile; an un-measured past day breaks the streak; today
  pending neither counts nor breaks.
- **Temp validation** — `validateTemp` rejects <95/>110°F as data error, flags ≥103°F as high fever.
- **Two-step discharge** — doctor `APPROVE_DISCHARGE` (guarded by eligibility) then admin
  `COMPLETE_DISCHARGE` actually frees the bed (`src/store.jsx`).
- **Capacity** — `ADMIT` is hard-blocked at `BED_CAPACITY` (74); the admit control disables and explains.
- **Permissions** — enforced by view + by guards in the reducer; every action writes an audit log entry.
- **Config, not magic numbers** — all thresholds live in `src/constants.js`.

## Project layout
```
src/
  constants.js   clinical + operational config, role definitions
  logic.js       pure domain logic (fever, streak, eligibility, metrics)
  seed.js        demo data generated relative to "today"
  store.jsx      reducer + localStorage + audit log (single source of truth)
  App.jsx        shell + role switcher
  components/     one file per role view + shared UI primitives
```
