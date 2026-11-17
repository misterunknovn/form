import { useState } from 'react'
import { useNav } from '../App'
import { useData } from '../data/store'
import type { Activity, PlannedSession } from '../data/types'
import { Card, CardHead, CardLink, Empty, FullSheet, ProgressBar } from './ui'
import { DAY_SHORT, dateForWeekday, fmtDate, fmtDayShort } from '../lib/dates'
import { fmtDuration, fmtKg, fmtKm, fmtKmh, fmtPace } from '../lib/format'
import { aRace, phaseFor, plannedSetsTotal, weekFor, weekIndex, workoutById } from '../lib/plan'
import { byDateDesc, countSets, effectiveHr, effectivePace, sessionLoad } from '../lib/stats'
import { WEEKDAYS } from '../data/types'
import { diffDays } from '../lib/dates'

/** Status einer geplanten Einheit in der aktuellen Woche */
function statusOf(s: PlannedSession, date: string, today: string, acts: Activity[]) {
  const done = acts.some((a) => a.date === date && (s.kind === 'strength' ? a.kind === 'strength' : s.kind === 'bike' ? a.kind === 'bike' : a.kind === 'run' || a.kind === 'test'))
  if (done) return 'done'
  if (date === today) return 'today'
  if (date < today) return 'missed'
  return 'planned'
}

export function CurrentPlanCard({ kind, onPlan }: { kind: 'run' | 'strength'; onPlan: () => void }) {
  const { plan, activities, today } = useData()
  const week = weekFor(plan, today)
  const wi = weekIndex(plan, today)
  const phases = kind === 'run' ? plan.phases : plan.strengthPhases
  const phase = phaseFor(phases, today)
  const race = aRace(plan)
  const isRun = kind === 'run'

  if (!week || !phase) {
    return (
      <Card>
        <CardHead title="Aktueller Trainingsplan" />
        <Empty title="Kein Plan für diese Woche">Importiere im Tab Plan einen neuen Plan von Claude.</Empty>
      </Card>
    )
  }
  const phaseWeeks = Math.round(diffDays(phase.to, phase.from) / 7) + 1
  const phaseWeek = Math.floor(diffDays(today, phase.from) / 7) + 1
  const left = Math.max(0, phaseWeeks - phaseWeek)
  const sessions = WEEKDAYS.flatMap((d) => week.sessions.filter((s) => s.day === d && (isRun ? s.kind !== 'strength' : s.kind === 'strength')))

  return (
    <Card>
      <CardHead title="Aktueller Trainingsplan" aside={`Woche ${wi + 1} von ${plan.weeks.length}`} />
      <div style={{ font: '600 16px var(--font)', marginTop: 12 }}>{isRun ? plan.name : 'Kraft für Läufer'}{week.label ? ` · ${week.label}` : ''}</div>
      <div style={{ font: '400 12px var(--font)', color: 'var(--text-2)', marginTop: 4 }}>
        {isRun ? `Ziel ${race?.goal ?? ''} · Rennen am ${race ? fmtDate(race.date) : '–'}` : 'Vier Einheiten pro Woche · passend zum Laufplan'}
      </div>
      <div style={{ marginTop: 14 }}>
        <ProgressBar value={phaseWeek / phaseWeeks} color={isRun ? 'var(--run)' : 'var(--str)'} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, font: '500 11px var(--font)', color: 'var(--text-2)' }}>
        <span>{phase.name}</span>
        <span>{left === 0 ? 'letzte Woche' : `noch ${left} ${left === 1 ? 'Woche' : 'Wochen'}`}</span>
      </div>
      <div className="section-label">Diese Woche</div>
      <div className="rows">
        {sessions.map((s, i) => {
          const date = dateForWeekday(week.start, s.day)
          const st = statusOf(s, date, today, activities)
          const sub = s.kind === 'strength'
            ? `${workoutById(plan, s.workoutId)?.exercises.filter((e) => !e.optional).length ?? 0} Übungen · ${plannedSetsTotal(plan, s)} Sätze`
            : s.km ? `${fmtKm(s.km)} km${s.durationMin ? ` · ${s.durationMin} Min` : ''}` : s.durationMin ? `${s.durationMin} Min` : ''
          return (
            <div key={i} className="row">
              <span style={{ width: 22, font: '500 12px var(--font)', color: date === today ? 'var(--text)' : 'var(--text-2)' }}>{DAY_SHORT[WEEKDAYS.indexOf(s.day)]}</span>
              <div className="row-main">
                <div className="row-t">{s.title}</div>
                <div className="row-s">{sub}</div>
              </div>
              <span className={`pill ${st === 'done' ? (isRun ? 'done-run' : 'done-str') : st === 'today' ? 'today' : st === 'missed' ? 'missed' : 'planned'}`}>
                {st === 'done' ? 'Erledigt' : st === 'today' ? 'Heute' : st === 'missed' ? 'Offen' : 'Geplant'}
              </span>
            </div>
          )
        })}
      </div>
      <CardLink label="Zum Gesamtplan" onClick={onPlan} />
    </Card>
  )
}

export function activityLine(a: Activity, shoesById?: Map<string, string>) {
  switch (a.kind) {
    case 'run': {
      const p = effectivePace(a)
      const hr = effectiveHr(a)
      const speed = a.runType === 'intervall' && a.intervals?.length && p ? fmtKmh(3600 / p) : p ? `${fmtPace(p)} /km` : ''
      const extra = [a.setting === 'laufband' ? 'Laufband' : '', a.pain ? `Schmerz ${a.pain}/10` : ''].filter(Boolean).join(' · ')
      return {
        t: a.title ? `${runName(a.runType)} ${a.title}` : runName(a.runType),
        s: `${fmtDayShort(a.date)}${a.shoeId && shoesById?.get(a.shoeId) ? ` · ${shoesById.get(a.shoeId)}` : ''}${extra ? ` · ${extra}` : ''}`,
        v: a.distanceKm ? fmtKm(a.distanceKm) : '–',
        u: a.distanceKm ? 'km' : '',
        vs: [speed, hr ? `${hr} bpm` : ''].filter(Boolean).join(' · ') || '–',
        color: a.pain ? 'var(--warn)' : 'var(--run)',
      }
    }
    case 'test':
      return { t: `Leistungstest ${fmtKm(a.distanceKm)} km`, s: fmtDayShort(a.date), v: fmtDuration(a.durationSec), u: '', vs: `VDOT ${a.vdot.toFixed(1).replace('.', ',')}`, color: 'var(--run-light)' }
    case 'bike':
      return { t: 'Rad', s: fmtDayShort(a.date), v: String(Math.round(a.durationSec / 60)), u: 'Min', vs: a.avgHr ? `${a.avgHr} bpm` : 'locker', color: 'var(--dot-off)' }
    case 'strength':
      return { t: a.title, s: `${fmtDayShort(a.date)} · ${a.durationMin} Min`, v: String(countSets(a)), u: 'Sätze', vs: `${fmtKg(sessionLoad(a))} kg bewegt`, color: 'var(--str)' }
  }
}

export const runName = (t: string) =>
  ({ easy: 'Lockerer Lauf', intervall: 'Intervalle', schwelle: 'Schwelle', long: 'Long Run', test: 'Test', rennen: 'Rennen' })[t] ?? 'Lauf'

export function RecentCard({ kind }: { kind: 'run' | 'strength' }) {
  const { activities, shoes } = useData()
  const nav = useNav()
  const [all, setAll] = useState(false)
  const shoesById = new Map(shoes.map((s) => [s.id, s.name]))
  const list = byDateDesc(activities.filter((a) => (kind === 'run' ? a.kind !== 'strength' : a.kind === 'strength')))
  const edit = (a: Activity) => nav.open(a.kind === 'strength' ? { kind: 'strength', edit: a } : a.kind === 'test' ? { kind: 'test', edit: a } : { kind: 'run', edit: a })
  return (
    <Card>
      <CardHead title="Letzte Einheiten" aside={list.length ? `letzte ${Math.min(5, list.length)}` : undefined} />
      {list.length === 0 ? (
        <Empty title="Noch nichts erfasst">Über das Plus oben rechts trägst du deine erste {kind === 'run' ? 'Laufeinheit' : 'Krafteinheit'} ein.</Empty>
      ) : (
        <div className="rows" style={{ marginTop: 6 }}>
          {list.slice(0, 5).map((a) => <ActivityRow key={a.id} a={a} shoesById={shoesById} onClick={() => edit(a)} />)}
        </div>
      )}
      {list.length > 5 && <CardLink label="Alle Einheiten" onClick={() => setAll(true)} />}
      {all && (
        <FullSheet title={kind === 'run' ? 'Alle Laufeinheiten' : 'Alle Krafteinheiten'} onClose={() => setAll(false)}>
          <div className="card" style={{ margin: '16px 0 0' }}>
            <div className="rows">
              {list.map((a) => <ActivityRow key={a.id} a={a} shoesById={shoesById} onClick={() => { setAll(false); edit(a) }} />)}
            </div>
          </div>
        </FullSheet>
      )}
    </Card>
  )
}

function ActivityRow({ a, onClick, shoesById }: { a: Activity; onClick: () => void; shoesById: Map<string, string> }) {
  const l = activityLine(a, shoesById)
  return (
    <button className="row" onClick={onClick}>
      <i className="dot" style={{ background: l.color, alignSelf: 'flex-start', marginTop: 6 }} />
      <div className="row-main">
        <div className="row-t">{l.t}</div>
        <div className="row-s">{l.s}</div>
      </div>
      <div>
        <div className="row-v">{l.v}{l.u && <small>{l.u}</small>}</div>
        <div className="row-vs">{l.vs}</div>
      </div>
    </button>
  )
}
