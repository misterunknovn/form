// Startplan: "Trainingsplan Halbmarathon 2027" (Stand 17.11.2026, von Claude erstellt).
// Wochen bis zum 5-km-Test (04.01.) sind wörtlich aus dem Plan übernommen.
// Ab dem 11.01. nennt der Plan nur Phasen; die Wochen dort sind daraus abgeleitet
// (estimated: true) und werden mit Claude verfeinert.

import type { Plan, PlannedSession, PlanWeek, StrengthWorkout } from './types'

const EASY_HR = 'HF 134–147'

function intervalSession(reps: number, min: number): PlannedSession {
  const km = reps === 3 && min === 3 ? 7 : reps >= 4 ? 8.5 : 7.5
  return {
    day: 'di',
    kind: 'run',
    runType: 'intervall',
    title: 'Intervalle',
    km,
    durationMin: 15 + reps * min + (reps - 1) * 2 + 10,
    description: `${reps} × ${min} Min, 13,0–13,5 km/h, 1 % Steigung, HF max. 178.`,
    steps: [
      { name: 'Einlaufen', detail: `Locker · ${EASY_HR}`, value: '15 Min' },
      { name: `${reps} × ${min} Min`, detail: '13,0–13,5 km/h · 1 % · HF max. 178', value: `${reps} × ${min}:00`, key: true },
      { name: 'Trabpause', detail: 'Locker traben', value: `${reps - 1} × 2 Min` },
      { name: 'Auslaufen', detail: 'Locker', value: '10 Min' },
    ],
  }
}

function thresholdSession(reps: number, min: number, day: PlannedSession['day'] = 'fr'): PlannedSession {
  const total = reps * min
  return {
    day,
    kind: 'run',
    runType: 'schwelle',
    title: 'Schwelle',
    km: Math.round((4 + total / 4.8) * 2) / 2,
    durationMin: 15 + total + (reps - 1) * 3 + 10,
    time: 'vormittags',
    description: `${reps} × ${min} Min an der Schwelle (HF 158–164).`,
    steps: [
      { name: 'Einlaufen', detail: `Locker · ${EASY_HR}`, value: '15 Min' },
      { name: `${reps} × ${min} Min`, detail: 'Schwelle · HF 158–164', value: `${reps} × ${min}:00`, key: true },
      { name: 'Trabpause', detail: 'Locker traben', value: `${reps - 1} × 3 Min` },
      { name: 'Auslaufen', detail: 'Locker', value: '10 Min' },
    ],
  }
}

function longRun(km: number, description?: string): PlannedSession {
  return {
    day: 'so',
    kind: 'run',
    runType: 'long',
    title: 'Long Run',
    km,
    durationMin: Math.round(km * 6.1),
    description: description ?? `${String(km).replace('.', ',')} km in der Easy-Zone (${EASY_HR}).`,
  }
}

function easyRun(km: number, day: PlannedSession['day'] = 'mo', extra?: string): PlannedSession {
  return {
    day,
    kind: 'run',
    runType: 'easy',
    title: 'Easy Run',
    km,
    durationMin: Math.round(km * 6.1),
    description: `Locker, ${EASY_HR}.${extra ? ' ' + extra : ' Strides können bleiben.'}`,
  }
}

const bike: PlannedSession = {
  day: 'do',
  kind: 'bike',
  title: 'Rad locker',
  durationMin: 40,
  description: '30–45 Min locker. Zählt nicht in die Wochenkilometer. Bei Fersenschmerz pausieren.',
}

function strength(day: PlannedSession['day'], workoutId: string, title: string, opts: Partial<PlannedSession> = {}): PlannedSession {
  return { day, kind: 'strength', workoutId, title, ...opts }
}

interface WeekSpec {
  start: string
  phaseId: string
  targetKm: number
  label?: string
  deload?: boolean
  estimated?: boolean
  intervals?: [number, number] | null
  threshold?: [number, number] | null
  long?: number | null
  longText?: string
  extra?: PlannedSession[]
  strengthMode?: 'normal' | 'deload' | 'test' | 'race' | 'race-prep'
  skipBike?: boolean
  easyKm?: number
}

function buildWeek(w: WeekSpec): PlanWeek {
  const sessions: PlannedSession[] = []
  const quality: PlannedSession[] = []
  if (w.intervals) quality.push(intervalSession(...w.intervals))
  if (w.threshold) quality.push(thresholdSession(...w.threshold))
  if (w.long) quality.push(longRun(w.long, w.longText))
  for (const e of w.extra ?? []) if (e.kind === 'run') quality.push(e)
  const used = quality.reduce((s, q) => s + (q.km ?? 0), 0)
  const easyKm = w.easyKm ?? Math.max(5, Math.round(w.targetKm - used))
  sessions.push(easyRun(easyKm))
  sessions.push(...quality)
  if (!w.skipBike) sessions.push(bike)
  for (const e of w.extra ?? []) if (e.kind !== 'run') sessions.push(e)

  const mode = w.strengthMode ?? (w.deload ? 'deload' : 'normal')
  const f = mode === 'deload' ? { setsFactor: 0.6, note: 'Deload: Sätze um ca. 40 % kürzen, Last halten.' } : {}
  sessions.push(strength('mo', 'ok-a', 'Oberkörper A', { note: 'Nach dem Lauf. Rudern 5–10 % leichter nach dem Long Run.', ...f }))
  if (mode === 'race') {
    sessions.push(strength('do', 'ok-b', 'Oberkörper B', { setsOverride: 2, note: 'Rennwoche: 2 Sätze je Übung.' }))
  } else {
    sessions.push(
      strength('mi', 'uk-a', 'Unterkörper A', {
        ...f,
        note: mode === 'test' ? 'Testwoche: keine neuen Maximalgewichte.' : f.note,
      }),
    )
    sessions.push(strength('do', 'ok-b', 'Oberkörper B', f))
    if (mode !== 'test') sessions.push(strength('fr', 'uk-b', 'Unterkörper B', { time: 'abends', ...f }))
  }
  const order = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so']
  sessions.sort((a, b) => order.indexOf(a.day) - order.indexOf(b.day) || (a.kind === 'strength' ? 1 : 0) - (b.kind === 'strength' ? 1 : 0))
  return {
    start: w.start,
    phaseId: w.phaseId,
    label: w.label,
    deload: w.deload,
    targetKm: w.targetKm,
    estimated: w.estimated,
    sessions,
  }
}

const race = (day: PlannedSession['day'], title: string, goal: string): PlannedSession => ({
  day,
  kind: 'run',
  runType: 'rennen',
  title,
  km: 21.1,
  description: goal,
})

const WEEKS: WeekSpec[] = [
  { start: '2026-11-16', phaseId: 'basis', targetKm: 32, label: 'Deload', deload: true, intervals: [3, 4], threshold: [2, 10], long: 13, longText: '12–14 km in der Easy-Zone (HF 134–147).' },
  { start: '2026-11-23', phaseId: 'basis', targetKm: 38, intervals: [4, 4], threshold: [2, 12], long: 16 },
  { start: '2026-11-30', phaseId: 'basis', targetKm: 40, intervals: [4, 4], threshold: [2, 15], long: 18 },
  { start: '2026-12-07', phaseId: 'basis', targetKm: 42, intervals: [4, 4], threshold: [2, 18], long: 19.5, longText: '19–20 km in der Easy-Zone (HF 134–147).' },
  { start: '2026-12-14', phaseId: 'basis', targetKm: 33, label: 'Deload', deload: true, intervals: [3, 4], threshold: [2, 10], long: 15 },
  { start: '2026-12-21', phaseId: 'basis', targetKm: 41, intervals: [4, 4], threshold: [2, 20], long: 18 },
  { start: '2026-12-28', phaseId: 'basis', targetKm: 40, intervals: [4, 4], threshold: [3, 12], long: 16 },
  {
    start: '2027-01-04', phaseId: 'basis', targetKm: 28, label: 'Testwoche', intervals: [3, 3], threshold: null, long: 6,
    longText: '6 km locker, einen Tag nach dem Test.', strengthMode: 'test',
    extra: [{ day: 'sa', kind: 'run', runType: 'test', title: '5-km-Test', km: 5, description: 'Laufband, 1 % Steigung. Maximaler Einsatz. Freitag davor frei.' }],
  },
  // ab hier aus den Phasen abgeleitet
  { start: '2027-01-11', phaseId: 'hm-spez', targetKm: 38, estimated: true, intervals: [4, 4], threshold: [3, 13], long: 16 },
  { start: '2027-01-18', phaseId: 'hm-spez', targetKm: 40, estimated: true, intervals: [4, 4], threshold: [2, 20], long: 17 },
  { start: '2027-01-25', phaseId: 'hm-spez', targetKm: 42, estimated: true, intervals: [4, 4], threshold: [4, 10], long: 18 },
  {
    start: '2027-02-01', phaseId: 'hm-spez', targetKm: 32, estimated: true, label: 'Deload · 10-km-Test', deload: true, intervals: [3, 4], threshold: null, long: null, strengthMode: 'test',
    extra: [{ day: 'so', kind: 'run', runType: 'test', title: '10-km-Test', km: 10, description: 'Maximaler Einsatz auf flacher Strecke. Legt die Renn-Pace fest.' }],
  },
  { start: '2027-02-08', phaseId: 'hm-spez', targetKm: 42, estimated: true, intervals: [4, 4], threshold: [3, 13], long: 19 },
  { start: '2027-02-15', phaseId: 'hm-spez', targetKm: 43, estimated: true, intervals: [4, 4], threshold: [2, 20], long: 20.5, longText: '20–21 km, längster Long Run vor dem B-Rennen.' },
  { start: '2027-02-22', phaseId: 'hm-spez', targetKm: 41, estimated: true, intervals: [4, 4], threshold: [4, 10], long: 18 },
  { start: '2027-03-01', phaseId: 'taper-b', targetKm: 35, estimated: true, intervals: [4, 4], threshold: [2, 12], long: 15, strengthMode: 'race-prep' },
  {
    start: '2027-03-08', phaseId: 'taper-b', targetKm: 39, estimated: true, label: 'Rennwoche B', intervals: [3, 3], threshold: null, long: null, strengthMode: 'race', skipBike: true,
    extra: [easyRun(6, 'fr', 'Mit 4–6 Steigerungen.'), race('so', 'B-Rennen Halbmarathon', 'Ziel 1:46:30, Pace ca. 5:03/km. Kontrolliert laufen, nicht am Limit.')],
  },
  { start: '2027-03-15', phaseId: 'erholung', targetKm: 24, estimated: true, label: 'Erholung', intervals: null, threshold: null, long: 10, extra: [easyRun(6, 'di'), easyRun(6, 'fr')], easyKm: 0 },
  { start: '2027-03-22', phaseId: 'erholung', targetKm: 37, estimated: true, label: 'Wiederaufbau', intervals: null, threshold: [2, 15], long: 16, extra: [easyRun(7, 'di')] },
  { start: '2027-03-29', phaseId: 'spez-a', targetKm: 43, estimated: true, label: 'Letzte harte Woche', intervals: [4, 4], threshold: [2, 20], long: 20, longText: '20 km mit Renntempo-Anteilen (ca. 4:59/km).' },
  { start: '2027-04-05', phaseId: 'spez-a', targetKm: 37, estimated: true, label: 'Feinschliff', intervals: [4, 4], threshold: [2, 15], long: 16, longText: '16 km locker, letzte Schwelle war Freitag.' },
  { start: '2027-04-12', phaseId: 'taper-a', targetKm: 32, estimated: true, label: 'Taper', intervals: [3, 4], threshold: [2, 10], long: 14 },
  {
    start: '2027-04-19', phaseId: 'taper-a', targetKm: 38, estimated: true, label: 'Rennwoche A', intervals: [3, 3], threshold: null, long: null, strengthMode: 'race', skipBike: true,
    extra: [easyRun(5, 'fr', 'Mit 4 Steigerungen.'), race('so', 'A-Rennen Halbmarathon', 'Ziel unter 1:45:00, Pace ca. 4:59/km. Das Zielrennen.')],
  },
]

// Erholungswoche: Montag ist dort Ruhetag, der Easy-Lauf entfällt.
function fixRecovery(weeks: PlanWeek[]): PlanWeek[] {
  return weeks.map((w) =>
    w.start === '2027-03-15' ? { ...w, sessions: w.sessions.filter((s) => !(s.day === 'mo' && s.kind === 'run')) } : w,
  )
}

// Krafttraining: „Split und Übungen“, Stand 18.11.2026.
// Umbenannte Übungen behalten ihren alten Namen als Alias, damit der Verlauf erhalten bleibt.
const WORKOUTS: StrengthWorkout[] = [
  {
    id: 'ok-a',
    name: 'Oberkörper A',
    focus: 'Aufbau, Grundübungen',
    day: 'Montag, schwer, nach dem Lauf',
    exercises: [
      { name: 'Latzug', muscle: 'ruecken', sets: 3, reps: '6–10', rir: '1–2', aliases: ['Latzug (MAG)', 'Latzug (Kabel)', 'Latzug (Kabelzug)'] },
      { name: 'Seitheben am Kabel', muscle: 'seitl_schulter', sets: 4, reps: '10–15', rir: '0–1', aliases: ['Einarmiges Seitheben (Kabelzug)', 'Single Arm Lateral Raise (Cable)'] },
      { name: 'Kabel-Crunch', muscle: 'bauch', sets: 3, reps: '10–15', rir: '0–1', aliases: ['Crunch am Kabelzug', 'Rumpfbeugen mit dem Kabel'] },
      { name: 'Reverse Fly', muscle: 'hintere_schulter', sets: 3, reps: '12–15', rir: '0–1', aliases: ['Reverse Fliegende (Kabel)', 'Reverse Fliegende (Maschine)'] },
      { name: 'Brustgestütztes Rudern', muscle: 'ruecken', sets: 3, reps: '8–12', rir: '1–2' },
      { name: 'Schrägbankdrücken (KH)', muscle: 'brust', sets: 2, reps: '6–10', rir: '2' },
    ],
  },
  {
    id: 'ok-b',
    name: 'Oberkörper B',
    focus: 'Aufbau, Volumen',
    day: 'Donnerstag',
    exercises: [
      { name: 'Klimmzüge', muscle: 'ruecken', sets: 3, reps: '5–8', rir: '1–2', note: 'gewichtet', aliases: ['Klimmzug (Gewichtet)', 'Klimmzug'] },
      { name: 'Seitheben (KH)', muscle: 'seitl_schulter', sets: 4, reps: '12–20', rir: '0–1', aliases: ['Seitheben (Kurzhantel)', 'Seitheben im sitzen (Kurzhantel)', 'Seitheben sitzend (Kurzhantel)'] },
      { name: 'Seitheben (Maschine)', muscle: 'seitl_schulter', sets: 2, reps: '12–15', rir: '0–1' },
      { name: 'Kabel-Crunch', muscle: 'bauch', sets: 3, reps: '10–15', rir: '1', aliases: ['Crunch am Kabelzug', 'Rumpfbeugen mit dem Kabel'] },
      { name: 'Einarmiges Rudern', muscle: 'ruecken', sets: 3, reps: '8–12', rir: '1–2', aliases: ['Einarmiges Rudern am Kabel', 'Kurzhantelrudern'] },
      { name: 'Straight-Arm-Pulldown', muscle: 'ruecken', sets: 2, reps: '12–15', rir: '0–1', aliases: ['Pulldown mit gestreckten Armen (Kabelzug)', 'Gerader Lat-Pulldown (Kabel)', 'Gerader Lat-Pulldown am Seil'] },
      { name: 'Reverse Fly / Face Pull', muscle: 'hintere_schulter', sets: 3, reps: '12–15', rir: '0–1', aliases: ['Reverse Fly oder Face Pull', 'Face Pull', 'Reverse Fliegende (Kabel)', 'Reverse Fliegende (Maschine)'] },
      { name: 'Kabel-Fly / Brustmaschine', muscle: 'brust', sets: 2, reps: '10–15', rir: '1–2', aliases: ['Kabel-Fly oder Brustmaschine', 'Fliegende (Maschine)', 'Fliegende (Kabel)', 'Seated Chest Flys (Cable)'] },
    ],
  },
  {
    id: 'uk-a',
    name: 'Unterkörper A',
    focus: 'Maximalkraft, Muskelerhalt',
    day: 'Mittwoch, schwer',
    exercises: [
      { name: 'Beinbeuger', muscle: 'beine', sets: 2, reps: '8–12', rir: '1–2', aliases: ['Liegendes Beinbeugen (Maschine)', 'Beinbeugen sitzend', 'Beinbeugen sitzend (Maschine)'] },
      { name: 'Beinpresse', muscle: 'beine', sets: 3, reps: '4–6', rir: '2–3', aliases: ['Beinpresse oder Kniebeuge', 'Beinpresse sitzend', 'Beinpresse (Maschine)'] },
      { name: 'Wadenheben stehend', muscle: 'beine', sets: 3, reps: '6–10', rir: '1–2', note: 'schwer' },
      { name: 'Rumänisches Kreuzheben', muscle: 'beine', sets: 3, reps: '5–8', rir: '2–3', aliases: ['Rumänisches Kreuzheben (Langhantel)', 'Rumänisches Kreuzheben (Kurzhantel)'] },
      { name: 'Liegendes Beinheben', muscle: 'bauch', sets: 4, reps: '8–12', rir: '1' },
      { name: 'Curls', muscle: 'arme', sets: 2, reps: '10–12', rir: '1–2', aliases: ['Bizepscurl (Kurzhantel)', 'Hammer Curl (Kurzhantel)'] },
      { name: 'Trizeps-Pushdown', muscle: 'arme', sets: 2, reps: '10–12', rir: '1–2', aliases: ['Trizeps-Pushdown (Kabelzug)', 'Trizeps-Pushdown mit Seil (Kabelzug)'] },
    ],
  },
  {
    id: 'uk-b',
    name: 'Unterkörper B',
    focus: 'Laufkraft, Belastbarkeit',
    day: 'Freitag, Kraft und Belastbarkeit',
    note: 'Bulgarian Split Squat mit 2 Sätzen starten, nach zwei beschwerdefreien Wochen auf 3. Bei zu viel Muskelkater: hohes Step-up.',
    exercises: [
      { name: 'Bulgarian Split Squat', muscle: 'beine', sets: 2, setsMax: 3, reps: '4–6 pro Bein', rir: '3', note: 'oder hohes Step-up', aliases: ['Bulgarian Split Squat (Kurzhantel)', 'Bulgarischer Squat'] },
      { name: 'Hip Thrust', muscle: 'beine', sets: 2, reps: '5–6', rir: '3', aliases: ['Hip Thrust (Maschine)'] },
      { name: 'Wadenheben einbeinig', muscle: 'beine', sets: 2, reps: '6–8', rir: '2', note: 'stehend, schwer', aliases: ['Einbeiniges Wadenheben stehend (Kurzhantel)'] },
      { name: 'Hüftabduktion am Kabel', muscle: 'beine', sets: 2, reps: '12–15', rir: '2' },
      { name: 'Pallof Press', muscle: 'bauch', sets: 3, reps: '10 pro Seite', rir: '–', aliases: ['Pallof Press (Kabelzug)'] },
      { name: 'Wadenheben sitzend', muscle: 'beine', sets: 2, reps: '8–12', rir: '1–2', optional: true, note: 'langsam: 3 s hoch, 2 s halten, 3 s runter' },
      { name: 'Nordic Curls', muscle: 'beine', sets: 2, reps: '5–6', rir: '–', optional: true, aliases: ['Nordic Hamstrings Curls'] },
    ],
  },
]

export const SEED_PLAN: Plan = {
  format: 'form-plan',
  version: 1,
  name: 'Halbmarathon 2027',
  updated: '2026-11-18',
  source: 'Trainingsplan Halbmarathon 2027 (Stand 17.11.2026), Krafttraining Split und Übungen (Stand 18.11.2026)',
  races: [
    { id: 'b', name: 'B-Rennen', priority: 'B', date: '2027-03-14', distanceKm: 21.0975, goal: '1:46:30', goalSec: 6390, note: 'Pace ca. 5:03/km. Kontrolliert laufen, nicht am Limit.' },
    { id: 'a', name: 'A-Rennen', priority: 'A', date: '2027-04-25', distanceKm: 21.0975, goal: 'unter 1:45:00', goalSec: 6300, note: 'Pace ca. 4:59/km. Das Zielrennen.' },
  ],
  hr: { easy: [134, 147], threshold: [158, 164], intervalMax: 178 },
  phases: [
    { id: 'basis', name: 'Aufbau bis Test', from: '2026-11-16', to: '2027-01-10', focus: 'Umfang auf ca. 40 km, Schwelle steigt in Schritten 24 → 30 → 36 → 40 Minuten. Zwei Deload-Wochen.', tip: 'Pro Woche nur ein neuer Stressor (Schwelle, 5. Lauf, Umfangssteigerung).' },
    { id: 'hm-spez', name: 'HM-spezifisch', from: '2027-01-11', to: '2027-02-28', focus: 'Halbmarathon-spezifischer Aufbau bis ca. 43 km, längster Long Run 20–21 km um den 21.02. Im Februar 10-km-Test, Renn-Pace festlegen.', volumePct: 100 },
    { id: 'taper-b', name: 'Taper B', from: '2027-03-01', to: '2027-03-14', focus: 'Taper (ca. 80 %), B-Rennen am 14.03.', volumePct: 80, tip: 'Letzte schwere Beineinheit mindestens 5–7 Tage vor dem Start.' },
    { id: 'erholung', name: 'Erholung', from: '2027-03-15', to: '2027-03-28', focus: 'Erholung (50–60 %), danach Wiederaufbau (ca. 85 %) mit einer Schwelle.', volumePct: 55 },
    { id: 'spez-a', name: 'Spezifisch A', from: '2027-03-29', to: '2027-04-11', focus: 'Letzte harte Woche (100 %), Long Run 20 km mit Renntempo-Anteilen. Danach Feinschliff (85 %), letzte Schwelle.', volumePct: 100 },
    { id: 'taper-a', name: 'Taper A', from: '2027-04-12', to: '2027-04-25', focus: 'Taper (75 %), Rennwoche (50 %), Start am 25.04.', volumePct: 60 },
  ],
  strengthPhases: [
    { id: 'k-aufbau', name: 'Aufbau', from: '2026-11-16', to: '2027-02-28', focus: 'Zuwachs Rücken, seitliche Schulter und Bauch. Beine: Erhalt (Mi) und Kraft/Belastbarkeit (Fr).' },
    { id: 'k-rennen-b', name: 'Rennblock B', from: '2027-03-01', to: '2027-03-21', focus: 'Rennwoche: Oberkörper A normal, Oberkörper B 2 Sätze, kein Unterkörper.' },
    { id: 'k-aufbau-2', name: 'Aufbau II', from: '2027-03-22', to: '2027-04-11', focus: 'Normale Wochenstruktur bis zum Taper.' },
    { id: 'k-rennen-a', name: 'Rennblock A', from: '2027-04-12', to: '2027-04-25', focus: 'Letzte schwere Beineinheit mindestens 5–7 Tage vor dem Start.' },
  ],
  weeks: fixRecovery(WEEKS.map(buildWeek)),
  workouts: WORKOUTS,
  muscleTargets: [
    { muscle: 'ruecken', sets: 14, min: 12, max: 16, priority: 'Zuwachs', rir: '0–2' },
    { muscle: 'seitl_schulter', sets: 10, min: 8, max: 12, priority: 'Zuwachs', rir: '0–1' },
    { muscle: 'hintere_schulter', sets: 6, min: 5, max: 8, priority: 'Erhalt / Haltung' },
    { muscle: 'bauch', sets: 13, min: 11, max: 15, priority: 'Zuwachs' },
    { muscle: 'brust', sets: 4, min: 3, max: 6, priority: 'Erhalt' },
    { muscle: 'beine', sets: 20, min: 17, max: 22, priority: 'Erhalt (Mi) · Kraft (Fr)', rir: '2–3' },
    { muscle: 'arme', sets: 4, min: 3, max: 6, priority: 'nachrangig' },
  ],
  rules: [
    { id: 'lauf-vor-kraft', title: 'Lauf vor Kraft', text: 'Bei Doppeltagen mindestens 6 Stunden Abstand.', trigger: 'double_day' },
    { id: 'ein-stressor', title: 'Ein neuer Stressor pro Woche', text: 'Schwelle, 5. Lauf oder Umfangssteigerung, nie mehrere gleichzeitig.', trigger: 'general' },
    { id: 'rad-5-lauf', title: 'Wechsel vom Rad auf den 5. Lauf', text: 'Erst nach zwei Wochen ohne Fersenschmerz und wenn der geplante Umfang ohne Qualitätsverlust läuft. Der Montagslauf wird entsprechend kürzer.', trigger: 'bike_day' },
    { id: 'rad', title: 'Rad', text: '30–45 Minuten locker. Bei Fersenschmerz pausieren.', trigger: 'bike_day' },
    { id: 'nach-long-run', title: 'Nach dem Long Run', text: 'Gewicht beim Rudern um 5–10 % senken, Sätze beibehalten.', trigger: 'after_long_run' },
    { id: 'deload', title: 'Deload-Woche', text: 'Sätze um ca. 40 % kürzen, Last halten.', trigger: 'deload_week' },
    { id: 'testwoche', title: 'Testwoche', text: 'Freitag davor frei, 48 Stunden vor dem Test kein Unterkörpertraining, Mittwoch ohne neue Maximalgewichte.', trigger: 'test_week' },
    { id: 'rennwoche', title: 'Rennwoche', text: 'Oberkörper A normal, Oberkörper B auf 2 Sätze je Übung kürzen, kein Unterkörpertraining. Letzte schwere Beineinheit mindestens 5–7 Tage vor dem Start.', trigger: 'race_week' },
    { id: 'progression', title: 'Progression', text: 'Erst Wiederholungen im Bereich steigern, dann die Last um 2,5–5 % erhöhen.', trigger: 'strength_day' },
    { id: 'beine-abbruch', title: 'Beinübungen', text: 'Abbrechen, wenn die Wiederholungen im Satz um mehr als 2 fallen oder die Technik schlechter wird.', trigger: 'leg_day' },
    { id: 'pogo', title: 'Pogo Hops', text: 'Frühestens nach vier beschwerdefreien Wochen an der Ferse.', trigger: 'general' },
    { id: 'strides', title: 'Strides', text: 'Steigerungen in den Easy-Läufen können bleiben.', trigger: 'general' },
  ],
  nutrition: [
    { area: 'Energie', value: 'Erhalt plus ca. 150–250 kcal an Krafttagen' },
    { area: 'Protein', value: '1,6–2,2 g pro kg Körpergewicht' },
    { area: 'Gewicht', value: 'Täglich wiegen, Ziel ca. 0,1–0,2 kg Zunahme pro Woche' },
    { area: 'InBody', value: 'Nach 4–6 Wochen unter gleichen Bedingungen' },
  ],
  checkpoints: 'Nach 4 Wochen: Easy-Pace bei gleichem Puls, Pace bei 158–164 bpm, Latzug und Klimmzug, Gewicht, Umfang von Oberarm und Brust, Ferse.',
}
