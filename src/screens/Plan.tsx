import { useState } from 'react'
import { useNav } from '../App'
import { useData } from '../data/store'
import type { Phase, Plan, PlannedSession, PlanWeek } from '../data/types'
import { WEEKDAYS } from '../data/types'
import { Card, CardHead, CardLink, Dot, Header, Segmented, SubHeader, Tiles } from '../components/ui'
import { IconPlan, IconSpark } from '../components/icons'
import { PlanBars } from '../components/charts'
import { DAY_SHORT, diffDays, fmtDate, fmtDayShort, fromISO, MONTH_SHORT } from '../lib/dates'
import { fmtKm } from '../lib/format'
import { phaseFor, plannedSets, plannedSetsTotal, sessionDate, weekFor, weekIndex, weekRunKm, weekStrengthSets, workoutById } from '../lib/plan'
import { ClaudeSheet, SettingsCard } from './Settings'

type View = { v: 'main' } | { v: 'phases'; kind: 'run' | 'strength' } | { v: 'session'; idx: number }

export function PlanScreen() {
  const [view, setView] = useState<View>({ v: 'main' })
  if (view.v === 'phases') return <Phases initial={view.kind} onBack={() => setView({ v: 'main' })} />
  if (view.v === 'session') return <SessionDetail initial={view.idx} onBack={() => setView({ v: 'main' })} />
  return <Main onPhases={(kind) => setView({ v: 'phases', kind })} onSessions={() => setView({ v: 'session', idx: 0 })} />
}

const RUN_PHASE_COLORS = ['var(--run-darker)', 'var(--run-deep)', 'var(--run-mid)', 'var(--run)', 'var(--run-light)', '#e4fafa']
const STR_PHASE_COLORS = ['var(--str-dark)', 'var(--str-deep)', 'var(--str)', 'var(--str-light)']

function weeksIn(p: Phase) {
  return Math.round(diffDays(p.to, p.from) / 7) + 1
}

function PhaseBand({ phases, colors, today }: { phases: Phase[]; colors: string[]; today: string }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 3, marginTop: 14 }}>
        {phases.map((p, i) => {
          const cur = today >= p.from && today <= p.to
          return <div key={p.id} style={{ flex: weeksIn(p), height: 6, borderRadius: 3, background: colors[i % colors.length], opacity: today > p.to || cur ? 1 : 0.5, outline: cur ? '1px solid var(--text)' : 'none', outlineOffset: 1 }} />
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginTop: 10 }}>
        {phases.map((p, i) => (
          <span key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, font: '500 11px var(--font)', whiteSpace: 'nowrap' }}>
            <Dot color={colors[i % colors.length]} />
            {p.name}
            <span style={{ color: 'var(--text-2)' }}>{weeksIn(p)} W</span>
          </span>
        ))}
      </div>
    </>
  )
}

function Main({ onPhases, onSessions }: { onPhases: (k: 'run' | 'strength') => void; onSessions: () => void }) {
  const { plan, today } = useData()
  const [claude, setClaude] = useState<null | 'export' | 'import'>(null)
  const wi = Math.max(0, weekIndex(plan, today))
  const races = [...plan.races].sort((a, b) => a.date.localeCompare(b.date))
  const aRace = races.find((r) => r.priority === 'A')
  const week = weekFor(plan, today) ?? plan.weeks[0]
  const lastLabel = String(plan.weeks.length)

  return (
    <div className="screen">
      <Header icon={<IconPlan size={28} color="#f2f4f4" />} title="Plan" />

      <Card>
        <div className="card-head">
          <span className="card-title">Gesamtplan Laufen</span>
          <button style={{ font: '600 13px var(--font)' }} onClick={() => setClaude('import')}>Importieren</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12 }}>
          <span style={{ font: '600 17px var(--font)' }}>{plan.name}</span>
          <span style={{ font: '500 12px var(--font)', color: 'var(--text-2)' }}>{plan.weeks.length} Wochen</span>
        </div>
        <div style={{ font: '400 12px/1.5 var(--font)', color: 'var(--text-2)', marginTop: 4 }}>
          {aRace ? `Ziel ${aRace.goal} · ` : ''}
          {races.map((r) => `${r.priority}-Rennen ${fmtDate(r.date)}`).join(' · ')}
        </div>
        <PhaseBand phases={plan.phases} colors={RUN_PHASE_COLORS} today={today} />
        <div style={{ font: '500 11px var(--font)', color: 'var(--text-2)', marginTop: 16 }}>Umfang pro Woche in km</div>
        <PlanBars values={plan.weeks.map((w) => ({ v: w.targetKm, deload: w.deload }))} current={wi} tone="run" labels={['Woche 1', `Woche ${wi + 1} · jetzt`, lastLabel]} />
        <CardLink label="Phasen im Detail" onClick={() => onPhases('run')} />
      </Card>

      <Card>
        <div className="card-head">
          <span className="card-title">Gesamtplan Kraft</span>
          <span className="card-aside">4 Einheiten pro Woche</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12 }}>
          <span style={{ font: '600 17px var(--font)' }}>Kraft für Läufer</span>
          <span style={{ font: '500 12px var(--font)', color: 'var(--text-2)' }}>{plan.weeks.length} Wochen</span>
        </div>
        <div style={{ font: '400 12px var(--font)', color: 'var(--text-2)', marginTop: 4 }}>Oberkörper A und B, Unterkörper A und B · passend zum Laufplan</div>
        <PhaseBand phases={plan.strengthPhases} colors={STR_PHASE_COLORS} today={today} />
        <div style={{ font: '500 11px var(--font)', color: 'var(--text-2)', marginTop: 16 }}>Harte Sätze pro Woche</div>
        <PlanBars values={plan.weeks.map((w) => ({ v: weekStrengthSets(plan, w), deload: w.deload }))} current={wi} tone="str" labels={['Woche 1', `Woche ${wi + 1} · jetzt`, lastLabel]} />
        <CardLink label="Phasen im Detail" onClick={() => onPhases('strength')} />
      </Card>

      {week && <TypicalWeek plan={plan} week={week} onDetail={onSessions} current={weekIndex(plan, today) >= 0} />}

      <Card>
        <div className="card-head" style={{ alignItems: 'center' }}>
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconSpark size={16} color="var(--run)" />Mit Claude anpassen</span>
          <span className="card-aside">Stand {fmtDate(plan.updated)}</span>
        </div>
        <div className="desc" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>
          Kopiere deine Daten, füge sie im Claude-Chat ein und hol dir eine Analyse oder einen angepassten Plan. Claudes Antwort fügst du hier wieder ein.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn-run" onClick={() => setClaude('export')}>1 · Daten kopieren</button>
          <button className="btn-secondary" onClick={() => setClaude('import')}>2 · Antwort einfügen</button>
        </div>
      </Card>

      <Card>
        <CardHead title="Regeln" aside={`${plan.rules.length} aus deinem Plan`} />
        <div className="rows" style={{ marginTop: 6 }}>
          {plan.rules.map((r) => (
            <div key={r.id} style={{ padding: '9px 0', font: '400 12px/1.5 var(--font)', color: 'var(--text-2)' }}>
              <b style={{ color: 'var(--text)', fontWeight: 600 }}>{r.title}.</b> {r.text}
            </div>
          ))}
        </div>
      </Card>

      {plan.nutrition && (
        <Card>
          <CardHead title="Ernährung und Kontrolle" />
          <div className="rows" style={{ marginTop: 6 }}>
            {plan.nutrition.map((n) => (
              <div key={n.area} className="row" style={{ alignItems: 'flex-start' }}>
                <span style={{ width: 70, font: '600 12px var(--font)', flex: 'none' }}>{n.area}</span>
                <span style={{ font: '400 12px/1.5 var(--font)', color: 'var(--text-2)' }}>{n.value}</span>
              </div>
            ))}
          </div>
          {plan.checkpoints && <div className="insight">{plan.checkpoints}</div>}
        </Card>
      )}

      <SettingsCard />
      {claude && <ClaudeSheet mode={claude} onClose={() => setClaude(null)} />}
    </div>
  )
}

function TypicalWeek({ plan, week, onDetail, current }: { plan: Plan; week: PlanWeek; onDetail: () => void; current: boolean }) {
  return (
    <Card>
      <CardHead title={current ? 'Diese Trainingswoche' : 'Erste Trainingswoche'} aside={`ab ${fmtDayShort(week.start)}${week.label ? ` · ${week.label}` : ''}`} />
      <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr', gap: 6, marginTop: 12, font: '500 10px var(--font)', color: 'var(--text-2)', letterSpacing: '.04em' }}>
        <span />
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Dot color="var(--run)" />LAUFEN</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Dot color="var(--str)" />KRAFT</span>
      </div>
      {WEEKDAYS.map((d, i) => {
        const run = week.sessions.filter((s) => s.day === d && s.kind !== 'strength')
        const str = week.sessions.filter((s) => s.day === d && s.kind === 'strength')
        const rest = !run.length && !str.length
        return (
          <div key={d} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr', gap: 6, marginTop: 6, alignItems: 'stretch' }}>
            <span style={{ font: '500 12px var(--font)', color: 'var(--text-2)', paddingTop: 10 }}>{DAY_SHORT[i]}</span>
            {rest ? (
              <span style={{ gridColumn: 'span 2', font: '500 12px var(--font)', color: 'var(--text-2)', padding: '10px 10px' }}>Ruhetag</span>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {run.length ? run.map((s, k) => <WeekCell key={k} s={s} tone="run" sub={s.km ? `${fmtKm(s.km)} km` : s.durationMin ? `${s.durationMin} Min` : ''} />) : <Empty0 />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {str.length ? str.map((s, k) => <WeekCell key={k} s={s} tone="str" sub={`${plannedSetsTotal(plan, s)} Sätze${s.time ? ` · ${s.time}` : ''}`} />) : <Empty0 />}
                </div>
              </>
            )}
          </div>
        )
      })}
      <div style={{ font: '400 11px/1.5 var(--font)', color: 'var(--text-2)', marginTop: 12 }}>
        {fmtKm(weekRunKm(week))} km geplant · Ziel ca. {week.targetKm} km · Rad zählt nicht in die Wochenkilometer
      </div>
      <CardLink label="Einheiten im Detail" onClick={onDetail} />
    </Card>
  )
}

const Empty0 = () => <span style={{ font: '500 12px var(--font)', color: 'var(--faint)', padding: '10px 10px' }}>–</span>

function WeekCell({ s, tone, sub }: { s: PlannedSession; tone: 'run' | 'str'; sub: string }) {
  const bg = s.kind === 'bike' ? 'var(--tile)' : tone === 'run' ? 'var(--run-bg)' : 'var(--str-bg)'
  return (
    <div style={{ borderRadius: 10, background: bg, padding: '8px 10px' }}>
      <div style={{ font: '600 12px var(--font)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
      <div style={{ font: '400 10px var(--font)', color: 'var(--text-2)', marginTop: 2 }}>{sub}</div>
    </div>
  )
}

// ---------------- Phasen im Detail ----------------

function Phases({ initial, onBack }: { initial: 'run' | 'strength'; onBack: () => void }) {
  const { plan, today } = useData()
  const [kind, setKind] = useState(initial)
  const phases = kind === 'run' ? plan.phases : plan.strengthPhases
  const cur = phaseFor(phases, today) ?? phases[0]
  const [sel, setSel] = useState(cur?.id)
  const phase = phases.find((p) => p.id === sel) ?? phases[0]
  const weeks = plan.weeks.filter((w) => w.start >= phase.from && w.start <= phase.to)
  const isCur = today >= phase.from && today <= phase.to
  const tone = kind === 'run' ? 'run' : 'str'
  const kms = weeks.map((w) => w.targetKm)
  const sets = weeks.map((w) => weekStrengthSets(plan, w))
  const runsPerWeek = weeks.length ? Math.round(weeks.reduce((n, w) => n + w.sessions.filter((s) => s.kind === 'run').length, 0) / weeks.length) : 0
  const deloads = weeks.filter((w) => w.deload).length
  const curWeekNo = Math.floor(diffDays(today, plan.weeks[0].start) / 7) + 1
  const firstNo = plan.weeks.findIndex((w) => w.start === weeks[0]?.start) + 1

  const switchKind = (k: 'run' | 'strength') => {
    setKind(k)
    const ps = k === 'run' ? plan.phases : plan.strengthPhases
    setSel((phaseFor(ps, today) ?? ps[0]).id)
  }

  const keySessions = (w: PlanWeek) =>
    kind === 'run'
      ? w.sessions.filter((s) => s.kind === 'run' && s.runType !== 'easy').map((s) => (s.steps?.find((x) => x.key)?.name ?? `${s.title}${s.km ? ` ${fmtKm(s.km)} km` : ''}`).replace(' Min', '′')).join(' · ')
      : w.sessions.filter((s) => s.kind === 'strength').map((s) => `${s.title.replace('Oberkörper', 'OK').replace('Unterkörper', 'UK')}${s.setsFactor || s.setsOverride ? '*' : ''}`).join(' · ')

  return (
    <div className="screen">
      <SubHeader kicker="Plan" title="Phasen im Detail" onBack={onBack} />
      <Segmented tone={tone} value={kind} onChange={switchKind} options={[{ id: 'run', label: 'Laufen' }, { id: 'strength', label: 'Kraft' }]} />
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '12px 24px 2px', scrollbarWidth: 'none' }}>
        {phases.map((p, i) => {
          const on = p.id === phase.id
          const pal = kind === 'run' ? RUN_PHASE_COLORS : STR_PHASE_COLORS
          const startNo = plan.weeks.findIndex((w) => w.start >= p.from) + 1
          return (
            <button key={p.id} onClick={() => setSel(p.id)} style={{ flex: 'none', minWidth: 84, textAlign: 'left', borderRadius: 12, padding: '8px 10px', background: on ? (kind === 'run' ? 'var(--run-bg)' : 'var(--str-bg)') : 'var(--card)', border: `1px solid ${on ? (kind === 'run' ? 'var(--run-deep)' : 'var(--str-dark)') : 'var(--line)'}` }}>
              <div style={{ height: 3, borderRadius: 2, background: pal[i % pal.length], marginBottom: 6 }} />
              <div style={{ font: '600 11px var(--font)', whiteSpace: 'nowrap' }}>{p.name}</div>
              <div style={{ font: '400 10px var(--font)', color: 'var(--text-2)' }}>W {startNo}–{startNo + weeksIn(p) - 1}</div>
            </button>
          )
        })}
      </div>

      <Card>
        <div className="card-head" style={{ alignItems: 'center' }}>
          <span className={`badge ${tone}`}>{phase.name}</span>
          {isCur && <span style={{ font: '600 11px var(--font)', color: kind === 'run' ? 'var(--run)' : 'var(--str)' }}>Aktuell · Woche {curWeekNo}</span>}
        </div>
        <div style={{ font: '500 11px var(--font)', color: 'var(--text-2)', marginTop: 10 }}>
          {fmtDayShort(phase.from)} – {fmtDayShort(phase.to)} · {weeksIn(phase)} Wochen
        </div>
        <div style={{ font: '400 13px/1.5 var(--font)', marginTop: 6 }}>{phase.focus}</div>
        <Tiles items={kind === 'run'
          ? [
              { v: kms.length ? `${Math.min(...kms)}–${Math.max(...kms)} km` : '–', l: 'pro Woche' },
              { v: String(runsPerWeek), l: 'Läufe/Woche' },
              { v: phase.volumePct ? `${phase.volumePct} %` : String(deloads), l: phase.volumePct ? 'Umfang' : 'Deload-Wochen' },
            ]
          : [
              { v: sets.length ? `${Math.min(...sets)}–${Math.max(...sets)}` : '–', l: 'Sätze/Woche' },
              { v: '4', l: 'Einheiten/Woche' },
              { v: String(deloads), l: 'Deload-Wochen' },
            ]} />
      </Card>

      <Card>
        <CardHead title="Wochen dieser Phase" aside={weeks.some((w) => w.estimated) ? 'teils abgeleitet' : undefined} />
        <div className="rows" style={{ marginTop: 6 }}>
          {weeks.map((w, i) => {
            const now = w.start === weekFor(plan, today)?.start
            return (
              <div key={w.start} className="row" style={{ alignItems: 'flex-start' }}>
                <span style={{ width: 34, font: '600 11px var(--font)', color: now ? (kind === 'run' ? 'var(--run)' : 'var(--str)') : 'var(--text-2)', paddingTop: 2 }}>W {firstNo + i}</span>
                <div className="row-main">
                  <div className="row-t">{fmtDayShort(w.start)}{w.label ? ` · ${w.label}` : ''}</div>
                  <div className="row-s" style={{ whiteSpace: 'normal' }}>{keySessions(w)}</div>
                </div>
                <span className="num" style={{ font: '700 14px var(--font)', whiteSpace: 'nowrap' }}>
                  {kind === 'run' ? `${w.targetKm} km` : `${weekStrengthSets(plan, w)} Sätze`}
                </span>
              </div>
            )
          })}
        </div>
        {kind === 'strength' && <div className="hint" style={{ margin: '8px 0 0' }}>* gekürzt (Deload oder Rennwoche)</div>}
      </Card>

      {phase.tip && (
        <Card>
          <CardHead title="Worauf achten" />
          <div className="desc" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>{phase.tip}</div>
        </Card>
      )}
    </div>
  )
}

// ---------------- Einheiten im Detail ----------------

function SessionDetail({ initial, onBack }: { initial: number; onBack: () => void }) {
  const { plan, today } = useData()
  const nav = useNav()
  const week = weekFor(plan, today) ?? plan.weeks[0]
  const sessions = WEEKDAYS.flatMap((d) => week.sessions.filter((s) => s.day === d))
  const todayIdx = sessions.findIndex((s) => sessionDate(week, s) >= today)
  const [idx, setIdx] = useState(initial === 0 && todayIdx > 0 ? todayIdx : initial)
  const s = sessions[idx]
  if (!s) return null
  const isStr = s.kind === 'strength'
  const wo = workoutById(plan, s.workoutId)
  const date = sessionDate(week, s)
  const dayName = DAY_SHORT[WEEKDAYS.indexOf(s.day)]

  return (
    <div className="screen">
      <SubHeader kicker="Plan" title="Einheit im Detail" onBack={onBack} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '14px 24px 0' }}>
        {sessions.map((x, i) => {
          const on = i === idx
          const str = x.kind === 'strength'
          return (
            <button key={i} onClick={() => setIdx(i)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 10, font: '500 11px var(--font)', background: on ? (str ? 'var(--str-bg)' : 'var(--run-bg)') : 'var(--card)', border: `1px solid ${on ? (str ? 'var(--str-dark)' : 'var(--run-deep)') : 'var(--line)'}`, color: on ? 'var(--text)' : 'var(--text-2)' }}>
              <Dot color={str ? 'var(--str)' : x.kind === 'bike' ? 'var(--dot-off)' : 'var(--run)'} />
              {DAY_SHORT[WEEKDAYS.indexOf(x.day)]} · {x.title}
            </button>
          )
        })}
      </div>

      <Card>
        <span className={`badge ${isStr ? 'str' : s.kind === 'bike' ? 'bike' : 'run'}`}>{isStr ? 'Kraft' : s.kind === 'bike' ? 'Rad' : 'Laufen'} · {dayName}</span>
        <div style={{ font: '700 26px/1.15 var(--font)', letterSpacing: '-.02em', marginTop: 12 }}>{s.title}</div>
        <div className="desc" style={{ fontSize: 13, lineHeight: 1.5 }}>{s.description ?? wo?.day}{s.note ? ` ${s.note}` : ''}</div>
        <Tiles items={isStr
          ? [
              { v: String(wo?.exercises.filter((e) => !e.optional).length ?? 0), l: 'Übungen' },
              { v: String(plannedSetsTotal(plan, s)), l: 'Sätze' },
              { v: `${fromISO(date).getDate()}. ${MONTH_SHORT[fromISO(date).getMonth()]}`, l: 'Datum' },
            ]
          : [
              { v: s.durationMin ? `${s.durationMin} Min` : '–', l: 'Dauer' },
              { v: s.km ? `${fmtKm(s.km)} km` : '–', l: 'Distanz' },
              { v: `${fromISO(date).getDate()}. ${MONTH_SHORT[fromISO(date).getMonth()]}`, l: 'Datum' },
            ]} />
      </Card>

      {s.steps && (
        <Card>
          <CardHead title="Ablauf" aside={`${s.steps.length} Abschnitte`} />
          <div style={{ marginTop: 6 }}>
            {s.steps.map((st, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <i style={{ width: 8, height: 8, borderRadius: 4, background: st.key ? 'var(--run)' : 'var(--run-deep)', marginTop: 5, flex: 'none' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <b style={{ font: '600 13px var(--font)' }}>{st.name}</b>
                    <span className="num" style={{ font: '600 13px var(--font)' }}>{st.value}</span>
                  </div>
                  {st.detail && <div style={{ font: '400 12px var(--font)', color: 'var(--text-2)', marginTop: 3 }}>{st.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isStr && wo && (
        <Card>
          <CardHead title="Übungen" aside={wo.day} />
          <div className="gt gt-h" style={{ gridTemplateColumns: '1fr 90px 40px', marginTop: 12 }}>
            <span>ÜBUNG</span><span className="r">SÄTZE × WDH.</span><span className="r">RIR</span>
          </div>
          {wo.exercises.map((e) => (
            <div key={e.name} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 40px', columnGap: 8, alignItems: 'center', padding: '9px 0', borderTop: '1px solid var(--line)', opacity: e.optional ? 0.6 : 1 }}>
              <div>
                <div style={{ font: '600 13px var(--font)' }}>{e.optional ? 'Optional: ' : ''}{e.name}</div>
                {e.note && <div style={{ font: '400 11px var(--font)', color: 'var(--text-2)', marginTop: 2 }}>{e.note}</div>}
              </div>
              <span className="r num" style={{ font: '600 12px var(--font)' }}>{plannedSets(e.sets, s)}{e.setsMax && !s.setsFactor && !s.setsOverride ? `–${e.setsMax}` : ''} × {e.reps.replace(' pro ', '/')}</span>
              <span className="r num" style={{ font: '500 12px var(--font)', color: 'var(--text-2)' }}>{e.rir}</span>
            </div>
          ))}
          {wo.note && <div className="insight">{wo.note}</div>}
        </Card>
      )}

      <div style={{ margin: '14px 24px 0' }}>
        <button className="btn-secondary" disabled={date > today} style={{ opacity: date > today ? 0.5 : 1 }} onClick={() => nav.open(isStr ? { kind: 'strength', date, planned: s } : s.runType === 'test' ? { kind: 'test' } : { kind: 'run', date, planned: s })}>
          {date > today ? `Eintragen ab ${fmtDayShort(date)}` : 'Als erledigt eintragen'}
        </button>
      </div>
    </div>
  )
}
