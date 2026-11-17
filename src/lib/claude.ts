// Austausch mit Claude per Kopieren und Einfügen: Zusammenfassung exportieren,
// angepassten Plan als JSON wieder importieren.

import type { Activity, Plan, PlannedSession, Settings } from '../data/types'
import { WEEKDAYS } from '../data/types'
import { addDays, fmtDayShort, mondayOf } from './dates'
import { fmtDuration, fmtKm, fmtPace } from './format'
import { rulesFor, weekFor } from './plan'
import { byDateDesc, countSets, currentVdot, weeklyStats } from './stats'

const RUN_NAMES: Record<string, string> = {
  easy: 'Easy', intervall: 'Intervall', schwelle: 'Schwelle', long: 'Long Run', test: 'Test', rennen: 'Rennen',
}

function describeActivity(a: Activity): string {
  const d = fmtDayShort(a.date)
  const planned = a.planned ? ` (geplant: ${a.planned})` : ''
  const note = a.note ? ` – Notiz: ${a.note}` : ''
  switch (a.kind) {
    case 'run': {
      const pace = a.distanceKm > 0 ? fmtPace(a.durationSec / a.distanceKm) : '–'
      const hr = a.avgHr ? `, Ø ${a.avgHr} bpm` : ''
      const eff = a.effort ? `, Anstrengung ${a.effort}/5` : ''
      return `- ${d}: Lauf ${RUN_NAMES[a.runType]}${a.title ? ' ' + a.title : ''}, ${fmtKm(a.distanceKm)} km in ${fmtDuration(a.durationSec)} (${pace} /km${hr}${eff})${planned}${note}`
    }
    case 'bike':
      return `- ${d}: Rad ${Math.round(a.durationSec / 60)} Min${a.avgHr ? `, Ø ${a.avgHr} bpm` : ''}${note}`
    case 'test':
      return `- ${d}: Leistungstest ${fmtKm(a.distanceKm)} km in ${fmtDuration(a.durationSec)} → VDOT ${a.vdot.toFixed(1)}${note}`
    case 'strength': {
      const ex = a.exercises
        .map((e) => `${e.name}: ${e.sets.map((s) => `${s.reps}×${s.kg}kg${s.rir !== undefined ? ` RIR${s.rir}` : ''}`).join(', ')}`)
        .join('; ')
      return `- ${d}: Kraft ${a.title}, ${a.durationMin} Min, ${countSets(a)} Sätze${planned}. ${ex}${note}`
    }
  }
}

function describePlanned(s: PlannedSession): string {
  const parts = [s.title]
  if (s.km) parts.push(`${fmtKm(s.km)} km`)
  if (s.description) parts.push(s.description)
  return parts.join(' · ')
}

export function buildClaudeExport(plan: Plan, acts: Activity[], settings: Settings, date: string, question: string): string {
  const from = addDays(mondayOf(date), -42)
  const recent = byDateDesc(acts).filter((a) => a.date >= from && a.date <= date).reverse()
  const weeks = weeklyStats(acts, date, 6)
  const v = currentVdot(acts, date)
  const thisWeek = weekFor(plan, date)
  const nextWeek = weekFor(plan, addDays(date, 7))
  const rules = rulesFor(plan, date)

  const lines: string[] = []
  lines.push('# Trainingsdaten aus der App „Form“')
  lines.push('')
  lines.push(`Heute ist ${fmtDayShort(date)} (${date}). Mein Plan: „${plan.name}“, zuletzt geändert am ${plan.updated}.`)
  for (const r of plan.races) lines.push(`- ${r.name}: ${r.date}, ${fmtKm(r.distanceKm)} km, Ziel ${r.goal}`)
  if (v) lines.push(`Aktuelle VDOT: ${v.vdot.toFixed(1)} (${v.label}, ${v.date})`)
  if (settings.maxHr) lines.push(`Max. Puls: ${settings.maxHr} bpm`)
  lines.push('')
  lines.push('## Wochensummen (letzte 6 Wochen)')
  for (const w of weeks) {
    const pw = weekFor(plan, w.start)
    lines.push(`- Woche ab ${w.start}: ${fmtKm(w.km)} km${pw ? ` (Plan ${pw.targetKm} km)` : ''}, ${w.runs} Läufe, längster ${fmtKm(w.longest)} km, ${w.strength} Krafteinheiten mit ${w.sets} Sätzen`)
  }
  lines.push('')
  lines.push('## Einheiten (letzte 6 Wochen)')
  if (!recent.length) lines.push('- Noch keine Einheiten erfasst.')
  for (const a of recent) lines.push(describeActivity(a))
  lines.push('')
  if (thisWeek) {
    lines.push(`## Plan diese Woche (ab ${thisWeek.start}${thisWeek.label ? ', ' + thisWeek.label : ''}, Ziel ${thisWeek.targetKm} km)`)
    for (const d of WEEKDAYS) for (const s of thisWeek.sessions.filter((x) => x.day === d)) lines.push(`- ${d.toUpperCase()}: ${describePlanned(s)}`)
    lines.push('')
  }
  if (nextWeek) {
    lines.push(`## Plan nächste Woche (ab ${nextWeek.start}${nextWeek.label ? ', ' + nextWeek.label : ''}, Ziel ${nextWeek.targetKm} km)`)
    for (const d of WEEKDAYS) for (const s of nextWeek.sessions.filter((x) => x.day === d)) lines.push(`- ${d.toUpperCase()}: ${describePlanned(s)}`)
    lines.push('')
  }
  if (rules.length) {
    lines.push('## Regeln, die heute gelten')
    for (const r of rules) lines.push(`- ${r.title}: ${r.text}`)
    lines.push('')
  }
  lines.push('## Meine Frage')
  lines.push(question.trim() || 'Bitte analysiere meine letzten Einheiten im Vergleich zum Plan. Passe die kommenden Wochen an, wenn es nötig ist.')
  lines.push('')
  lines.push('## So antwortest du')
  lines.push(
    'Erkläre kurz auf Deutsch, was dir auffällt und was du änderst. Wenn du den Plan änderst, gib am Ende den vollständigen, geänderten Plan als einen einzigen ```json-Codeblock im unten stehenden Format zurück (format "form-plan", version 1). Ändere nur, was nötig ist, behalte alle Felder und die Struktur bei, setze "updated" auf das heutige Datum. Halte dich an die Regeln des Plans; steigere den Wochenumfang um höchstens ca. 10 % und plane nach drei Belastungswochen eine Deload-Woche. Wochentage: mo, di, mi, do, fr, sa, so. kind: run | bike | strength. runType: easy | intervall | schwelle | long | test | rennen. workoutId verweist auf "workouts". setsFactor (z. B. 0.6) kürzt Sätze, setsOverride legt Sätze je Übung fest.',
  )
  lines.push('')
  lines.push('## Aktueller Plan (JSON)')
  lines.push('```json')
  lines.push(JSON.stringify(plan))
  lines.push('```')
  return lines.join('\n')
}

// ---------- Import ----------

/** JSON aus einer Antwort von Claude herauslösen (Codeblock oder reines JSON) */
export function extractJson(text: string): unknown {
  const blocks = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1])
  const candidates = blocks.length ? blocks.reverse() : [text]
  let lastErr: unknown = null
  for (const c of candidates) {
    const t = c.trim()
    const start = t.indexOf('{')
    const end = t.lastIndexOf('}')
    if (start < 0 || end < start) continue
    try {
      return JSON.parse(t.slice(start, end + 1))
    } catch (e) {
      lastErr = e
    }
  }
  throw new Error(lastErr ? 'Das JSON ist unvollständig oder fehlerhaft. Bitte die komplette Antwort einfügen.' : 'Kein JSON gefunden. Bitte die Antwort von Claude mit dem ```json-Block einfügen.')
}

const isDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

/** Prüft einen Plan und gibt eine Liste von Problemen zurück (leer = gültig) */
export function validatePlan(p: unknown): string[] {
  const errs: string[] = []
  const plan = p as Plan
  if (!plan || typeof plan !== 'object') return ['Kein Plan-Objekt.']
  if (plan.format !== 'form-plan') errs.push('„format“ muss "form-plan" sein.')
  if (plan.version !== 1) errs.push('„version“ muss 1 sein.')
  if (!plan.name) errs.push('„name“ fehlt.')
  if (!Array.isArray(plan.races)) errs.push('„races“ fehlt.')
  if (!Array.isArray(plan.weeks) || !plan.weeks.length) errs.push('„weeks“ fehlt oder ist leer.')
  if (!Array.isArray(plan.workouts)) errs.push('„workouts“ fehlt.')
  if (!Array.isArray(plan.phases)) errs.push('„phases“ fehlt.')
  if (!Array.isArray(plan.rules)) errs.push('„rules“ fehlt.')
  if (!plan.hr) errs.push('„hr“ fehlt.')
  const ids = new Set((plan.workouts ?? []).map((w) => w.id))
  ;(plan.weeks ?? []).forEach((w, i) => {
    if (!isDate(w.start)) errs.push(`Woche ${i + 1}: „start“ ist kein Datum.`)
    if (!Array.isArray(w.sessions)) errs.push(`Woche ${i + 1}: „sessions“ fehlt.`)
    for (const s of w.sessions ?? []) {
      if (!WEEKDAYS.includes(s.day)) errs.push(`Woche ${w.start}: unbekannter Tag „${s.day}“.`)
      if (!['run', 'bike', 'strength'].includes(s.kind)) errs.push(`Woche ${w.start}: unbekannte Art „${s.kind}“.`)
      if (s.kind === 'strength' && !ids.has(s.workoutId ?? '')) errs.push(`Woche ${w.start}: Krafteinheit „${s.workoutId}“ gibt es nicht.`)
    }
  })
  return errs.slice(0, 8)
}

export interface PlanDiff {
  weeksChanged: string[]
  weeksAdded: number
  weeksRemoved: number
  workoutsChanged: string[]
  racesChanged: boolean
  rulesChanged: boolean
}

export function diffPlans(a: Plan, b: Plan): PlanDiff {
  const am = new Map(a.weeks.map((w) => [w.start, JSON.stringify(w)]))
  const bm = new Map(b.weeks.map((w) => [w.start, JSON.stringify(w)]))
  const weeksChanged = b.weeks.filter((w) => am.has(w.start) && am.get(w.start) !== bm.get(w.start)).map((w) => w.start)
  const wa = new Map(a.workouts.map((w) => [w.id, JSON.stringify(w)]))
  return {
    weeksChanged,
    weeksAdded: b.weeks.filter((w) => !am.has(w.start)).length,
    weeksRemoved: a.weeks.filter((w) => !bm.has(w.start)).length,
    workoutsChanged: b.workouts.filter((w) => wa.get(w.id) !== JSON.stringify(w)).map((w) => w.name),
    racesChanged: JSON.stringify(a.races) !== JSON.stringify(b.races),
    rulesChanged: JSON.stringify(a.rules) !== JSON.stringify(b.rules),
  }
}
