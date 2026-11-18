import { useState } from 'react'
import { useData } from '../data/store'
import type { Activity, ISODate, Plan, PlannedSession, RunActivity, StrengthActivity, StrengthWorkout } from '../data/types'
import { useNav } from '../App'
import { Card, Delta, Empty, Header, Tiles } from '../components/ui'
import { IconToday } from '../components/icons'
import { useSwipe } from '../components/swipe'
import {
  addDays, DAY_SHORT, fmtDayLong, fmtDayShort, fmtDotDate, fmtWeekRange, fromISO, mondayOf, weekdayIndex,
} from '../lib/dates'
import { fmtDuration, fmtKg, fmtKm, fmtKmh, fmtPace } from '../lib/format'
import { phaseFor, plannedSets, rulesFor, sessionsOn, weekFor, weekIndex, workoutById } from '../lib/plan'
import { byDateDesc, countSets, effectiveHr, effectivePace, isRun, isStrength, lastExercise, runLike, sessionLoad, topSet } from '../lib/stats'

export function Today() {
  const { plan, activities, today } = useData()
  const nav = useNav()
  const [sel, setSel] = useState<ISODate>(today)
  const [dir, setDir] = useState<1 | -1>(1)
  const selectDay = (d: ISODate) => {
    if (d === sel) return
    setDir(d > sel ? 1 : -1)
    setSel(d)
  }
  // Wisch nach links: nächster Tag, nach rechts: vorheriger Tag
  const swipe = useSwipe(() => selectDay(addDays(sel, 1)), () => selectDay(addDays(sel, -1)))
  const monday = mondayOf(sel)
  const week = weekFor(plan, sel)

  const dayActs = (d: ISODate) => activities.filter((a) => a.date === d)
  const weekActs = activities.filter((a) => a.date >= monday && a.date <= addDays(monday, 6))
  const kmDone = runLike(weekActs).reduce((s, r) => s + r.km, 0)
  const runsDone = runLike(weekActs).length
  const strDone = weekActs.filter(isStrength).length
  const runsPlanned = week?.sessions.filter((s) => s.kind === 'run').length ?? 0
  const strPlanned = week?.sessions.filter((s) => s.kind === 'strength').length ?? 0

  const sessions = sessionsOn(plan, sel)
  const acts = dayActs(sel)
  const { matched, extra } = matchSessions(sessions, acts)
  const count = sessions.length + extra.length
  // Wochenhinweis (Deload, Testwoche, Rennwoche) unter der Wochenleiste
  const weekRules = rulesFor(plan, sel).filter((r) => r.trigger === 'deload_week' || r.trigger === 'test_week' || r.trigger === 'race_week')

  return (
    <div className="screen" {...swipe}>
      <Header icon={<IconToday size={28} color="#f2f4f4" />} title="Heute" onPlus={() => nav.open({ kind: 'add' })} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px 0', font: '500 15px var(--font)' }}>
        <button style={{ color: 'var(--muted)', padding: '0 8px' }} onClick={() => selectDay(addDays(sel, -7))} aria-label="Vorige Woche">‹</button>
        <span>
          <b style={{ fontWeight: 600 }}>{monday === mondayOf(today) ? 'Aktuelle Woche' : week?.label ? week.label : `Woche ${weekIndex(plan, sel) + 1 || '–'}`}</b>
          <span style={{ color: 'var(--muted)', marginLeft: 8 }}>{fmtWeekRange(monday)}</span>
        </span>
        <button style={{ color: 'var(--muted)', padding: '0 8px' }} onClick={() => selectDay(addDays(sel, 7))} aria-label="Nächste Woche">›</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px 0', font: '500 13px var(--font)', color: 'var(--muted)' }}>
        {DAY_SHORT.map((label, i) => {
          const d = addDays(monday, i)
          const ss = sessionsOn(plan, d)
          const da = dayActs(d)
          const isSel = d === sel
          const isToday = d === today
          const kinds = [...new Set(ss.map((s) => (s.kind === 'bike' ? 'run' : s.kind)))]
          const doneKinds = new Set(da.map((a) => (a.kind === 'strength' ? 'strength' : 'run')))
          for (const k of doneKinds) if (!kinds.includes(k as 'run' | 'strength')) kinds.push(k as 'run' | 'strength')
          return (
            <button key={d} onClick={() => selectDay(d)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }} aria-label={fmtDayLong(d)}>
              <span style={{ width: 30, height: 30, borderRadius: 15, display: 'grid', placeItems: 'center', background: isSel ? 'var(--text)' : 'transparent', boxShadow: isToday && !isSel ? 'inset 0 0 0 1.5px var(--run)' : 'none', color: isSel ? 'var(--bg)' : isToday ? 'var(--run)' : 'var(--muted)', fontWeight: isSel || isToday ? 600 : 500 }}>{label}</span>
              <div style={{ display: 'flex', gap: 3 }}>
                {kinds.length === 0 && <i className="dot" style={{ background: 'var(--dot-off)' }} />}
                {kinds.map((k) => (
                  <i key={k} className="dot" style={{ background: k === 'run' ? 'var(--run)' : 'var(--str)', opacity: doneKinds.has(k) ? 1 : 0.45 }} />
                ))}
              </div>
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 24px 0', padding: '8px 12px', borderRadius: 12, background: 'var(--card)', border: '1px solid var(--line)' }}>
        <Summary label="KM" v={fmtKm(kmDone)} of={week ? String(week.targetKm) : '–'} p={week ? kmDone / week.targetKm : 0} color="var(--run)" />
        <div style={{ width: 1, height: 22, background: 'var(--line)' }} />
        <Summary label="LÄUFE" v={String(runsDone)} of={String(runsPlanned)} p={runsPlanned ? runsDone / runsPlanned : 0} color="var(--run)" />
        <div style={{ width: 1, height: 22, background: 'var(--line)' }} />
        <Summary label="KRAFT" v={String(strDone)} of={String(strPlanned)} p={strPlanned ? strDone / strPlanned : 0} color="var(--str)" />
      </div>

      {weekRules.length > 0 && (
        <div style={{ margin: '8px 24px 0', padding: '10px 12px', borderRadius: 12, background: 'rgba(255, 184, 107, 0.1)', border: '1px solid rgba(255, 184, 107, 0.4)' }}>
          {weekRules.map((r) => (
            <div key={r.id} style={{ display: 'flex', gap: 8, font: '400 12px/1.45 var(--font)', color: 'var(--text)' }}>
              <i style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--warn)', flex: 'none', marginTop: 6 }} />
              <span><b style={{ color: 'var(--warn)', fontWeight: 600 }}>{r.title}.</b> {r.text}</span>
            </div>
          ))}
        </div>
      )}

      <div key={sel} className={dir > 0 ? 'slide-next' : 'slide-prev'}>
      <div className="day-head">
        <b>{sel === today ? fmtDayLong(sel) : fmtDayLong(sel)}</b>
        <span>{count === 0 ? 'Ruhetag' : count === 1 ? '1 Einheit' : `${count} Einheiten`}</span>
      </div>

      {!week && (
        <Card>
          <Empty title="Für diese Woche gibt es keinen Plan">
            Im Tab Plan kannst du einen neuen Plan von Claude importieren.
          </Empty>
        </Card>
      )}
      {week && count === 0 && (
        <Card>
          <Empty title="Ruhetag">Erholung gehört zum Training. Morgen geht es weiter.</Empty>
        </Card>
      )}

      {sessions.map((s, i) => (
        <SessionCard key={`${sel}-${i}`} plan={plan} date={sel} session={s} done={matched[i]} activities={activities} />
      ))}
      {extra.map((a) => (
        <ExtraCard key={a.id} a={a} />
      ))}

      <Tomorrow plan={plan} date={sel} onSelect={selectDay} />
      </div>
    </div>
  )
}

function Summary({ label, v, of, p, color }: { label: string; v: string; of: string; p: number; color: string }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }} className="num">
        <span style={{ font: '500 9px var(--font)', color: 'var(--muted)', letterSpacing: '.06em' }}>{label}</span>
        <span>
          <span style={{ font: '700 12px var(--font)' }}>{v}</span>
          <span style={{ font: '500 10px var(--font)', color: 'var(--faint)' }}> / {of}</span>
        </span>
      </div>
      <div className="bar" style={{ marginTop: 6 }}>
        <div style={{ width: `${Math.min(1, p) * 100}%`, background: color }} />
      </div>
    </div>
  )
}

/** Ordnet erfasste Einheiten des Tages den geplanten zu */
function matchSessions(sessions: PlannedSession[], acts: Activity[]) {
  const used = new Set<string>()
  const matched: (Activity | undefined)[] = sessions.map((s) => {
    const cand = acts.find((a) => {
      if (used.has(a.id)) return false
      if (s.kind === 'strength') return a.kind === 'strength' && (!a.workoutId || !s.workoutId || a.workoutId === s.workoutId)
      if (s.kind === 'bike') return a.kind === 'bike'
      return a.kind === 'run' || a.kind === 'test'
    })
    if (cand) used.add(cand.id)
    return cand
  })
  return { matched, extra: acts.filter((a) => !used.has(a.id)) }
}

function hrLabel(plan: Plan, s: PlannedSession): { v: string; l: string } {
  if (s.runType === 'schwelle') return { v: `${plan.hr.threshold[0]}–${plan.hr.threshold[1]}`, l: 'HF Schwelle' }
  if (s.runType === 'intervall') return { v: `≤${plan.hr.intervalMax}`, l: 'HF max.' }
  if (s.runType === 'test' || s.runType === 'rennen') return { v: 'Max.', l: 'Einsatz' }
  return { v: `${plan.hr.easy[0]}–${plan.hr.easy[1]}`, l: 'HF Easy' }
}

function SessionCard({ plan, date, session: s, done, activities }: { plan: Plan; date: ISODate; session: PlannedSession; done?: Activity; activities: Activity[] }) {
  const nav = useNav()
  const [open, setOpen] = useState(false)
  const week = weekFor(plan, date)
  const phase = phaseFor(s.kind === 'strength' ? plan.strengthPhases : plan.phases, date)
  const wi = weekIndex(plan, date) + 1
  const isStr = s.kind === 'strength'
  const badge = isStr ? 'Kraft' : s.kind === 'bike' ? 'Rad' : 'Laufen'
  const doneRun = done && done.kind === 'run' ? done : undefined

  const log = () => openLog(nav, date, s, done)

  const tiles = isStr
    ? strengthTiles(plan, s, done as StrengthActivity | undefined)
    : s.kind === 'bike'
      ? [
          { v: done ? `${Math.round((done as { durationSec: number }).durationSec / 60)} Min` : '30–45 Min', l: 'Dauer' },
          { v: 'Locker', l: 'Intensität' },
          { v: '0 km', l: 'Wochen-km' },
        ]
      : doneRun
        ? [
            { v: fmtDuration(doneRun.durationSec), l: 'Dauer' },
            { v: doneRun.distanceKm ? `${fmtKm(doneRun.distanceKm)} km` : '–', l: 'Distanz' },
            runPaceTile(doneRun),
          ]
        : [
            { v: s.durationMin ? `${s.durationMin} Min` : '–', l: 'Dauer' },
            { v: s.km ? `${fmtKm(s.km)} km` : '–', l: 'Distanz' },
            hrLabel(plan, s),
          ]

  return (
    <Card className={done ? '' : ''}>
      <div className="card-head" style={{ alignItems: 'center' }}>
        <span className={`badge ${isStr ? 'str' : s.kind === 'bike' ? 'bike' : 'run'}`}>{badge}</span>
        <span className="card-aside">
          {done ? <span style={{ color: isStr ? 'var(--str)' : 'var(--run)', fontWeight: 600 }}>Erledigt</span> : `${phase?.name ?? ''}${wi > 0 ? ` · Woche ${wi}` : ''}`}
        </span>
      </div>
      <div className="big-title">{s.title}</div>
      {sessionInfo(plan, s) && <div className="desc">{sessionInfo(plan, s)}</div>}
      <Tiles items={tiles} compact />

      <ActionRow
        open={(s.steps?.length || isStr || s.kind === 'run') ? open : undefined}
        onToggle={() => setOpen(!open)}
        action={done ? 'Bearbeiten' : s.runType === 'test' ? 'Test eintragen' : 'Eintragen'}
        primary={!done}
        onAction={log}
      />
      {open && s.kind === 'run' && <RunDetails plan={plan} s={s} date={date} done={doneRun} activities={activities} />}
      {open && isStr && <StrengthDetails plan={plan} s={s} date={date} done={done as StrengthActivity | undefined} activities={activities} />}
      {week?.estimated && s.kind !== 'strength' && (
        <div className="hint" style={{ margin: '8px 0 0' }}>Aus den Phasen abgeleitet. Claude verfeinert diese Woche, wenn es so weit ist.</div>
      )}
    </Card>
  )
}

/** Formular zum Eintragen bzw. Bearbeiten einer geplanten Einheit öffnen */
function openLog(nav: ReturnType<typeof useNav>, date: ISODate, s: PlannedSession, done?: Activity) {
  if (done) {
    nav.open(done.kind === 'strength' ? { kind: 'strength', edit: done } : done.kind === 'test' ? { kind: 'test', edit: done } : { kind: 'run', edit: done })
    return
  }
  if (s.kind === 'strength') nav.open({ kind: 'strength', date, planned: s })
  else if (s.runType === 'test') nav.open({ kind: 'test' })
  else nav.open({ kind: 'run', date, planned: s })
}

/** Untertitel: bei Läufen die Beschreibung, bei Kraft der Schwerpunkt der Einheit */
function sessionInfo(plan: Plan, s: PlannedSession): string {
  if (s.kind === 'strength') return workoutById(plan, s.workoutId)?.focus ?? ''
  const time = s.time && !s.description?.toLowerCase().includes(s.time) ? ` ${cap(s.time)}.` : ''
  return `${s.description ?? ''}${time}`
}

/** Eine Zeile: links „Details“ auf- und zuklappen, rechts Eintragen bzw. Bearbeiten */
function ActionRow({ open, onToggle, action, primary, onAction }: { open?: boolean; onToggle: () => void; action: string; primary: boolean; onAction: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
      {open !== undefined ? (
        <button onClick={onToggle} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, font: '600 13px var(--font)', textAlign: 'left' }}>
          <span className={`toggle-ico ${open ? 'open' : ''}`}>▼</span>
          {open ? 'Details ausblenden' : 'Details'}
        </button>
      ) : (
        <span style={{ flex: 1 }} />
      )}
      <button onClick={onAction} style={{ height: 34, padding: '0 16px', borderRadius: 10, font: '600 13px var(--font)', background: primary ? 'var(--text)' : 'var(--tile)', color: primary ? 'var(--bg)' : 'var(--text)', border: primary ? 'none' : '1px solid var(--line-2)' }}>
        {action}
      </button>
    </div>
  )
}

function runPaceTile(r: RunActivity): { v: string; l: string } {
  const p = effectivePace(r)
  if (r.runType === 'intervall' && r.intervals?.length && p) return { v: fmtKmh(3600 / p), l: 'Ø Intervall' }
  if (r.runType === 'schwelle' && r.main?.paceSec) return { v: fmtPace(r.main.paceSec), l: 'Pace Schwelle' }
  return { v: p ? fmtPace(p) : '–', l: 'Pace /km' }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function strengthTiles(plan: Plan, s: PlannedSession, done?: StrengthActivity) {
  const wo = workoutById(plan, s.workoutId)
  const ex = wo?.exercises.filter((e) => !e.optional) ?? []
  const sets = ex.reduce((n, e) => n + plannedSets(e.sets, s), 0)
  if (done)
    return [
      { v: `${done.durationMin} Min`, l: 'Dauer' },
      { v: String(done.exercises.length), l: 'Übungen' },
      { v: String(countSets(done)), l: 'Sätze' },
    ]
  return [
    { v: String(ex.length), l: 'Übungen' },
    { v: String(sets), l: 'Sätze' },
  ]
}

function RunDetails({ plan, s, date, done, activities }: { plan: Plan; s: PlannedSession; date: ISODate; done?: RunActivity; activities: Activity[] }) {
  const prev = byDateDesc(activities.filter(isRun))
    .filter((r) => r.runType === s.runType && r.date < date && effectivePace(r) !== null)
    .slice(0, 3)
    .reverse()
  const rows = [...prev, ...(done && effectivePace(done) !== null ? [done] : [])]
  const lastPrev = prev[prev.length - 1]
  const isInt = s.runType === 'intervall'
  return (
    <>
      {s.steps && (
        <>
          <div className="section-label">Ablauf</div>
          <div className="rows">
            {s.steps.map((st, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 0' }}>
                <i style={{ width: 6, height: 6, borderRadius: 3, background: st.key ? 'var(--run)' : 'var(--dot-off)', flex: 'none', marginTop: 6 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: `${st.key ? 600 : 500} 13px/18px var(--font)` }}>{st.name}</div>
                  {st.detail && <div style={{ font: '400 11px/15px var(--font)', color: 'var(--text-2)' }}>{st.detail}</div>}
                </div>
                <span className="num" style={{ font: '600 13px/18px var(--font)', whiteSpace: 'nowrap' }}>{st.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="section-label">Vergleich · letzte {s.runType === 'easy' ? 'Easy Runs' : s.title}</div>
      {rows.length === 0 ? (
        <div className="hint" style={{ margin: '4px 0 0' }}>Noch keine früheren Einheiten dieses Typs. Nach dem ersten Eintrag siehst du hier den Vergleich.</div>
      ) : (
        <>
          <div className="gt gt-h" style={{ gridTemplateColumns: '46px 1fr 66px 32px 60px' }}>
            <span>DATUM</span><span>{isInt ? 'INTERVALLE' : s.runType === 'schwelle' ? 'BLOCK' : 'KM'}</span><span className="r">{isInt ? 'TEMPO' : 'PACE'}</span><span className="r">PULS</span><span className="r">Δ {isInt ? 'PULS' : ''}</span>
          </div>
          {rows.map((r, i) => {
            const pace = effectivePace(r) ?? NaN
            const hr = effectiveHr(r)
            const before = rows[i - 1]
            // Intervalle: gleicher Puls bei gleichem Tempo zählt, sonst die Pace
            const d = !before ? null : isInt ? (hr && effectiveHr(before) ? hr - effectiveHr(before)! : null) : Math.round(pace - (effectivePace(before) ?? NaN))
            const isDone = done && r.id === done.id
            return (
              <div key={r.id} className="gt gt-r" style={{ gridTemplateColumns: '46px 1fr 66px 32px 60px', borderTop: i === 0 ? 'none' : undefined }}>
                <span style={{ font: '500 12px var(--font)', color: isDone ? 'var(--run)' : 'var(--text-2)' }} className="num">{isDone ? 'Heute' : fmtDotDate(r.date)}</span>
                <span style={{ font: '500 12px var(--font)', color: isDone ? 'var(--text)' : 'var(--soft)', whiteSpace: 'nowrap' }}>{isInt ? (r.intervals?.length ? `${r.intervals.length} Wdh.` : '–') : s.runType === 'schwelle' && r.main?.minutes ? `${r.main.minutes} Min` : r.distanceKm ? `${fmtKm(r.distanceKm)} km` : r.title ?? '–'}</span>
                <span className="r num" style={{ font: '600 13px var(--font)', color: isDone ? 'var(--text)' : 'var(--soft)' }}>{isInt ? fmtKmh(3600 / pace) : fmtPace(pace)}</span>
                <span className="r num" style={{ font: '500 12px var(--font)', color: 'var(--text-2)' }}>{hr ?? '–'}</span>
                <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  {d === null || isNaN(d) ? <span style={{ font: '500 11px var(--font)', color: 'var(--faint)' }}>–</span> : d === 0 ? <Delta up={null}>±0</Delta> : <Delta up={d > 0} good={d < 0}>{Math.abs(d)} {isInt ? 'bpm' : 's'}</Delta>}
                </span>
              </div>
            )
          })}
          {isInt && <div className="hint" style={{ margin: '6px 0 0' }}>Tempo und Puls der Intervalle (Ø). Weniger Puls bei gleichem Tempo heißt: fitter.</div>}
          {done && lastPrev && effectivePace(done) !== null && (
            <div className="insight">{compareText(done, lastPrev)}</div>
          )}
        </>
      )}
      {!done && s.runType && s.runType !== 'easy' && s.runType !== 'long' && (
        <div className="hint" style={{ margin: '10px 0 0' }}>
          {s.runType === 'schwelle' && `Ziel: Hauptteil bei HF ${plan.hr.threshold[0]}–${plan.hr.threshold[1]}.`}
          {s.runType === 'intervall' && `Ziel: 13,0–13,5 km/h (4:37–4:27 /km), HF max. ${plan.hr.intervalMax}.`}
        </div>
      )}
    </>
  )
}

function compareText(done: RunActivity, prev: RunActivity): string {
  const d = Math.round((effectivePace(done) ?? 0) - (effectivePace(prev) ?? 0))
  const km = done.distanceKm && prev.distanceKm ? done.distanceKm - prev.distanceKm : 0
  const parts: string[] = []
  if (Math.abs(km) >= 0.5) parts.push(`${fmtKm(Math.abs(km))} km ${km > 0 ? 'mehr' : 'weniger'}`)
  parts.push(d === 0 ? 'gleiche Pace' : `${Math.abs(d)} s/km ${d < 0 ? 'schneller' : 'langsamer'}`)
  let s = `${parts.join(' und ')} als am ${fmtDayShort(prev.date)}.`
  const h1 = effectiveHr(done)
  const h0 = effectiveHr(prev)
  if (h1 && h0) {
    const h = h1 - h0
    s += h === 0 ? ' Puls gleich.' : ` Puls ${Math.abs(h)} bpm ${h < 0 ? 'niedriger' : 'höher'}.`
  }
  return s
}

function StrengthDetails({ plan, s, date, done, activities }: { plan: Plan; s: PlannedSession; date: ISODate; done?: StrengthActivity; activities: Activity[] }) {
  const { today } = useData()
  const wo = workoutById(plan, s.workoutId)
  if (!wo) return null
  const prevSession = byDateDesc(activities.filter(isStrength)).find((a) => a.date < date && a.workoutId === s.workoutId)
  return (
    <>
      <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Übungen</span>
        <span>{done ? (date === today ? 'Heute' : 'Gewicht') : 'Zuletzt'}</span>
      </div>
      <div className="rows">
        {(done ? doneRows(wo, done) : planRows(wo, s, date, activities)).map((r) => (
          <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '1fr auto', columnGap: 8, alignItems: 'center', padding: '9px 0', opacity: r.dim ? 0.5 : 1 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ font: '600 13px var(--font)' }}>{r.name}</div>
              <div style={{ font: '400 11px var(--font)', color: 'var(--text-2)', marginTop: 2 }}>{r.sub}</div>
            </div>
            <span className="r num" style={{ font: '600 13px var(--font)', whiteSpace: 'nowrap' }}>{r.value}</span>
          </div>
        ))}
      </div>
      {wo.note && <div className="hint" style={{ margin: '8px 0 0' }}>{wo.note}</div>}
      {done && prevSession && (
        <>
          <div className="section-label">Vergleich · letzte Einheit, {fmtDayShort(prevSession.date)}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <CompareTile label="Sätze" v={String(countSets(done))} prev={countSets(prevSession)} cur={countSets(done)} unit="" />
            <CompareTile label="Bewegte Last" v={fmtKg(sessionLoad(done))} prev={sessionLoad(prevSession)} cur={sessionLoad(done)} unit="kg" pct />
          </div>
        </>
      )}
    </>
  )
}

interface ExRow {
  key: string
  name: string
  sub: string
  value: string
  dim?: boolean
}

const setLabel = (t: { kg: number; reps: number } | null) => (t ? (t.kg ? `${fmtKg(t.kg)} kg` : `${t.reps} Wdh.`) : '–')

/** Geplante Übungen mit dem letzten Gewicht (auch unter Hevy-Namen) */
function planRows(wo: StrengthWorkout, s: PlannedSession, date: ISODate, acts: Activity[]): ExRow[] {
  return wo.exercises.map((e) => {
    const last = lastExercise(acts, e.name, date, e.aliases)
    const n = plannedSets(e.sets, s)
    return {
      key: e.name,
      name: `${e.name}${e.optional ? ' (optional)' : ''}`,
      sub: `${n}${e.setsMax && !s.setsFactor && !s.setsOverride ? `–${e.setsMax}` : ''} × ${e.reps} · RIR ${e.rir}`,
      value: setLabel(last ? topSet(last.sets) : null),
      dim: e.optional,
    }
  })
}

/** Tatsächlich gemachte Übungen, danach nicht gemachte Planübungen */
function doneRows(wo: StrengthWorkout, done: StrengthActivity): ExRow[] {
  const rows: ExRow[] = done.exercises.map((x) => ({
    key: x.name,
    name: x.name,
    sub: `${x.sets.length} × ${x.sets.map((z) => z.reps).join('/')}`,
    value: setLabel(topSet(x.sets)),
  }))
  const doneNames = new Set(done.exercises.map((x) => x.name))
  for (const e of wo.exercises) {
    if (e.optional || [e.name, ...(e.aliases ?? [])].some((n) => doneNames.has(n))) continue
    rows.push({ key: `plan-${e.name}`, name: e.name, sub: 'Im Plan, nicht gemacht', value: '–', dim: true })
  }
  return rows
}

function CompareTile({ label, v, prev, cur, unit, pct }: { label: string; v: string; prev: number; cur: number; unit: string; pct?: boolean }) {
  const diff = cur - prev
  const txt = pct ? `${diff >= 0 ? '+' : '−'}${Math.abs(Math.round((diff / (prev || 1)) * 100))} %` : `${diff >= 0 ? '+' : '−'}${Math.abs(diff)}`
  return (
    <div style={{ flex: 1, minWidth: 0, borderRadius: 10, background: 'var(--tile)', border: '1px solid var(--line-2)', padding: 10 }}>
      <div style={{ font: '500 10px var(--font)', color: 'var(--text-2)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
        <span className="num" style={{ font: '700 17px/1 var(--font)' }}>{v}</span>
        {unit && <span style={{ font: '500 11px var(--font)', color: 'var(--text-2)' }}>{unit}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, font: '500 11px var(--font)', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
        vs. {pct ? fmtKg(prev) : prev}
        {diff === 0 ? <Delta up={null}>±0</Delta> : <Delta up={diff > 0} tone="str" good={diff > 0}>{txt}</Delta>}
      </div>
    </div>
  )
}

function ExtraCard({ a }: { a: Activity }) {
  const nav = useNav()
  const isStr = a.kind === 'strength'
  const title = a.kind === 'run' ? a.title ?? 'Lauf' : a.kind === 'strength' ? a.title : a.kind === 'bike' ? 'Rad' : 'Leistungstest'
  const tiles =
    a.kind === 'run' || a.kind === 'test'
      ? [
          { v: fmtDuration(a.durationSec), l: 'Dauer' },
          { v: a.distanceKm ? `${fmtKm(a.distanceKm)} km` : '–', l: 'Distanz' },
          a.kind === 'run' ? runPaceTile(a) : { v: fmtPace(a.durationSec / a.distanceKm), l: 'Pace /km' },
        ]
      : a.kind === 'strength'
        ? [
            { v: `${a.durationMin} Min`, l: 'Dauer' },
            { v: String(a.exercises.length), l: 'Übungen' },
            { v: String(countSets(a)), l: 'Sätze' },
          ]
        : [{ v: `${Math.round(a.durationSec / 60)} Min`, l: 'Dauer' }]
  return (
    <Card>
      <div className="card-head" style={{ alignItems: 'center' }}>
        <span className={`badge ${isStr ? 'str' : a.kind === 'bike' ? 'bike' : 'run'}`}>{isStr ? 'Kraft' : a.kind === 'bike' ? 'Rad' : 'Laufen'}</span>
        <span className="card-aside">Ungeplant</span>
      </div>
      <div className="big-title">{title}</div>
      <Tiles items={tiles} compact />
      <ActionRow onToggle={() => {}} action="Bearbeiten" primary={false} onAction={() => nav.open(a.kind === 'strength' ? { kind: 'strength', edit: a } : a.kind === 'test' ? { kind: 'test', edit: a } : { kind: 'run', edit: a })} />
    </Card>
  )
}

function Tomorrow({ plan, date, onSelect }: { plan: Plan; date: ISODate; onSelect: (d: ISODate) => void }) {
  const t = addDays(date, 1)
  const ss = sessionsOn(plan, t)
  let after: { d: ISODate; s: PlannedSession } | null = null
  for (let i = 2; i <= 7 && !after; i++) {
    const d = addDays(date, i)
    const key = sessionsOn(plan, d).find((s) => s.kind === 'run' && s.runType !== 'easy')
    if (key) after = { d, s: key }
  }
  const title = ss.length ? ss.map((s) => s.title).join(' + ') : 'Ruhetag'
  return (
    <button className="card dashed" style={{ display: 'flex', alignItems: 'center', gap: 12, width: 'calc(100% - 48px)', textAlign: 'left', padding: '12px 16px' }} onClick={() => onSelect(t)}>
      <div style={{ width: 36, flex: 'none', textAlign: 'center' }}>
        <div style={{ font: '500 10px var(--font)', color: 'var(--text-2)', letterSpacing: '.04em' }}>{DAY_SHORT[weekdayIndex(t)].toUpperCase()}</div>
        <div className="num" style={{ font: '700 17px/1.1 var(--font)' }}>{fromISO(t).getDate()}</div>
      </div>
      <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--line)' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: '500 11px var(--font)', color: 'var(--text-2)' }}>Morgen</div>
        <div style={{ font: '600 14px var(--font)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        {after && (
          <div style={{ font: '400 11px var(--font)', color: 'var(--text-2)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Danach {DAY_SHORT[weekdayIndex(after.d)]}: {after.s.title}{after.s.km ? ` · ${fmtKm(after.s.km)} km` : ''}
          </div>
        )}
      </div>
      <span style={{ color: 'var(--faint)', font: '500 14px var(--font)' }}>›</span>
    </button>
  )
}
