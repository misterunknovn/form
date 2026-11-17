// Auswertung des Plans: Woche, Phase und Einheiten zu einem Datum, Regel-Hinweise.

import type { ISODate, Phase, Plan, PlannedSession, PlanWeek, Rule, StrengthWorkout } from '../data/types'
import { addDays, dateForWeekday, diffDays, mondayOf, weekdayOf } from './dates'

export function weekFor(plan: Plan, date: ISODate): PlanWeek | undefined {
  const mon = mondayOf(date)
  return plan.weeks.find((w) => w.start === mon)
}

export function weekIndex(plan: Plan, date: ISODate): number {
  const mon = mondayOf(date)
  return plan.weeks.findIndex((w) => w.start === mon)
}

export function phaseFor(phases: Phase[], date: ISODate): Phase | undefined {
  return phases.find((p) => date >= p.from && date <= p.to)
}

export function sessionsOn(plan: Plan, date: ISODate): PlannedSession[] {
  const w = weekFor(plan, date)
  if (!w) return []
  const d = weekdayOf(date)
  return w.sessions.filter((s) => s.day === d)
}

export function workoutById(plan: Plan, id?: string): StrengthWorkout | undefined {
  return plan.workouts.find((w) => w.id === id)
}

/** Sätze je Übung unter Berücksichtigung von Deload und Rennwoche */
export function plannedSets(base: number, s?: PlannedSession): number {
  if (s?.setsOverride) return Math.min(base, s.setsOverride)
  if (s?.setsFactor) return Math.max(1, Math.round(base * s.setsFactor))
  return base
}

/** Geplante harte Sätze einer Krafteinheit (ohne optionale Übungen) */
export function plannedSetsTotal(plan: Plan, s: PlannedSession): number {
  const wo = workoutById(plan, s.workoutId)
  if (!wo) return 0
  return wo.exercises.filter((e) => !e.optional).reduce((n, e) => n + plannedSets(e.sets, s), 0)
}

export function weekRunKm(w: PlanWeek): number {
  return w.sessions.filter((s) => s.kind === 'run').reduce((n, s) => n + (s.km ?? 0), 0)
}

export function weekStrengthSets(plan: Plan, w: PlanWeek): number {
  return w.sessions.filter((s) => s.kind === 'strength').reduce((n, s) => n + plannedSetsTotal(plan, s), 0)
}

export function nextRace(plan: Plan, date: ISODate) {
  return [...plan.races].sort((a, b) => a.date.localeCompare(b.date)).find((r) => r.date >= date)
}

export function aRace(plan: Plan) {
  return plan.races.find((r) => r.priority === 'A') ?? plan.races[plan.races.length - 1]
}

/** Regeln, die an diesem Tag gelten */
export function rulesFor(plan: Plan, date: ISODate): Rule[] {
  const w = weekFor(plan, date)
  const today = sessionsOn(plan, date)
  const hasRun = today.some((s) => s.kind === 'run')
  const hasStrength = today.some((s) => s.kind === 'strength')
  const hasLegs = today.some((s) => s.kind === 'strength' && (s.workoutId === 'uk-a' || s.workoutId === 'uk-b'))
  const hasRowing = today.some((s) => s.kind === 'strength' && s.workoutId === 'ok-a')
  const yesterday = sessionsOn(plan, addDays(date, -1))
  const afterLong = hasRowing && yesterday.some((s) => s.runType === 'long')
  const label = (w?.label ?? '').toLowerCase()
  const isTestWeek = !!w?.sessions.some((s) => s.runType === 'test')
  const isRaceWeek = !!w?.sessions.some((s) => s.runType === 'rennen')

  const active = new Set<string>()
  if (hasRun && hasStrength) active.add('double_day')
  if (today.some((s) => s.kind === 'bike')) active.add('bike_day')
  if (afterLong) active.add('after_long_run')
  if (w?.deload || label.includes('deload')) active.add('deload_week')
  if (isTestWeek) active.add('test_week')
  if (isRaceWeek) active.add('race_week')
  if (hasStrength) active.add('strength_day')
  if (hasLegs) active.add('leg_day')
  return plan.rules.filter((r) => active.has(r.trigger))
}

/** Datum der geplanten Einheit innerhalb ihrer Woche */
export function sessionDate(w: PlanWeek, s: PlannedSession): ISODate {
  return dateForWeekday(w.start, s.day)
}

export function planProgress(plan: Plan, date: ISODate) {
  const first = plan.weeks[0]?.start
  const last = plan.weeks[plan.weeks.length - 1]?.start
  if (!first || !last) return { idx: -1, total: 0, pct: 0 }
  const total = plan.weeks.length
  const idx = Math.min(total - 1, Math.max(-1, Math.floor(diffDays(mondayOf(date), first) / 7)))
  return { idx, total, pct: Math.max(0, Math.min(1, (idx + 1) / total)) }
}
