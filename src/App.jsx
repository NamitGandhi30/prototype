import React, { useState } from 'react'
import { useStore } from './store.jsx'
import { ROLES, ROLE_ORDER, CONFIG, DEMO_PASSWORD } from './constants.js'
import { facilityMetrics } from './logic.js'
import NurseView from './components/NurseView.jsx'
import DoctorView from './components/DoctorView.jsx'
import AdminView from './components/AdminView.jsx'
import FacilityView from './components/FacilityView.jsx'

const VIEWS = { nurse: NurseView, doctor: DoctorView, admin: AdminView, lead: FacilityView }
const SESSION_KEY = 'recovery-centre-session'

function initialRole() {
  try {
    const role = sessionStorage.getItem(SESSION_KEY)
    return VIEWS[role] ? role : null
  } catch (_) {
    return null
  }
}

export default function App() {
  const { state, dispatch } = useStore()
  const [role, setRole] = useState(initialRole)

  const signIn = (nextRole) => {
    try { sessionStorage.setItem(SESSION_KEY, nextRole) } catch (_) { /* ignore */ }
    setRole(nextRole)
  }

  const signOut = () => {
    try { sessionStorage.removeItem(SESSION_KEY) } catch (_) { /* ignore */ }
    setRole(null)
  }

  if (!role) return <SignIn onSignIn={signIn} />

  const View = VIEWS[role]
  const m = facilityMetrics(state.patients)
  const active = ROLES[role]

  const today = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())

  return (
    <div className="app" style={{ '--role-color': active.color }}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">+</div>
          <div>
            <div className="brand-title">Recovery Centre</div>
            <div className="brand-sub">Clinical operations system</div>
          </div>
        </div>

        <div className="topbar-right">
          <div className="who">
            <span className="who-dot" />
            <div>
              <div className="who-name">{active.user}</div>
              <div className="who-tag">{active.tagline}</div>
            </div>
          </div>
          <button className="btn account-btn" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <section className="workspace-head">
        <div>
          <div className="workspace-kicker"><span /> {active.label} workspace</div>
          <h1>{active.tagline}</h1>
          <p>{today} · Live operational view</p>
        </div>
        <div className="workspace-seal" aria-hidden="true">
          <span>{active.user.charAt(0)}</span>
          <small>{active.label}</small>
        </div>
      </section>

      <div className="quickbar">
        <div className="quick-stat"><span>Occupancy</span><strong>{m.occupancy}<small> / {CONFIG.BED_CAPACITY}</small></strong></div>
        <div className="quick-stat"><span>Awaiting discharge</span><strong>{state.patients.filter((p) => p.status === 'active' && p.dischargeApproved).length}</strong></div>
        <div className="quick-stat"><span>Recovered</span><strong>{m.dischargedCount}</strong></div>
        <div className="quick-stat"><span>Exceptions</span><strong>{m.escalatedCount + m.tempPendingCount}</strong></div>
        <button className="link-btn danger" onClick={() => { if (confirm('Reset all demo data?')) dispatch({ type: 'RESET' }) }}>
          Reset demo data
        </button>
      </div>

      <main className="content">
        <View />
      </main>

      <footer className="footer muted small">
        Recovery Centre prototype · role-scoped workflow · local demo data
      </footer>
    </div>
  )
}

function SignIn({ onSignIn }) {
  const [selected, setSelected] = useState('nurse')
  const [password, setPassword] = useState(DEMO_PASSWORD)
  const [error, setError] = useState('')
  const active = ROLES[selected]

  const submit = (event) => {
    event.preventDefault()
    if (password !== DEMO_PASSWORD) {
      setError('That demo password is not correct.')
      return
    }
    onSignIn(selected)
  }

  return (
    <main className="signin-shell">
      <section className="signin-story">
        <div className="signin-brand">
          <div className="brand-mark">+</div>
          <span>Recovery Centre</span>
        </div>
        <div className="signin-copy">
          <p className="eyebrow">Care operations, connected</p>
          <h1>One centre.<br />Four clear roles.</h1>
          <p>Sign in to a focused workspace built around the decisions you make each day.</p>
        </div>
        <div className="signin-proof">
          <span><strong>{CONFIG.BED_CAPACITY}</strong> beds monitored</span>
          <span><strong>4</strong> role-specific workspaces</span>
        </div>
      </section>

      <section className="signin-panel">
        <form className="signin-card" onSubmit={submit}>
          <div>
            <p className="eyebrow">Demo access</p>
            <h2>Choose your workspace</h2>
            <p className="muted">Each account opens only the tools assigned to that role.</p>
          </div>

          <div className="account-grid" role="radiogroup" aria-label="Demo account">
            {ROLE_ORDER.map((key) => {
              const account = ROLES[key]
              return (
                <button
                  type="button"
                  key={key}
                  role="radio"
                  aria-checked={selected === key}
                  className={`account-option ${selected === key ? 'selected' : ''}`}
                  style={{ '--account-color': account.color }}
                  onClick={() => { setSelected(key); setError('') }}
                >
                  <span className="account-initial">{account.user.charAt(0)}</span>
                  <span><strong>{account.user}</strong><small>{account.label}</small></span>
                  <span className="account-check">✓</span>
                </button>
              )
            })}
          </div>

          <div className="selected-account">
            <span className="status-light" style={{ background: active.color }} />
            <span><strong>{active.email}</strong><small>{active.tagline}</small></span>
          </div>

          <div className="form-row signin-password">
            <label htmlFor="password">Demo password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => { setPassword(event.target.value); setError('') }}
              autoComplete="current-password"
            />
            <div className="demo-hint">Use <code>{DEMO_PASSWORD}</code> for every account.</div>
          </div>

          {error && <div className="signin-error" role="alert">{error}</div>}

          <button className="btn btn-primary signin-submit" type="submit">
            Continue as {active.label}
          </button>
          <p className="signin-disclaimer">Demo only. No real patient or staff credentials are used.</p>
        </form>
      </section>
    </main>
  )
}
