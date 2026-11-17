import { describe, expect, it } from 'vitest'
import { importCsv, muscleFor, parseCsv, parseHevyTime, workoutIdFor } from '../importCsv'
import { effectiveHr, effectivePace, lastExercise } from '../stats'
import type { RunActivity, StrengthActivity } from '../../data/types'

const LT = `date;type;setting;km;durSec;avgHr;strides;last3Hr;maxHr;thrMin;thrPaceSec;thrHr;intervals;pain;painLoc;rpe;note
2026-10-04;long;out;16;6444;144;;145;;;;;;0;;5;
2026-10-06;int;tm;6.86;3440;136;;;;;;;12.8km/h@168 | 13km/h@173 | 13km/h@174 | 13km/h@175;3;Linke Ferse;6;"Zeile 1
Zeile 2"
2026-09-23;int;tm;;;;;;;;;;14km/h@170 | 14km/h@172;0;;;
2026-10-24;test;tm;5;1418;;;;187;;;;;0;;;
2026-11-13;thr;out;9.02;375;150;;;;24;324;166;;0;;;
`

const HEVY = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"
"Upper Body A","16 Nov. 2026, 17:54","16 Nov. 2026, 19:12","","Latzug (MAG)",9,"",0,"normal",105,8,,,10
"Upper Body A","16 Nov. 2026, 17:54","16 Nov. 2026, 19:12","","Latzug (MAG)",9,"",1,"normal",105,7,,,9.5
"Upper Body A","16 Nov. 2026, 17:54","16 Nov. 2026, 19:12","","Fliegende (Maschine)",,"",0,"warmup",40,10,,,
"Upper Body A","16 Nov. 2026, 17:54","16 Nov. 2026, 19:12","","Fliegende (Maschine)",,"zu schwer",1,"normal",85,10,,,10
"Lower Body B","13 Nov. 2026, 18:02","13 Nov. 2026, 19:29","Knie\\nvorsichtig","Nordic Hamstrings Curls",,"",0,"normal",,10,,,
`

describe('CSV', () => {
  it('liest Anführungszeichen und Zeilenumbrüche', () => {
    const rows = parseCsv('a;b\n1;"x\ny"\n2;"say ""hi"""\n')
    expect(rows).toEqual([{ a: '1', b: 'x\ny' }, { a: '2', b: 'say "hi"' }])
  })
})

describe('Lauftracker', () => {
  const r = importCsv(LT)
  const byId = Object.fromEntries(r.activities.map((a) => [a.id, a]))
  it('erkennt das Format und alle Zeilen', () => {
    expect(r.format).toBe('lauftracker')
    expect(r.activities).toHaveLength(5)
  })
  it('übernimmt Intervalle, Schmerz und Notiz', () => {
    const a = byId['lt-2026-10-06-int'] as RunActivity
    expect(a.runType).toBe('intervall')
    expect(a.setting).toBe('laufband')
    expect(a.intervals).toEqual([{ kmh: 12.8, hr: 168 }, { kmh: 13, hr: 173 }, { kmh: 13, hr: 174 }, { kmh: 13, hr: 175 }])
    expect(a.title).toBe('4 × 12,8–13 km/h')
    expect(a.pain).toBe(3)
    expect(a.painNote).toBe('Linke Ferse')
    expect(a.note).toBe('Zeile 1\nZeile 2')
    expect(a.rpe).toBe(6)
    expect(effectiveHr(a)).toBe(173)
    expect(3600 / effectivePace(a)!).toBeCloseTo(12.95, 2)
  })
  it('legt Tests mit VDOT an', () => {
    const t = byId['lt-2026-10-24-test']
    expect(t.kind).toBe('test')
    expect(t.kind === 'test' && t.vdot).toBeGreaterThan(40)
  })
  it('verwirft unplausible Dauer und warnt', () => {
    const a = byId['lt-2026-11-13-thr'] as RunActivity
    expect(a.durationSec).toBe(0)
    expect(a.main).toEqual({ minutes: 24, paceSec: 324, hr: 166 })
    expect(effectivePace(a)).toBe(324)
    expect(r.warnings.some((w) => w.includes('2026-11-13'))).toBe(true)
  })
  it('behält Intervalle ohne Distanz', () => {
    const a = byId['lt-2026-09-23-int'] as RunActivity
    expect(a.distanceKm).toBe(0)
    expect(a.intervals).toHaveLength(2)
  })
})

describe('Hevy', () => {
  const r = importCsv(HEVY)
  it('fasst Sätze zu Einheiten zusammen', () => {
    expect(r.format).toBe('hevy')
    expect(r.activities).toHaveLength(2)
    const a = r.activities.find((x) => x.date === '2026-11-16') as StrengthActivity
    expect(a.title).toBe('Upper Body A')
    expect(a.workoutId).toBe('ok-a')
    expect(a.durationMin).toBe(78)
    expect(a.exercises.map((e) => [e.name, e.muscle, e.sets.length])).toEqual([
      ['Latzug (MAG)', 'ruecken', 2],
      ['Fliegende (Maschine)', 'brust', 1],
    ])
    expect(a.exercises[0].sets[1]).toEqual({ reps: 7, kg: 105, rir: 1 })
    expect(a.note).toContain('zu schwer')
    expect(r.warnings).toContain('1 Aufwärmsätze nicht gezählt.')
  })
  it('liest Datum und Routine', () => {
    expect(parseHevyTime('16 Nov. 2026, 17:54')?.date).toBe('2026-11-16')
    expect(parseHevyTime('3 März 2026, 07:05')?.date).toBe('2026-03-03')
    expect(parseHevyTime('Nov 16, 2026, 5:54 PM')?.date).toBe('2026-11-16')
    expect(workoutIdFor('Upper Body B (Do)')).toBe('ok-b')
    expect(workoutIdFor('Lower Body A (Mo)')).toBe('uk-a')
    expect(workoutIdFor('Legs & Core B')).toBe('uk-b')
    expect(workoutIdFor('Shoulder/Arms')).toBeUndefined()
  })
  it('ordnet Muskelgruppen zu', () => {
    expect(muscleFor('Beinpresse (Maschine)')).toBe('beine')
    expect(muscleFor('Fliegende (Maschine)')).toBe('brust')
    expect(muscleFor('Reverse Fliegende (Kabel)')).toBe('hintere_schulter')
    expect(muscleFor('Iso-Lateral Low Row')).toBe('ruecken')
    expect(muscleFor('Liegendes Beinbeugen (Maschine)')).toBe('beine')
    expect(muscleFor('Preacher Curl (Langhantel)')).toBe('arme')
    expect(muscleFor('Crunch am Kabelzug')).toBe('bauch')
    expect(muscleFor('Schulterdrücken (Maschinenplatten)')).toBe('vordere_schulter')
  })
  it('findet die letzte Ausführung auch unter Hevy-Namen', () => {
    const last = lastExercise(r.activities, 'Latzug', '2026-11-17', ['Latzug (MAG)'])
    expect(last?.name).toBe('Latzug (MAG)')
    expect(last?.sets[0].kg).toBe(105)
  })
  it('vergibt feste IDs (erneuter Import erzeugt keine Duplikate)', () => {
    expect(importCsv(HEVY).activities.map((a) => a.id)).toEqual(r.activities.map((a) => a.id))
  })
})
