// Datenmodell von Form. Alles, was gespeichert oder mit Claude ausgetauscht wird.

export type ISODate = string // 'YYYY-MM-DD' in lokaler Zeit
export type Weekday = 'mo' | 'di' | 'mi' | 'do' | 'fr' | 'sa' | 'so'
export const WEEKDAYS: Weekday[] = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so']

export type RunType = 'easy' | 'intervall' | 'schwelle' | 'long' | 'test' | 'rennen'
export type Muscle = 'ruecken' | 'seitl_schulter' | 'hintere_schulter' | 'vordere_schulter' | 'bauch' | 'brust' | 'beine' | 'arme'

export const MUSCLES: { id: Muscle; name: string }[] = [
  { id: 'beine', name: 'Beine' },
  { id: 'ruecken', name: 'Rücken' },
  { id: 'seitl_schulter', name: 'Seitliche Schulter' },
  { id: 'hintere_schulter', name: 'Hintere Schulter' },
  { id: 'vordere_schulter', name: 'Vordere Schulter' },
  { id: 'bauch', name: 'Bauch' },
  { id: 'brust', name: 'Brust' },
  { id: 'arme', name: 'Arme' },
]

export const RUN_TYPES: { id: RunType; name: string }[] = [
  { id: 'easy', name: 'Easy' },
  { id: 'intervall', name: 'Intervall' },
  { id: 'schwelle', name: 'Schwelle' },
  { id: 'long', name: 'Long Run' },
  { id: 'test', name: 'Test' },
  { id: 'rennen', name: 'Rennen' },
]

// ---------- Plan ----------

export interface Step {
  name: string
  detail?: string
  value: string
  key?: boolean // Hauptteil, wird hervorgehoben
}

export interface PlannedSession {
  day: Weekday
  kind: 'run' | 'bike' | 'strength'
  title: string
  runType?: RunType
  km?: number
  durationMin?: number
  description?: string
  steps?: Step[]
  workoutId?: string // bei kind = 'strength'
  setsFactor?: number // z. B. 0.6 in Deload-Wochen
  setsOverride?: number // z. B. 2 Sätze je Übung in Rennwochen
  time?: 'morgens' | 'vormittags' | 'abends'
  note?: string
}

export interface PlanWeek {
  start: ISODate // Montag
  phaseId: string
  label?: string // z. B. "Deload", "Testwoche"
  deload?: boolean
  targetKm: number
  estimated?: boolean // aus den Phasen abgeleitet, nicht wörtlich aus dem Plan
  sessions: PlannedSession[]
}

export interface Phase {
  id: string
  name: string
  from: ISODate
  to: ISODate
  focus: string
  volumePct?: number
  tip?: string
}

export interface Race {
  id: string
  name: string
  priority: 'A' | 'B'
  date: ISODate
  distanceKm: number
  goal: string // Anzeige, z. B. "unter 1:45:00"
  goalSec: number
  note?: string
}

export interface ExerciseTemplate {
  name: string
  muscle: Muscle
  sets: number
  setsMax?: number
  reps: string
  rir: string
  optional?: boolean
  note?: string
  aliases?: string[] // andere Namen derselben Übung, z. B. aus Hevy
}

export interface StrengthWorkout {
  id: string
  name: string
  day: string
  note?: string
  exercises: ExerciseTemplate[]
}

export interface MuscleTarget {
  muscle: Muscle
  sets: number
  min: number
  max: number
  priority: string
  rir?: string
}

export type RuleTrigger =
  | 'general'
  | 'double_day'
  | 'bike_day'
  | 'after_long_run'
  | 'deload_week'
  | 'test_week'
  | 'race_week'
  | 'strength_day'
  | 'leg_day'

export interface Rule {
  id: string
  title: string
  text: string
  trigger: RuleTrigger
}

export interface Plan {
  format: 'form-plan'
  version: 1
  name: string
  updated: ISODate
  source?: string
  races: Race[]
  hr: { easy: [number, number]; threshold: [number, number]; intervalMax: number }
  phases: Phase[]
  strengthPhases: Phase[]
  weeks: PlanWeek[]
  workouts: StrengthWorkout[]
  muscleTargets: MuscleTarget[]
  rules: Rule[]
  nutrition?: { area: string; value: string }[]
  checkpoints?: string
}

// ---------- Erfasste Einheiten ----------

export interface SetEntry {
  reps: number
  kg: number
  rir?: number
}

export interface ExerciseEntry {
  name: string
  muscle: Muscle
  sets: SetEntry[]
}

interface BaseActivity {
  id: string
  date: ISODate
  createdAt: number
  note?: string
  planned?: string // Titel der zugeordneten geplanten Einheit
}

export interface IntervalRep {
  kmh: number
  hr?: number
}

export interface RunActivity extends BaseActivity {
  kind: 'run'
  runType: RunType
  title?: string // z. B. "4 × 4 Min"
  distanceKm: number // 0 = unbekannt
  durationSec: number // 0 = unbekannt
  avgHr?: number
  effort?: number // 1–5
  rpe?: number // 1–10
  shoeId?: string
  source?: 'manuell' | 'gpx' | 'tcx' | 'csv'
  setting?: 'draussen' | 'laufband'
  strides?: boolean
  last3Hr?: number // Ø Puls der letzten 3 km (Long Run)
  maxHr?: number
  main?: { minutes?: number; paceSec?: number; hr?: number } // Hauptteil, z. B. Schwellenblock
  intervals?: IntervalRep[]
  pain?: number // 0–10
  painNote?: string
}

export interface BikeActivity extends BaseActivity {
  kind: 'bike'
  durationSec: number
  avgHr?: number
}

export interface StrengthActivity extends BaseActivity {
  kind: 'strength'
  workoutId?: string
  title: string
  durationMin: number
  exercises: ExerciseEntry[]
  source?: 'hevy'
}

export interface TestActivity extends BaseActivity {
  kind: 'test'
  distanceKm: number
  durationSec: number
  vdot: number
  maxHr?: number
  setting?: 'draussen' | 'laufband'
}

export type Activity = RunActivity | BikeActivity | StrengthActivity | TestActivity

export interface Shoe {
  id: string
  name: string
  since: ISODate
  maxKm: number
  startKm: number
  retired?: boolean
}

export interface Settings {
  maxHr?: number
  lastBackup?: number
}
