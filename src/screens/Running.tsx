import { useState } from 'react'
import { useNav } from '../App'
import { useData } from '../data/store'
import { deleteShoe, saveShoe, updateSettings } from '../data/db'
import type { RunType, Shoe } from '../data/types'
import { Card, CardHead, CardLink, Delta, Dot, Empty, Header, ProgressBar, Segmented, Sheet, Tiles } from '../components/ui'
import { HeaderRun } from '../components/icons'
import { CalendarHeatmap, Sparkline, WeeklyBars } from '../components/charts'
import { CurrentPlanCard, RecentCard } from '../components/shared'
import { addDays, fmtDate, fromISO, mondayOf, MONTH_SHORT } from '../lib/dates'
import { fmtDuration, fmtHours, fmtKm, fmtNum, fmtPace, parseNum, uid } from '../lib/format'
import { aRace } from '../lib/plan'
import { paceRefs, predictTime, riegel, STANDARD_DISTANCES } from '../lib/running'
import {
  activeDays, activityLevels, avgPace, bestEfforts, bestMonth, byDateDesc, currentVdot, intensity, isRun, isTest,
  paceSeries, runLike, weeklyStats, weekStreak,
} from '../lib/stats'

type Seg = 'volumen' | 'leistung' | 'daten'

export function Running() {
  const nav = useNav()
  const [seg, setSeg] = useState<Seg>('volumen')
  return (
    <div className="screen">
      <Header icon={<HeaderRun />} title="Laufen" onPlus={() => nav.open({ kind: 'add' })} />
      <Segmented value={seg} onChange={setSeg} options={[{ id: 'volumen', label: 'Volumen' }, { id: 'leistung', label: 'Leistung' }, { id: 'daten', label: 'Daten' }]} />
      {seg === 'volumen' && <Volume />}
      {seg === 'leistung' && <Performance />}
      {seg === 'daten' && <DataTab />}
    </div>
  )
}

// ---------------- Volumen ----------------

function Volume() {
  const { plan, activities, today, shoes } = useData()
  const weeks = weeklyStats(activities, today, 12)
  const cur = weeks[weeks.length - 1]
  const prev = weeks[weeks.length - 2]
  const past = weeks.slice(0, -1).filter((w) => w.km > 0)
  const avg = past.length ? past.reduce((s, w) => s + w.km, 0) / past.length : 0
  const planStart = plan.weeks[0]?.start ?? addDays(today, -84)
  const sincePlan = runLike(activities).filter((r) => r.date >= planStart && r.date <= today)
  const totalKm = sincePlan.reduce((s, r) => s + r.km, 0)
  const days = new Set(sincePlan.map((r) => r.date)).size
  const v = currentVdot(activities, today)
  const tests = byDateDesc(activities.filter(isTest))
  const race = aRace(plan)
  const from13 = addDays(mondayOf(today), -7 * 12)
  const levels = activityLevels(activities, 'run')
  const bm = bestMonth(activities.filter((a) => a.date >= from13), 'run')
  const it = intensity(activities, addDays(today, -27), today)
  const runsWithShoes = activities.filter(isRun)

  return (
    <>
      <Card>
        <span className="badge run">Dein Fortschritt</span>
        <Progress v={v} tests={tests} race={race} totalKm={totalKm} />
        <Tiles large items={[
          { v: fmtKm(totalKm), l: 'km seit Planstart' },
          { v: String(days), l: 'Trainingstage' },
          { v: v ? fmtNum(v.vdot, 1) : '–', l: 'VDOT' },
        ]} />
      </Card>

      <Card>
        <CardHead title="Wochenumfang" />
        <div className="kpis">
          <div className="kpi">
            <div className="kpi-l">Distanz · diese Woche</div>
            <div className="kpi-v"><b>{fmtKm(cur.km)}</b><span>km</span></div>
            {prev.km > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, font: '500 11px var(--font)', color: 'var(--muted)' }}>Vorwoche {fmtKm(prev.km)} km <WeekDelta cur={prev.km} prev={weeks[weeks.length - 3].km} /></div>}
          </div>
          <div className="kpi">
            <div className="kpi-l">Zeit · diese Woche</div>
            <div className="kpi-v"><b>{fmtHours(cur.sec)}</b><span>h</span></div>
          </div>
        </div>
        <WeeklyBars weeks={weeks} avg={avg} />
        <div style={{ display: 'flex', gap: 14, marginTop: 12, font: '500 11px var(--font)', color: 'var(--text-2)', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Dot color="var(--run-darker)" />Wochen-km</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Dot color="var(--run-deep)" />Längster Lauf</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><i style={{ width: 12, borderTop: '1px dashed var(--text-2)' }} />Ø {fmtKm(avg)} km</span>
        </div>
      </Card>

      <Card>
        <CardHead title="Trainingskalender" aside="13 Wochen" />
        <CalendarHeatmap levels={levels} date={today} tone="run" />
        <Tiles large items={[
          { v: String(activeDays(activities, from13, today, 'run')), l: 'Aktive Tage' },
          { v: String(weekStreak(activities, today, 'run')), l: 'Wochenserie' },
          { v: bm ? MONTH_SHORT[Number(bm.slice(5)) - 1] : '–', l: 'Bester Monat' },
        ]} />
      </Card>

      <Card>
        <CardHead title="Intensität" aside="Anteil nach km · 4 Wochen" />
        {it.total === 0 ? (
          <Empty title="Noch keine Läufe">Sobald du Läufe einträgst, siehst du hier die Verteilung locker zu hart.</Empty>
        ) : (
          <IntensityBlock it={it} />
        )}
      </Card>

      <ShoesCard shoes={shoes} runs={runsWithShoes} />
    </>
  )
}

function WeekDelta({ cur, prev }: { cur: number; prev: number }) {
  if (!prev) return null
  const p = Math.round(((cur - prev) / prev) * 100)
  if (p === 0) return <Delta up={null}>±0 %</Delta>
  return <Delta up={p > 0} good={p > 0 && p <= 12}>{Math.abs(p)} %</Delta>
}

function Progress({ v, tests, race, totalKm }: { v: ReturnType<typeof currentVdot>; tests: { vdot: number; date: string }[]; race?: { goalSec: number; distanceKm: number; name: string }; totalKm: number }) {
  if (v && race) {
    const pred = predictTime(v.vdot, race.distanceKm)
    const margin = Math.round(pred - race.goalSec)
    const first = tests[tests.length - 1]
    const gain = first && tests.length > 1 ? predictTime(first.vdot, race.distanceKm) - pred : null
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 12 }}>
          <b className="num" style={{ font: '700 34px/1 var(--font)', color: 'var(--run)', letterSpacing: '-.02em' }}>{gain !== null ? fmtDuration(Math.abs(gain)) : fmtDuration(pred)}</b>
          <span style={{ font: '500 13px var(--font)', color: 'var(--text-2)' }}>{gain !== null ? (gain >= 0 ? 'min schneller' : 'min langsamer') : 'HM-Prognose'}</span>
        </div>
        <div className="desc" style={{ fontSize: 13 }}>
          {gain !== null ? `Seit deinem ersten Test. ` : ''}
          Deine Halbmarathon-Prognose ({fmtDuration(pred)}) liegt {fmtNum(Math.abs(margin))} s {margin <= 0 ? 'unter' : 'über'} dem Ziel des {race.name}s.
        </div>
      </>
    )
  }
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 12 }}>
        <b className="num" style={{ font: '700 34px/1 var(--font)', color: 'var(--run)', letterSpacing: '-.02em' }}>{fmtKm(totalKm)}</b>
        <span style={{ font: '500 13px var(--font)', color: 'var(--text-2)' }}>km gelaufen</span>
      </div>
      <div className="desc" style={{ fontSize: 13 }}>Mit dem 5-km-Test am 9. Januar berechnet Form deine Halbmarathon-Prognose und vergleicht sie mit deinem Ziel.</div>
    </>
  )
}

function IntensityBlock({ it }: { it: ReturnType<typeof intensity> }) {
  const easyP = ((it.easy + it.long) / it.total) * 100
  const hardP = 100 - easyP
  const rows = [
    { n: 'Easy Runs', km: it.easy, c: 'var(--run-deep)' },
    { n: 'Long Runs', km: it.long, c: 'var(--run-mid)' },
    { n: 'Schwelle', km: it.thr, c: 'var(--run)' },
    { n: 'Intervall & Tests', km: it.intv, c: 'var(--run-light)' },
  ]
  const verdict = easyP >= 75 ? `Gut verteilt: ${Math.round(easyP)} % locker, ${Math.round(hardP)} % hart. Die harten Einheiten bleiben gezielt.` : `Nur ${Math.round(easyP)} % locker. Ziel sind rund 80 %: halte Easy Runs und Long Runs wirklich in der Easy-Zone.`
  return (
    <>
      <div style={{ display: 'flex', marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, font: '500 11px var(--font)', color: 'var(--text-2)' }}><Dot color="var(--run-deep)" />Lockere Läufe</div>
          <b className="num" style={{ font: '700 28px var(--font)', display: 'block', marginTop: 6 }}>{Math.round(easyP)} %</b>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, font: '500 11px var(--font)', color: 'var(--text-2)' }}><Dot color="var(--run-light)" />Härtere Läufe</div>
          <b className="num" style={{ font: '700 28px var(--font)', display: 'block', marginTop: 6 }}>{Math.round(hardP)} %</b>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 3, marginTop: 12 }}>
        {rows.filter((r) => r.km > 0).map((r) => (
          <div key={r.n} style={{ flex: r.km, height: 10, borderRadius: 5, background: r.c }} />
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        {rows.map((r) => (
          <div key={r.n} style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr 40px', alignItems: 'center', gap: 10, padding: '6px 0' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, font: '600 12px var(--font)' }}><Dot color={r.c} />{r.n}</span>
            <ProgressBar value={r.km / it.total} color={r.c} />
            <span className="r num" style={{ font: '600 12px var(--font)' }}>{Math.round((r.km / it.total) * 100)} %</span>
          </div>
        ))}
      </div>
      <div className="insight">{verdict}</div>
    </>
  )
}

function ShoesCard({ shoes, runs }: { shoes: Shoe[]; runs: ReturnType<typeof Array.prototype.filter> }) {
  const [editing, setEditing] = useState(false)
  const list = [...shoes].sort((a, b) => Number(!!a.retired) - Number(!!b.retired))
  const kmOf = (s: Shoe) => s.startKm + (runs as { shoeId?: string; distanceKm: number }[]).filter((r) => r.shoeId === s.id).reduce((n, r) => n + r.distanceKm, 0)
  const countOf = (s: Shoe) => (runs as { shoeId?: string }[]).filter((r) => r.shoeId === s.id).length
  const warn = list.find((s) => !s.retired && kmOf(s) / s.maxKm >= 0.75)
  return (
    <Card>
      <div className="card-head">
        <span className="card-title">Schuhe</span>
        <button style={{ font: '600 13px var(--font)' }} onClick={() => setEditing(true)}>{shoes.length ? 'Bearbeiten' : 'Hinzufügen'}</button>
      </div>
      {list.length === 0 && <Empty title="Noch keine Schuhe">Trage deine Laufschuhe ein, um ihren Kilometerstand zu verfolgen.</Empty>}
      {list.map((s) => {
        const km = kmOf(s)
        const p = km / s.maxKm
        const color = s.retired ? 'var(--dot-off)' : p >= 0.75 ? 'var(--warn)' : 'var(--run)'
        return (
          <div key={s.id} style={{ marginTop: 14, opacity: s.retired ? 0.5 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: '600 14px var(--font)' }}><Dot color={color} />{s.name}</div>
                <div style={{ font: '400 11px var(--font)', color: 'var(--text-2)', marginTop: 4 }}>Seit {MONTH_SHORT[fromISO(s.since).getMonth()]} {fromISO(s.since).getFullYear()} · {countOf(s)} Läufe</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <b className="num" style={{ font: '700 22px var(--font)' }}>{fmtNum(Math.round(km))}</b> <span style={{ font: '500 11px var(--font)', color: 'var(--text-2)' }}>km</span>
                <div style={{ font: '500 11px var(--font)', color: s.retired ? 'var(--text-2)' : p >= 0.75 ? 'var(--warn)' : 'var(--text-2)' }}>{s.retired ? 'Ausgemustert' : p >= 0.75 ? 'Bald ersetzen' : ''}</div>
              </div>
            </div>
            <div style={{ marginTop: 8 }}><ProgressBar value={p} color={color} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, font: '500 11px var(--font)', color: 'var(--text-2)' }}>
              <span>{Math.round(p * 100)} % der Laufleistung</span>
              <span>Ziel {fmtNum(s.maxKm)} km</span>
            </div>
          </div>
        )
      })}
      {warn && <div className="insight">Der {warn.name} hat {Math.round((kmOf(warn) / warn.maxKm) * 100)} % seiner Laufleistung erreicht. Plane einen Ersatz ein.</div>}
      {editing && <ShoeEditor shoes={shoes} onClose={() => setEditing(false)} />}
    </Card>
  )
}

function ShoeEditor({ shoes, onClose }: { shoes: Shoe[]; onClose: () => void }) {
  const { today } = useData()
  const [name, setName] = useState('')
  const [maxKm, setMaxKm] = useState('800')
  const [startKm, setStartKm] = useState('0')
  const add = async () => {
    if (!name.trim()) return
    await saveShoe({ id: uid(), name: name.trim(), since: today, maxKm: parseNum(maxKm) ?? 800, startKm: parseNum(startKm) ?? 0 })
    setName('')
    setStartKm('0')
  }
  return (
    <Sheet title="Schuhe" onClose={onClose}>
      {shoes.map((s) => (
        <div key={s.id} className="menu-item" style={{ cursor: 'default' }}>
          <div style={{ flex: 1 }}>
            <div className="menu-t">{s.name}</div>
            <div className="menu-s">Ziel {s.maxKm} km{s.startKm ? ` · Start ${s.startKm} km` : ''}{s.retired ? ' · ausgemustert' : ''}</div>
          </div>
          <button style={{ font: '600 12px var(--font)', color: 'var(--text-2)' }} onClick={() => saveShoe({ ...s, retired: !s.retired })}>{s.retired ? 'Aktivieren' : 'Ausmustern'}</button>
          <button style={{ font: '600 12px var(--font)', color: '#ff8080', marginLeft: 12 }} onClick={() => confirm(`${s.name} löschen?`) && deleteShoe(s.id)}>Löschen</button>
        </div>
      ))}
      <div className="list-box">
        <div className="list-row"><label htmlFor="sn">Neuer Schuh</label><input id="sn" placeholder="z. B. ASICS Novablast 4" value={name} onChange={(x) => setName(x.target.value)} /></div>
        <div className="list-row"><label htmlFor="sm">Ziel-Laufleistung (km)</label><input id="sm" inputMode="numeric" value={maxKm} onChange={(x) => setMaxKm(x.target.value)} /></div>
        <div className="list-row"><label htmlFor="ss">Bereits gelaufen (km)</label><input id="ss" inputMode="numeric" value={startKm} onChange={(x) => setStartKm(x.target.value)} /></div>
      </div>
      <button className="btn-primary" style={{ marginTop: 12 }} disabled={!name.trim()} onClick={add}>Schuh hinzufügen</button>
    </Sheet>
  )
}

// ---------------- Leistung ----------------

function Performance() {
  const { activities, today } = useData()
  const nav = useNav()
  const from = addDays(today, -27)
  const prevFrom = addDays(today, -55)
  const prevTo = addDays(today, -28)
  const types = [
    { n: 'Schwelle', t: ['schwelle'] as RunType[] },
    { n: 'Intervalle', t: ['intervall'] as RunType[] },
    { n: 'Lockere Läufe', t: ['easy', 'long'] as RunType[] },
  ]
  const efforts = bestEfforts(activities)
  const v = currentVdot(activities, today)
  const anyBest = efforts.find((e) => e.sec !== null) as { km: number; sec: number } | undefined

  return (
    <>
      <Card>
        <CardHead title="Aktuelle Pace" aside="Ø 4 Wochen" />
        <div className="rows" style={{ marginTop: 4 }}>
          {types.map(({ n, t }) => {
            const cur = avgPace(activities, [...t], from, today)
            const old = avgPace(activities, [...t], prevFrom, prevTo)
            const d = cur && old ? Math.round(cur - old) : null
            const easyHr = t.includes('easy') ? avgHr(activities, from, today) : null
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
                <div>
                  <div style={{ font: '500 11px var(--font)', color: 'var(--text-2)' }}>{n}{easyHr ? ` · ${easyHr} bpm` : ''}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                    <b className="num" style={{ font: '700 26px var(--font)', letterSpacing: '-.02em' }}>{cur ? fmtPace(cur) : '–'}</b>
                    <span style={{ font: '500 12px var(--font)', color: 'var(--text-2)' }}>/km</span>
                    {d !== null && d !== 0 && <Delta up={d > 0} good={d < 0}>{Math.abs(d)} s</Delta>}
                  </div>
                </div>
                <Sparkline values={paceSeries(activities, [...t], today, 8).map((x) => (x ? -x : null))} color="var(--run)" />
              </div>
            )
          })}
        </div>
        {activities.filter(isRun).length === 0 && <div className="hint" style={{ margin: '4px 0 0' }}>Die Werte erscheinen, sobald du Läufe eingetragen hast.</div>}
      </Card>

      <Card>
        <CardHead title="Bestzeiten" />
        <div className="rows" style={{ marginTop: 4 }}>
          {efforts.map((e) => (
            <div key={e.km} className="row" style={{ padding: '12px 0' }}>
              <div className="row-main">
                <div className="row-t">{e.name}</div>
                <div className="row-s">{e.sec !== null && 'date' in e ? `${MONTH_SHORT[fromISO(e.date).getMonth()]} ${fromISO(e.date).getFullYear()}` : 'Noch kein Lauf'}</div>
              </div>
              {e.sec !== null ? (
                <div>
                  <div className="row-v" style={{ fontSize: 22 }}>{fmtDuration(e.sec)}</div>
                  <div className="row-vs">{fmtPace(e.sec / e.km)} /km</div>
                </div>
              ) : (
                <span style={{ font: '700 20px var(--font)', color: 'var(--text-2)' }}>–</span>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHead title="Leistungsvorhersage" />
        {!v && !anyBest ? (
          <Empty title="Noch keine Grundlage">Trage einen Leistungstest ein, zum Beispiel deinen 5-km-Test am 9. Januar.</Empty>
        ) : (
          <>
            <div className="rows" style={{ marginTop: 4 }}>
              {STANDARD_DISTANCES.map((d) => {
                const t = v ? predictTime(v.vdot, d.km) : riegel(anyBest!.sec, anyBest!.km, d.km)
                return (
                  <div key={d.km} className="row" style={{ padding: '12px 0' }}>
                    <div className="row-main"><div className="row-t">{d.name}</div></div>
                    <div>
                      <div className="row-v" style={{ fontSize: 22, color: 'var(--text-2)' }}>{fmtDuration(t)}</div>
                      <div className="row-vs">{fmtPace(t / d.km)} /km</div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="hint" style={{ margin: '10px 0 0' }}>
              {v ? `Basis: VDOT ${fmtNum(v.vdot, 1)} aus ${v.label} am ${fmtDate(v.date)} (Daniels-Formel).` : 'Basis: deine beste Leistung, Riegel-Formel.'}
            </div>
          </>
        )}
        <CardLink label="Neuen Test eintragen" onClick={() => nav.open({ kind: 'test' })} />
      </Card>
    </>
  )
}

function avgHr(acts: ReturnType<typeof useData>['activities'], from: string, to: string): number | null {
  const rs = acts.filter(isRun).filter((r) => r.date >= from && r.date <= to && (r.runType === 'easy' || r.runType === 'long') && r.avgHr)
  if (!rs.length) return null
  return Math.round(rs.reduce((s, r) => s + (r.avgHr ?? 0), 0) / rs.length)
}

// ---------------- Daten ----------------

function DataTab() {
  const { plan, settings, activities, today } = useData()
  const nav = useNav()
  const [maxHr, setMaxHr] = useState(settings.maxHr ? String(settings.maxHr) : '')
  const mx = settings.maxHr
  const zones = [
    { z: 'Z1', n: 'Erholung', a: 0.5, b: 0.6 },
    { z: 'Z2', n: 'Grundlage', a: 0.6, b: 0.7 },
    { z: 'Z3', n: 'Tempo', a: 0.7, b: 0.8 },
    { z: 'Z4', n: 'Schwelle', a: 0.8, b: 0.9 },
    { z: 'Z5', n: 'Maximal', a: 0.9, b: 1 },
  ]
  const zoneColors = ['var(--run-darker)', 'var(--run-deep)', 'var(--run-mid)', 'var(--run)', 'var(--run-light)']
  const v = currentVdot(activities, today)
  const refs = v ? paceRefs(v.vdot) : null
  const saveMax = () => {
    const n = Number(maxHr)
    updateSettings({ maxHr: n >= 120 && n <= 230 ? n : undefined })
  }

  return (
    <>
      <Card>
        <CardHead title="Herzfrequenz-Zonen" aside="aus deinem Plan" />
        <div className="rows" style={{ marginTop: 6 }}>
          {[
            { n: 'Easy', v: `${plan.hr.easy[0]}–${plan.hr.easy[1]}`, c: 'var(--run-deep)' },
            { n: 'Schwelle', v: `${plan.hr.threshold[0]}–${plan.hr.threshold[1]}`, c: 'var(--run)' },
            { n: 'Intervall', v: `max. ${plan.hr.intervalMax}`, c: 'var(--run-light)' },
          ].map((r) => (
            <div key={r.n} className="row">
              <Dot color={r.c} />
              <span className="row-main" style={{ font: '600 13px var(--font)' }}>{r.n}</span>
              <span className="num" style={{ font: '600 13px var(--font)' }}>{r.v} <small style={{ color: 'var(--text-2)', fontWeight: 500 }}>bpm</small></span>
            </div>
          ))}
        </div>
        <div className="list-row" style={{ borderTop: '1px solid var(--line)', marginTop: 4 }}>
          <label htmlFor="maxhr">Max. Puls (bpm)</label>
          <input id="maxhr" inputMode="numeric" placeholder="eintragen" value={maxHr} onChange={(x) => setMaxHr(x.target.value.replace(/\D/g, ''))} onBlur={saveMax} style={{ font: '700 18px var(--font)', textAlign: 'right', background: 'none', border: 0, outline: 0, color: 'var(--text)', width: 100 }} />
        </div>
        {mx ? (
          <>
            <div className="gt gt-h" style={{ gridTemplateColumns: '1fr 80px 70px', marginTop: 6 }}>
              <span>ZONE</span><span className="r">BPM</span><span className="r">% HFMAX</span>
            </div>
            {zones.map((z, i) => (
              <div key={z.z} className="gt gt-r" style={{ gridTemplateColumns: '1fr 80px 70px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, font: '600 13px var(--font)' }}><Dot color={zoneColors[i]} />{z.z}<span style={{ color: 'var(--text-2)', fontWeight: 400 }}> · {z.n}</span></span>
                <span className="r num" style={{ font: '600 13px var(--font)' }}>{Math.round(mx * z.a) + (i ? 1 : 0)}–{Math.round(mx * z.b)}</span>
                <span className="r num" style={{ font: '500 12px var(--font)', color: 'var(--text-2)' }}>{z.a * 100}–{z.b * 100} %</span>
              </div>
            ))}
          </>
        ) : (
          <div className="hint" style={{ margin: '6px 0 0' }}>Mit deinem maximalen Puls berechnet Form zusätzlich die fünf Zonen nach % HFmax.</div>
        )}
      </Card>

      <Card>
        <CardHead title="Pace-Zonen" />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <div className="tile" style={{ textAlign: 'left', padding: 12 }}>
            <div style={{ font: '500 11px var(--font)', color: 'var(--text-2)' }}>Aktuelle VDOT</div>
            <div className="num" style={{ font: '700 20px var(--font)', marginTop: 6 }}>{v ? fmtNum(v.vdot, 1) : '–'}</div>
          </div>
          <div className="tile" style={{ textAlign: 'left', padding: 12 }}>
            <div style={{ font: '500 11px var(--font)', color: 'var(--text-2)' }}>Belegter Test</div>
            <div style={{ font: '700 17px var(--font)', marginTop: 6 }}>{v ? `${fromISO(v.date).getDate()}. ${MONTH_SHORT[fromISO(v.date).getMonth()]}` : '–'}</div>
            <div style={{ font: '400 10px var(--font)', color: 'var(--text-2)', marginTop: 2 }}>{v?.label ?? 'Test am 9. Januar'}</div>
          </div>
        </div>
        {refs ? (
          <>
            <div className="section-label">Pace-Referenzen</div>
            <div className="rows">
              {[
                { n: 'Easy', v: `${fmtPace(refs.easy[0])}–${fmtPace(refs.easy[1])}`, c: 'var(--run-deep)' },
                { n: 'Schwelle', v: fmtPace(refs.schwelle), c: 'var(--run-mid)' },
                { n: 'Intervall', v: fmtPace(refs.intervall), c: 'var(--run)' },
                { n: 'Renntempo HM', v: fmtPace(refs.renntempo), c: 'var(--run-light)' },
              ].map((r) => (
                <div key={r.n} className="row">
                  <Dot color={r.c} />
                  <span className="row-main" style={{ font: '600 13px var(--font)' }}>{r.n}</span>
                  <span className="num" style={{ font: '600 14px var(--font)' }}>{r.v} <small style={{ color: 'var(--text-2)', fontWeight: 500 }}>/km</small></span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="hint" style={{ margin: '10px 0 0' }}>Bis zum ersten Test steuerst du über den Puls aus deinem Plan.</div>
        )}
        <CardLink label="Neuen Test eintragen" onClick={() => nav.open({ kind: 'test' })} />
      </Card>

      <CurrentPlanCard kind="run" onPlan={() => nav.go('plan')} />
      <RecentCard kind="run" />
    </>
  )
}
