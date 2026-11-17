import { useState } from 'react'
import { useNav } from '../App'
import { useData } from '../data/store'
import { MUSCLES, type Muscle } from '../data/types'
import { Card, CardHead, Delta, Dot, Empty, Header, Segmented, Tiles } from '../components/ui'
import { HeaderStrength } from '../components/icons'
import { CalendarHeatmap, MonthAxis, RangeMeter, Sparkline, ValueBars } from '../components/charts'
import { CurrentPlanCard, RecentCard } from '../components/shared'
import { addDays, fmtDate, fmtDotDate, mondayOf, MONTH_SHORT } from '../lib/dates'
import { fmtKg, fmtNum } from '../lib/format'
import { weekFor, weekStrengthSets } from '../lib/plan'
import {
  activeDays, activityLevels, bestMonth, byDateDesc, countSets, inRange, isStrength, loadByMuscle, setsByMuscle,
  strengthPRs, weeklyStats, weekStreak,
} from '../lib/stats'

type Seg = 'volumen' | 'muskeln' | 'daten'

export function Strength() {
  const nav = useNav()
  const [seg, setSeg] = useState<Seg>('volumen')
  return (
    <div className="screen">
      <Header icon={<HeaderStrength />} title="Kraft" onPlus={() => nav.open({ kind: 'add' })} />
      <Segmented tone="str" value={seg} onChange={setSeg} options={[{ id: 'volumen', label: 'Volumen' }, { id: 'muskeln', label: 'Muskeln' }, { id: 'daten', label: 'Daten' }]} />
      {seg === 'volumen' && <Volume />}
      {seg === 'muskeln' && <Muscles />}
      {seg === 'daten' && <DataTab />}
    </div>
  )
}

function useWindows() {
  const { activities, today } = useData()
  const str = activities.filter(isStrength)
  const last7 = inRange(str, addDays(today, -6), today)
  const prev7 = inRange(str, addDays(today, -13), addDays(today, -7))
  return { str, last7, prev7 }
}

function Volume() {
  const { plan, activities, today } = useData()
  const { str, last7 } = useWindows()
  const weeks = weeklyStats(activities, today, 12)
  const done = weeks.slice(0, -1) // nur abgeschlossene Wochen vergleichen
  const recent4 = done.slice(-4)
  const first4 = done.slice(0, 4).filter((w) => w.sets > 0)
  const avgSets = recent4.reduce((s, w) => s + w.sets, 0) / 4
  const sets7 = setsByMuscle(last7)
  const inRangeCount = plan.muscleTargets.filter((t) => sets7[t.muscle] >= t.min && sets7[t.muscle] <= t.max).length
  const firstAvg = first4.length ? first4.reduce((s, w) => s + w.sets, 0) / first4.length : 0
  const gain = firstAvg && done.filter((w) => w.sets > 0).length >= 8 ? Math.round(((avgSets - firstAvg) / firstAvg) * 100) : null
  const loadNow = recent4.reduce((s, w) => s + w.load, 0)
  const loadPrev = done.slice(-8, -4).reduce((s, w) => s + w.load, 0)
  const loadGain = loadPrev ? Math.round(((loadNow - loadPrev) / loadPrev) * 100) : null
  const planWeek = weekFor(plan, today)
  const target = planWeek ? weekStrengthSets(plan, planWeek) : 0
  const from13 = addDays(mondayOf(today), -7 * 12)
  const bm = bestMonth(activities.filter((a) => a.date >= from13), 'strength')
  const thisWeek = weeks[weeks.length - 1]
  const sessions = byDateDesc(str).slice(0, 10).reverse()

  return (
    <>
      <Card>
        <span className="badge str">Dein Fortschritt</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 12 }}>
          <b className="num" style={{ font: '700 34px/1 var(--font)', color: 'var(--str)', letterSpacing: '-.02em' }}>
            {gain !== null ? `${gain >= 0 ? '+' : '−'}${Math.abs(gain)} %` : `${thisWeek.sets}`}
          </b>
          <span style={{ font: '500 13px var(--font)', color: 'var(--text-2)' }}>{gain !== null ? (gain >= 0 ? 'mehr Volumen' : 'weniger Volumen') : `von ${target} Sätzen diese Woche`}</span>
        </div>
        <div className="desc" style={{ fontSize: 13 }}>
          {gain !== null ? 'Sätze pro Woche (letzte 4 Wochen) im Vergleich zu den ersten 4 Wochen. ' : 'Geplante harte Sätze laut deinem Plan. '}
          {str.length ? `${inRangeCount} von ${plan.muscleTargets.length} Muskelgruppen liegen in den letzten 7 Tagen im Zielbereich.` : 'Trage deine erste Krafteinheit ein, dann siehst du hier die Entwicklung.'}
        </div>
        <Tiles large items={[
          { v: fmtNum(avgSets, avgSets % 1 ? 1 : 0), l: 'Sätze/Woche' },
          { v: loadGain !== null ? `${loadGain >= 0 ? '+' : '−'}${Math.abs(loadGain)} %` : '–', l: 'Bewegte Last' },
          { v: `${inRangeCount}/${plan.muscleTargets.length}`, l: 'Im Zielbereich' },
        ]} />
      </Card>

      <Card>
        <CardHead title="Trainingskalender" aside="13 Wochen" />
        <CalendarHeatmap levels={activityLevels(activities, 'strength')} date={today} tone="str" />
        <Tiles large items={[
          { v: String(activeDays(activities, from13, today, 'strength')), l: 'Trainingstage' },
          { v: String(weekStreak(activities, today, 'strength')), l: 'Wochenserie' },
          { v: bm ? MONTH_SHORT[Number(bm.slice(5)) - 1] : '–', l: 'Bester Monat' },
        ]} />
      </Card>

      <Card>
        <CardHead title="Volumen pro Muskelgruppe" />
        <div className="kpis">
          <div className="kpi">
            <div className="kpi-l">Sätze · diese Woche</div>
            <div className="kpi-v"><b>{thisWeek.sets}</b><span>/ {target}</span></div>
          </div>
          <div className="kpi">
            <div className="kpi-l">Bewegte Last</div>
            <div className="kpi-v"><b>{fmtNum(thisWeek.load / 1000, 1)}</b><span>t</span></div>
          </div>
        </div>
        <MuscleGrid />
      </Card>

      <Card>
        <CardHead title="Sätze pro Einheit" aside="letzte 10 Einheiten" />
        {sessions.length === 0 ? (
          <Empty title="Noch keine Einheiten" />
        ) : (
          <>
            <div className="kpis">
              <div className="kpi">
                <div className="kpi-l">Letzte Einheit</div>
                <div className="kpi-v"><b>{countSets(sessions[sessions.length - 1])}</b><span>Sätze</span></div>
              </div>
              <div className="kpi">
                <div className="kpi-l">Ø pro Einheit</div>
                <div className="kpi-v"><b>{fmtNum(sessions.reduce((s, a) => s + countSets(a), 0) / sessions.length, 1)}</b><span>Sätze</span></div>
              </div>
            </div>
            <ValueBars
              items={sessions.map((a) => ({ label: fmtDotDate(a.date).slice(0, -1).replace(/^0/, ''), v: countSets(a), key: a.workoutId ?? '' }))}
              colorFor={(k) => (k.startsWith('uk') ? 'var(--str-deep)' : 'var(--str-light)')}
            />
            <div style={{ display: 'flex', gap: 14, marginTop: 10, font: '500 11px var(--font)', color: 'var(--text-2)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Dot color="var(--str-deep)" />Unterkörper</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Dot color="var(--str-light)" />Oberkörper</span>
            </div>
          </>
        )}
      </Card>
    </>
  )
}

function MuscleGrid() {
  const { activities, today } = useData()
  const lastMon = mondayOf(today)
  const starts = Array.from({ length: 12 }, (_, i) => addDays(lastMon, -7 * (11 - i)))
  const str = activities.filter(isStrength)
  const perWeek = starts.map((s) => setsByMuscle(inRange(str, s, addDays(s, 6))))
  const max = Math.max(1, ...perWeek.flatMap((w) => Object.values(w)))
  // rechte Spalte: letzte 7 Tage gegen die 7 Tage davor
  const cur = setsByMuscle(inRange(str, addDays(today, -6), today))
  const prev = setsByMuscle(inRange(str, addDays(today, -13), addDays(today, -7)))
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '92px 1fr 44px', gap: 8, font: '500 10px var(--font)', color: 'var(--text-2)' }}>
        <span />
        <span />
        <span className="r">7 Tage</span>
      </div>
      {MUSCLES.map((m) => {
        const d = cur[m.id] - prev[m.id]
        return (
          <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '92px 1fr 44px', gap: 8, alignItems: 'center', marginTop: 5 }}>
            <span style={{ font: '600 11px var(--font)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 2 }}>
              {perWeek.map((w, i) => (
                <div key={i} style={{ height: 16, borderRadius: 3, background: w[m.id] ? `rgba(169,155,255,${(0.15 + 0.85 * Math.pow(w[m.id] / max, 1.4)).toFixed(2)})` : '#1b1f1f' }} />
              ))}
            </div>
            <span className="r num" style={{ font: '700 12px var(--font)' }}>
              {cur[m.id]}
              <small style={{ font: '600 10px var(--font)', color: d > 0 ? 'var(--str)' : 'var(--text-2)', marginLeft: 3 }}>{d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '±0'}</small>
            </span>
          </div>
        )
      })}
      <div style={{ paddingLeft: 100, paddingRight: 52 }}>
        <MonthAxis starts={starts} />
      </div>
    </div>
  )
}

function series(str: ReturnType<typeof useWindows>['str'], today: string, m: Muscle, kind: 'sets' | 'load'): number[] {
  const lastMon = mondayOf(today)
  return Array.from({ length: 8 }, (_, i) => {
    const s = addDays(lastMon, -7 * (7 - i))
    const w = inRange(str, s, addDays(s, 6))
    return kind === 'sets' ? setsByMuscle(w)[m] : loadByMuscle(w)[m]
  })
}

function Muscles() {
  const { plan, today } = useData()
  const { str, last7, prev7 } = useWindows()
  const sets = setsByMuscle(last7)
  const prevSets = setsByMuscle(prev7)
  const load = loadByMuscle(last7)
  const prevLoad = loadByMuscle(prev7)
  const targets = plan.muscleTargets
  const scaleMax = Math.max(...targets.map((t) => t.max)) * 1.15
  const under = targets.filter((t) => sets[t.muscle] < t.min)
  const name = (m: Muscle) => MUSCLES.find((x) => x.id === m)?.name ?? m

  if (!str.length) {
    return (
      <Card>
        <CardHead title="Sätze je Muskelgruppe" aside="Ziel laut Plan" />
        <div className="rows" style={{ marginTop: 6 }}>
          {targets.map((t) => (
            <div key={t.muscle} className="row">
              <Dot color="var(--str)" />
              <div className="row-main"><div className="row-t">{name(t.muscle)}</div><div className="row-s">{t.priority}{t.rir ? ` · RIR ${t.rir}` : ''}</div></div>
              <span className="num" style={{ font: '600 13px var(--font)' }}>{t.min}–{t.max} <small style={{ color: 'var(--text-2)', fontWeight: 500 }}>Sätze</small></span>
            </div>
          ))}
        </div>
        <div className="insight">Nach deiner ersten Krafteinheit zeigt Form hier, wie viele harte Sätze jede Muskelgruppe in den letzten 7 Tagen bekommen hat.</div>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHead title="Sätze je Muskelgruppe" aside="letzte 7 Tage" />
        {targets.map((t, i) => {
          const v = sets[t.muscle]
          const d = v - prevSets[t.muscle]
          const status = v < t.min ? 'Unter Ziel' : v > t.max ? 'Über Ziel' : 'Im Zielbereich'
          return (
            <div key={t.muscle} style={{ padding: '12px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: '600 12px var(--font)' }}><Dot color="var(--str)" />{name(t.muscle)}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                    <b className="num" style={{ font: '700 24px var(--font)' }}>{v}</b>
                    <span style={{ font: '500 11px var(--font)', color: 'var(--text-2)' }}>Sätze</span>
                    {d === 0 ? <Delta up={null}>±0</Delta> : <Delta up={d > 0} tone="str" good={d > 0}>{d > 0 ? '+' : '−'}{Math.abs(d)}</Delta>}
                  </div>
                </div>
                <Sparkline values={series(str, today, t.muscle, 'sets')} color="var(--str)" />
              </div>
              <RangeMeter value={v} min={t.min} max={t.max} scaleMax={scaleMax} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, font: '500 11px var(--font)', color: 'var(--text-2)' }}>
                <span>Ziel {t.min}–{t.max} Sätze</span>
                <span style={{ color: status === 'Im Zielbereich' ? 'var(--text-2)' : 'var(--warn)' }}>{status}</span>
              </div>
            </div>
          )
        })}
        <div className="insight">
          {under.length
            ? `${under.map((u) => name(u.muscle)).join(', ')} ${under.length === 1 ? 'liegt' : 'liegen'} unter dem Zielbereich. Ein zusätzlicher Satz pro Einheit würde reichen.`
            : 'Alle Muskelgruppen liegen im oder über dem Zielbereich. Weiter so.'}
        </div>
      </Card>

      <Card>
        <CardHead title="Bewegte Last je Muskelgruppe" aside="kg · letzte 7 Tage" />
        {targets.map((t, i) => {
          const v = load[t.muscle]
          const p = prevLoad[t.muscle] ? Math.round(((v - prevLoad[t.muscle]) / prevLoad[t.muscle]) * 100) : null
          return (
            <div key={t.muscle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: '600 12px var(--font)' }}><Dot color="var(--str)" />{name(t.muscle)}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                  <b className="num" style={{ font: '700 22px var(--font)' }}>{fmtNum(Math.round(v))}</b>
                  <span style={{ font: '500 11px var(--font)', color: 'var(--text-2)' }}>kg</span>
                  {p !== null && p !== 0 && <Delta up={p > 0} tone="str" good={p > 0}>{p > 0 ? '+' : '−'}{Math.abs(p)} %</Delta>}
                </div>
              </div>
              <Sparkline values={series(str, today, t.muscle, 'load')} color="var(--str)" />
            </div>
          )
        })}
        <div className="insight">Die bewegte Last ist Wiederholungen × Gewicht. Steigt sie bei gleichen Sätzen, wirst du stärker.</div>
      </Card>
    </>
  )
}

function DataTab() {
  const { plan, activities } = useData()
  const nav = useNav()
  const prs = strengthPRs(activities).slice(0, 6)
  const name = (m: Muscle) => MUSCLES.find((x) => x.id === m)?.name ?? m
  return (
    <>
      <Card>
        <CardHead title="Bestleistungen" aside="schwerster Satz" />
        {prs.length === 0 ? (
          <Empty title="Noch keine Bestleistungen">Sie entstehen automatisch aus deinen Krafteinheiten.</Empty>
        ) : (
          <div className="rows" style={{ marginTop: 4 }}>
            {prs.map((p) => (
              <div key={p.name} className="row" style={{ padding: '12px 0' }}>
                <div className="row-main">
                  <div className="row-t">{p.name}</div>
                  <div className="row-s">{fmtDate(p.date)}</div>
                </div>
                <div>
                  <div className="row-v" style={{ fontSize: 22 }}>{fmtKg(p.kg)}<small>kg</small></div>
                  <div className="row-vs">{p.reps} Wiederholungen</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <CurrentPlanCard kind="strength" onPlan={() => nav.go('plan')} />
      <RecentCard kind="strength" />
      <Card>
        <CardHead title="Ziele je Muskelgruppe" aside="harte Sätze pro Woche" />
        <div className="rows" style={{ marginTop: 6 }}>
          {plan.muscleTargets.map((t) => (
            <div key={t.muscle} className="row">
              <div className="row-main"><div className="row-t">{name(t.muscle)}</div><div className="row-s">{t.priority}{t.rir ? ` · RIR ${t.rir}` : ''}</div></div>
              <span className="num" style={{ font: '700 16px var(--font)' }}>{t.sets}</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}
