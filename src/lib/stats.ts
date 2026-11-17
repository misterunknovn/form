// Kennzahlen aus den erfassten Einheiten.

import type {
  Activity, BikeActivity, ISODate, Muscle, RunActivity, RunType, StrengthActivity, TestActivity,
} from '../data/types'
import { MUSCLES } from '../data/types'
import { addDays, diffDays, mondayOf } from './dates'
import { STANDARD_DISTANCES, riegel, vdot as calcVdot } from './running'

export const isRun = (a: Activity): a is RunActivity => a.kind === 'run'
export const isStrength = (a: Activity): a is StrengthActivity => a.kind === 'strength'
export const isTest = (a: Activity): a is TestActivity => a.kind === 'test'
export const isBike = (a: Activity): a is BikeActivity => a.kind === 'bike'

/** Läufe inklusive Tests (Tests zählen als gelaufene Kilometer) */
export function runLike(acts: Activity[]): { date: ISODate; km: number; sec: number; runType: RunType; hr?: number }[] {
  const out: { date: ISODate; km: number; sec: number; runType: RunType; hr?: number }[] = []
  for (const a of acts) {
    if (a.kind === 'run') out.push({ date: a.date, km: a.distanceKm, sec: a.durationSec, runType: a.runType, hr: a.avgHr })
    if (a.kind === 'test') out.push({ date: a.date, km: a.distanceKm, sec: a.durationSec, runType: 'test' })
  }
  return out
}

export function byDateDesc<T extends { date: ISODate; createdAt?: number }>(xs: T[]): T[] {
  return [...xs].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? 0) - (a.createdAt ?? 0))
}

export function inRange<T extends { date: ISODate }>(xs: T[], from: ISODate, to: ISODate): T[] {
  return xs.filter((x) => x.date >= from && x.date <= to)
}

export interface WeekStat {
  start: ISODate
  km: number
  sec: number
  longest: number
  runs: number
  strength: number
  sets: number
  load: number
}

/** Wochensummen für die letzten n Wochen bis einschließlich der Woche von `date` */
export function weeklyStats(acts: Activity[], date: ISODate, n: number): WeekStat[] {
  const lastMon = mondayOf(date)
  const out: WeekStat[] = []
  for (let i = n - 1; i >= 0; i--) {
    const start = addDays(lastMon, -7 * i)
    const end = addDays(start, 6)
    const wk = inRange(acts, start, end)
    const runs = runLike(wk)
    const str = wk.filter(isStrength)
    out.push({
      start,
      km: runs.reduce((s, r) => s + r.km, 0),
      sec: runs.reduce((s, r) => s + r.sec, 0),
      longest: runs.reduce((m, r) => Math.max(m, r.km), 0),
      runs: runs.length,
      strength: str.length,
      sets: str.reduce((s, a) => s + countSets(a), 0),
      load: str.reduce((s, a) => s + sessionLoad(a), 0),
    })
  }
  return out
}

export function countSets(a: StrengthActivity): number {
  return a.exercises.reduce((s, e) => s + e.sets.length, 0)
}

export function sessionLoad(a: StrengthActivity): number {
  return a.exercises.reduce((s, e) => s + e.sets.reduce((t, x) => t + x.reps * x.kg, 0), 0)
}

export function setsByMuscle(acts: StrengthActivity[]): Record<Muscle, number> {
  const out = Object.fromEntries(MUSCLES.map((m) => [m.id, 0])) as Record<Muscle, number>
  for (const a of acts) for (const e of a.exercises) out[e.muscle] = (out[e.muscle] ?? 0) + e.sets.length
  return out
}

export function loadByMuscle(acts: StrengthActivity[]): Record<Muscle, number> {
  const out = Object.fromEntries(MUSCLES.map((m) => [m.id, 0])) as Record<Muscle, number>
  for (const a of acts)
    for (const e of a.exercises) out[e.muscle] = (out[e.muscle] ?? 0) + e.sets.reduce((t, x) => t + x.reps * x.kg, 0)
  return out
}

/** Aktive Tage je Datum: 0 = nichts, 1–4 = Intensität (für die Kalender-Heatmap) */
export function activityLevels(acts: Activity[], kind: 'run' | 'strength'): Map<ISODate, number> {
  const m = new Map<ISODate, number>()
  if (kind === 'run') {
    for (const r of runLike(acts)) m.set(r.date, (m.get(r.date) ?? 0) + r.km)
    for (const [d, km] of m) m.set(d, km >= 16 ? 4 : km >= 10 ? 3 : km >= 6 ? 2 : 1)
  } else {
    for (const a of acts.filter(isStrength)) m.set(a.date, (m.get(a.date) ?? 0) + countSets(a))
    for (const [d, s] of m) m.set(d, s >= 20 ? 4 : s >= 15 ? 3 : s >= 8 ? 2 : 1)
  }
  return m
}

/** Längste Serie aufeinanderfolgender Wochen mit mindestens einer Einheit, endend in der aktuellen Woche */
export function weekStreak(acts: Activity[], date: ISODate, kind: 'run' | 'strength'): number {
  const filtered: { date: ISODate }[] = kind === 'run' ? runLike(acts) : acts.filter(isStrength)
  const weeks = new Set(filtered.map((a) => mondayOf(a.date)))
  let n = 0
  let w = mondayOf(date)
  if (!weeks.has(w)) w = addDays(w, -7)
  while (weeks.has(w)) {
    n++
    w = addDays(w, -7)
  }
  return n
}

export function activeDays(acts: Activity[], from: ISODate, to: ISODate, kind: 'run' | 'strength'): number {
  const dates: { date: ISODate }[] = kind === 'run' ? runLike(acts) : acts.filter(isStrength)
  return new Set(inRange(dates, from, to).map((a) => a.date)).size
}

/** Bester Monat nach Kilometern bzw. Sätzen */
export function bestMonth(acts: Activity[], kind: 'run' | 'strength'): string | null {
  const m = new Map<string, number>()
  if (kind === 'run') for (const r of runLike(acts)) m.set(r.date.slice(0, 7), (m.get(r.date.slice(0, 7)) ?? 0) + r.km)
  else for (const a of acts.filter(isStrength)) m.set(a.date.slice(0, 7), (m.get(a.date.slice(0, 7)) ?? 0) + countSets(a))
  let best: string | null = null
  let v = 0
  for (const [k, x] of m) if (x > v) { v = x; best = k }
  return best
}

// ---------- Leistung ----------

export interface BestEffort {
  km: number
  name: string
  sec: number
  date: ISODate
}

/** Bestzeiten: Tests und Rennen, deren Distanz zur Standarddistanz passt (±3 %) */
export function bestEfforts(acts: Activity[]): (BestEffort | { km: number; name: string; sec: null })[] {
  // nur Tests und Rennen: ein lockerer 10-km-Lauf ist keine Bestzeit
  const runs = runLike(acts).filter((r) => r.runType === 'test' || r.runType === 'rennen')
  return STANDARD_DISTANCES.map((d) => {
    const cands = runs.filter((r) => Math.abs(r.km - d.km) / d.km <= 0.03 && r.sec > 0)
    if (!cands.length) return { km: d.km, name: d.name, sec: null }
    // auf die Standarddistanz normiert
    const best = cands
      .map((r) => ({ date: r.date, sec: riegel(r.sec, r.km, d.km) }))
      .sort((a, b) => a.sec - b.sec)[0]
    return { km: d.km, name: d.name, sec: best.sec, date: best.date }
  })
}

/** Aktuelle VDOT: letzter Test, sonst beste Rennleistung der letzten 12 Wochen */
export function currentVdot(acts: Activity[], date: ISODate): { vdot: number; date: ISODate; label: string } | null {
  const tests = byDateDesc(acts.filter(isTest)).filter((t) => t.date <= date)
  if (tests.length) {
    const t = tests[0]
    return { vdot: t.vdot, date: t.date, label: `${fmtTestDist(t.distanceKm)} · ${secToClock(t.durationSec)}` }
  }
  const races = acts.filter(isRun).filter((r) => r.runType === 'rennen' && diffDays(date, r.date) <= 84)
  if (!races.length) return null
  const best = races
    .map((r) => ({ r, v: calcVdot(r.distanceKm, r.durationSec) }))
    .sort((a, b) => b.v - a.v)[0]
  return { vdot: best.v, date: best.r.date, label: `Rennen · ${secToClock(best.r.durationSec)}` }
}

function fmtTestDist(km: number): string {
  if (Math.abs(km - 21.0975) < 0.1) return 'HM'
  if (Math.abs(km - 42.195) < 0.1) return 'Marathon'
  return `${String(Math.round(km * 10) / 10).replace('.', ',')} km`
}

function secToClock(sec: number): string {
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${p(m)}:${p(r)}` : `${m}:${p(r)}`
}

/**
 * Aussagekräftige Pace eines Laufs (s/km): bei Schwelle die Pace des Hauptteils,
 * bei Intervallen das Ø-Tempo der Intervalle, sonst Gesamtdauer / Distanz.
 */
export function effectivePace(r: RunActivity): number | null {
  if (r.runType === 'schwelle' && r.main?.paceSec) return r.main.paceSec
  if (r.runType === 'intervall' && r.intervals?.length) return 3600 / (r.intervals.reduce((s, i) => s + i.kmh, 0) / r.intervals.length)
  return r.distanceKm > 0 && r.durationSec > 0 ? r.durationSec / r.distanceKm : null
}

/** Puls passend zu effectivePace */
export function effectiveHr(r: RunActivity): number | undefined {
  if (r.runType === 'schwelle' && r.main?.hr) return r.main.hr
  const hrs = r.intervals?.map((i) => i.hr).filter((x): x is number => !!x)
  if (r.runType === 'intervall' && hrs?.length) return Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length)
  return r.avgHr
}

/** Durchschnittspace (s/km) eines Lauftyps in einem Zeitraum */
export function avgPace(acts: Activity[], types: RunType[], from: ISODate, to: ISODate): number | null {
  const ps = inRange(acts.filter(isRun), from, to)
    .filter((r) => types.includes(r.runType))
    .map(effectivePace)
    .filter((p): p is number => p !== null)
  return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : null
}

/** Pace-Verlauf eines Lauftyps, ein Wert pro Woche (null = keine Einheit) */
export function paceSeries(acts: Activity[], types: RunType[], date: ISODate, weeks: number): (number | null)[] {
  const lastMon = mondayOf(date)
  const out: (number | null)[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const s = addDays(lastMon, -7 * i)
    out.push(avgPace(acts, types, s, addDays(s, 6)))
  }
  return out
}

/** Intensitätsverteilung nach Kilometern */
export function intensity(acts: Activity[], from: ISODate, to: ISODate) {
  const rs = inRange(runLike(acts), from, to)
  const km = (t: RunType[]) => rs.filter((r) => t.includes(r.runType)).reduce((s, r) => s + r.km, 0)
  const easy = km(['easy'])
  const long = km(['long'])
  const thr = km(['schwelle'])
  const intv = km(['intervall', 'test', 'rennen'])
  const total = easy + long + thr + intv
  return { easy, long, thr, intv, total }
}

// ---------- Kraft ----------

export interface LastExercise {
  date: ISODate
  sets: { reps: number; kg: number; rir?: number }[]
}

/** Letzte Ausführung einer Übung vor einem Datum (auch unter anderem Namen, z. B. aus Hevy) */
export function lastExercise(acts: Activity[], name: string, before: ISODate, aliases: string[] = []): (LastExercise & { name: string }) | null {
  const names = [name, ...aliases]
  const ss = byDateDesc(acts.filter(isStrength)).filter((a) => a.date < before)
  for (const a of ss) {
    const e = a.exercises.find((x) => names.includes(x.name))
    if (e && e.sets.length) return { date: a.date, sets: e.sets, name: e.name }
  }
  return null
}

export function topSet(sets: { reps: number; kg: number }[]): { reps: number; kg: number } | null {
  if (!sets.length) return null
  return [...sets].sort((a, b) => b.kg - a.kg || b.reps - a.reps)[0]
}

/** Geschätztes 1RM (Epley) */
export function e1rm(kg: number, reps: number): number {
  return reps <= 1 ? kg : kg * (1 + reps / 30)
}

/**
 * Bestleistungen je Übung (Satz mit dem höchsten geschätzten 1RM).
 * Mit `groups` werden Namen zusammengefasst (Planübung + Hevy-Namen) und in dieser Reihenfolge geliefert.
 */
export function strengthPRs(acts: Activity[], groups?: { name: string; aliases?: string[] }[]) {
  const best = new Map<string, { name: string; via: string; kg: number; reps: number; date: ISODate; score: number }>()
  const keyOf = (n: string) => (groups ? groups.find((g) => g.name === n || g.aliases?.includes(n))?.name : n)
  for (const a of acts.filter(isStrength))
    for (const e of a.exercises) {
      const key = keyOf(e.name)
      if (!key) continue
      for (const s of e.sets) {
        if (s.kg <= 0) continue
        const score = e1rm(s.kg, s.reps)
        const cur = best.get(key)
        if (!cur || score > cur.score) best.set(key, { name: key, via: e.name, kg: s.kg, reps: s.reps, date: a.date, score })
      }
    }
  if (groups) return groups.map((g) => best.get(g.name)).filter((x): x is NonNullable<typeof x> => !!x)
  return [...best.values()].sort((a, b) => b.score - a.score)
}
