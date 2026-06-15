import React, { useState } from 'react'
import { useStore } from './store.jsx'
import { ROLES, ROLE_ORDER, CONFIG } from './constants.js'
import { facilityMetrics } from './logic.js'
import NurseView from './components/NurseView.jsx'
import DoctorView from './components/DoctorView.jsx'
import AdminView from './components/AdminView.jsx'
import FacilityView from './components/FacilityView.jsx'

const VIEWS = { nurse: NurseView, doctor: DoctorView, admin: AdminView, lead: FacilityView }

export default function App() {
  const { state, dispatch } = useStore()
  const [role, setRole] = useState('nurse')
  const View = VIEWS[role]
  const m = facilityMetrics(state.patients)
  const active = ROLES[role]

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">✚</div>
          <div>
            <div className="brand-title">Recovery Centre</div>
            <div className="brand-sub">Daily workflow · {CONFIG.BED_CAPACITY} beds</div>
          </div>
        </div>

        <nav className="role-switch" role="tablist" aria-label="Role">
          {ROLE_ORDER.map((k) => (
            <button
              key={k}
              className={`role-tab ${role === k ? 'active' : ''}`}
              style={role === k ? { '--role-color': ROLES[k].color } : undefined}
              onClick={() => setRole(k)}
            >
              {ROLES[k].label}
            </button>
          ))}
        </nav>

        <div className="topbar-right">
          <div className="who" style={{ '--role-color': active.color }}>
            <span className="who-dot" />
            <div>
              <div className="who-name">{active.user}</div>
              <div className="who-tag">{active.tagline}</div>
            </div>
          </div>
        </div>
      </header>

      <div className="quickbar">
        <span><strong>{m.occupancy}</strong>/{CONFIG.BED_CAPACITY} occupied</span>
        <span><strong>{state.patients.filter((p) => p.status === 'active' && p.dischargeApproved).length}</strong> awaiting discharge</span>
        <span><strong>{m.dischargedCount}</strong> recovered · <strong>{m.deceasedCount}</strong> died</span>
        <button className="link-btn danger" onClick={() => { if (confirm('Reset all demo data?')) dispatch({ type: 'RESET' }) }}>
          Reset demo data
        </button>
      </div>

      <main className="content">
        <View />
      </main>

      <footer className="footer muted small">
        Prototype · role-based recovery-centre workflow · data persists locally in your browser
      </footer>
    </div>
  )
}
