// Facility lead (head doctor): read-only quality view. Success rate vs the 85%
// benchmark, mortality vs 15%, occupancy, total outcomes — the thing the head
// doctor said they have no way to measure today. Plus a live audit feed.
import React from 'react'
import { useStore } from '../store.jsx'
import { CONFIG } from '../constants.js'
import { facilityMetrics } from '../logic.js'
import { StatCard, Bar, Badge, timeAgo } from './ui.jsx'

const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`)

export default function FacilityView() {
  const { state } = useStore()
  const m = facilityMetrics(state.patients)

  const successOk = m.successRate != null && m.successRate >= CONFIG.SUCCESS_BENCHMARK
  const mortalityOk = m.mortalityRate != null && m.mortalityRate <= CONFIG.MORTALITY_BENCHMARK

  return (
    <div>
      <div className="view-head">
        <div>
          <h2>Quality & safety oversight</h2>
          <p className="muted">Read-only. Benchmarks: ≥{pct(CONFIG.SUCCESS_BENCHMARK)} recovery, ≤{pct(CONFIG.MORTALITY_BENCHMARK)} mortality.</p>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Occupancy" value={`${m.occupancy}/${m.capacity}`} sub={`${pct(m.occupancyPct)} full`} tone={m.occupancyPct > 0.9 ? 'warn' : 'neutral'} />
        <StatCard label="Recovery rate" value={pct(m.successRate)} sub={successOk ? `✓ at/above ${pct(CONFIG.SUCCESS_BENCHMARK)}` : `✗ below ${pct(CONFIG.SUCCESS_BENCHMARK)}`} tone={successOk ? 'ok' : 'danger'} />
        <StatCard label="Mortality rate" value={pct(m.mortalityRate)} sub={mortalityOk ? `✓ within ${pct(CONFIG.MORTALITY_BENCHMARK)}` : `✗ above ${pct(CONFIG.MORTALITY_BENCHMARK)}`} tone={mortalityOk ? 'ok' : 'danger'} />
        <StatCard label="Total outcomes" value={m.outcomes} sub={`${m.dischargedCount} recovered · ${m.deceasedCount} died`} />
      </div>

      <div className="two-col">
        <section className="panel">
          <h3>Recovery rate vs benchmark</h3>
          <BenchmarkBar value={m.successRate} benchmark={CONFIG.SUCCESS_BENCHMARK} good="above" />
          <h3 style={{ marginTop: 24 }}>Mortality vs benchmark</h3>
          <BenchmarkBar value={m.mortalityRate} benchmark={CONFIG.MORTALITY_BENCHMARK} good="below" />
        </section>

        <section className="panel">
          <h3>Activity log <Badge tone="info">{state.log.length}</Badge></h3>
          <div className="log-feed">
            {state.log.slice(0, 25).map((l) => (
              <div className="log-row" key={l.id}>
                <span className={`log-dot role-${l.role}`} />
                <div>
                  <div className="log-action"><strong>{l.action}</strong> · {l.detail}</div>
                  <div className="muted small">{l.user} · {timeAgo(l.ts)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function BenchmarkBar({ value, benchmark, good }) {
  if (value == null) return <div className="muted">No outcomes yet.</div>
  const ok = good === 'above' ? value >= benchmark : value <= benchmark
  return (
    <div className="benchmark">
      <div className="bench-track">
        <Bar pct={value} tone={ok ? 'ok' : 'danger'} />
        <div className="bench-marker" style={{ left: `${benchmark * 100}%` }} title={`Benchmark ${Math.round(benchmark * 100)}%`} />
      </div>
      <div className="bench-meta">
        <span className={ok ? 'pill pill-ok' : 'pill pill-danger'}>{Math.round(value * 100)}%</span>
        <span className="muted small">benchmark {Math.round(benchmark * 100)}% ({good === 'above' ? 'higher is better' : 'lower is better'})</span>
      </div>
    </div>
  )
}
