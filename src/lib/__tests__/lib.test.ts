import { describe, expect, it } from 'vitest'
import { paceRefs, predictTime, riegel, vdot } from '../running'
import { addDays, fmtWeekRange, mondayOf, weekdayOf } from '../dates'
import { fmtDuration, fmtPace, parseDuration } from '../format'
import { SEED_PLAN } from '../../data/seedPlan'
import { rulesFor, sessionsOn, weekFor, weekRunKm } from '../plan'
import { buildClaudeExport, diffPlans, extractJson, validatePlan } from '../claude'
import { parseGpx, parseTcx } from '../importFile'
import type { Activity } from '../../data/types'

describe('Laufformeln', () => {
  it('berechnet VDOT nach Daniels (10 km in 47:12 ≈ 43)', () => {
    expect(vdot(10, 47 * 60 + 12)).toBeCloseTo(42.9, 0)
  })
  it('sagt Zeiten passend zur VDOT voraus', () => {
    const v = vdot(5, 22 * 60 + 40)
    expect(predictTime(v, 5)).toBeCloseTo(22 * 60 + 40, -1)
    expect(predictTime(v, 21.0975)).toBeGreaterThan(100 * 60)
  })
  it('liefert plausible Paces', () => {
    const r = paceRefs(43)
    expect(r.schwelle).toBeLessThan(r.easy[0])
    expect(r.intervall).toBeLessThan(r.schwelle)
  })
  it('Riegel-Formel', () => {
    expect(riegel(1200, 5, 10)).toBeCloseTo(1200 * 2 ** 1.06, 3)
  })
})

describe('Datum und Format', () => {
  it('rechnet Wochen montagsbasiert', () => {
    expect(mondayOf('2026-11-22')).toBe('2026-11-16')
    expect(weekdayOf('2026-11-17')).toBe('di')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(fmtWeekRange('2026-12-28')).toBe('28. Dez – 3. Jan')
  })
  it('liest und schreibt Dauern', () => {
    expect(parseDuration('52:10')).toBe(3130)
    expect(parseDuration('1:05:30')).toBe(3930)
    expect(parseDuration('45')).toBe(2700)
    expect(fmtDuration(3930)).toBe('1:05:30')
    expect(fmtPace(307)).toBe('5:07')
  })
})

describe('Startplan aus dem PDF', () => {
  it('ist gültig und deckt 16.11.2026 bis 25.04.2027 ab', () => {
    expect(validatePlan(SEED_PLAN)).toEqual([])
    expect(SEED_PLAN.weeks[0].start).toBe('2026-11-16')
    expect(SEED_PLAN.weeks.at(-1)!.start).toBe('2027-04-19')
    expect(SEED_PLAN.weeks.every((w) => weekdayOf(w.start) === 'mo')).toBe(true)
  })
  it('enthält die Wochenstruktur', () => {
    const tue = sessionsOn(SEED_PLAN, '2026-11-24')
    expect(tue.map((s) => s.title)).toEqual(['Intervalle'])
    const fri = sessionsOn(SEED_PLAN, '2026-11-27')
    expect(fri.map((s) => s.title)).toEqual(['Schwelle', 'Unterkörper B'])
    expect(sessionsOn(SEED_PLAN, '2026-11-28')).toEqual([])
    expect(sessionsOn(SEED_PLAN, '2026-11-29')[0].km).toBe(16)
  })
  it('setzt Test, Deload und Rennwochen um', () => {
    expect(sessionsOn(SEED_PLAN, '2027-01-09')[0].runType).toBe('test')
    expect(weekFor(SEED_PLAN, '2027-01-08')!.sessions.some((s) => s.workoutId === 'uk-b')).toBe(false)
    expect(weekFor(SEED_PLAN, '2026-12-15')!.deload).toBe(true)
    const raceWeek = weekFor(SEED_PLAN, '2027-04-20')!
    expect(raceWeek.sessions.some((s) => s.workoutId?.startsWith('uk'))).toBe(false)
    expect(sessionsOn(SEED_PLAN, '2027-04-25')[0].runType).toBe('rennen')
  })
  it('Wochenkilometer liegen nah am Plan', () => {
    for (const w of SEED_PLAN.weeks.slice(0, 7)) expect(Math.abs(weekRunKm(w) - w.targetKm)).toBeLessThanOrEqual(4)
  })
  it('zeigt passende Regeln', () => {
    const mon = rulesFor(SEED_PLAN, '2026-11-30').map((r) => r.id)
    expect(mon).toContain('nach-long-run')
    expect(mon).toContain('lauf-vor-kraft')
    expect(rulesFor(SEED_PLAN, '2026-11-17').map((r) => r.id)).toContain('deload')
    expect(rulesFor(SEED_PLAN, '2027-01-06').map((r) => r.id)).toContain('testwoche')
  })
})

describe('Austausch mit Claude', () => {
  const acts: Activity[] = [
    { id: '1', kind: 'run', runType: 'easy', date: '2026-11-16', createdAt: 1, distanceKm: 6, durationSec: 2200, avgHr: 141 },
  ]
  it('baut einen Export mit Daten und Plan-JSON', () => {
    const t = buildClaudeExport(SEED_PLAN, acts, {}, '2026-11-17', 'Wie war die Woche?')
    expect(t).toContain('Wie war die Woche?')
    expect(t).toContain('Lauf Easy, 6 km')
    expect(t).toContain('"format":"form-plan"')
  })
  it('liest den Plan aus einer Antwort und erkennt Änderungen', () => {
    const changed = structuredClone(SEED_PLAN)
    changed.weeks[1].targetKm = 36
    const answer = `Hier die Anpassung.\n\n\`\`\`json\n${JSON.stringify(changed)}\n\`\`\`\nViel Erfolg!`
    const p = extractJson(answer)
    expect(validatePlan(p)).toEqual([])
    expect(diffPlans(SEED_PLAN, changed).weeksChanged).toEqual(['2026-11-23'])
  })
  it('meldet ungültige Pläne', () => {
    expect(validatePlan({ format: 'x' }).length).toBeGreaterThan(0)
    expect(() => extractJson('kein json')).toThrow()
  })
})

describe('Dateiimport', () => {
  it('liest GPX', () => {
    const gpx = `<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"><trk><trkseg>
      <trkpt lat="53.55" lon="9.99"><time>2026-11-16T07:00:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>140</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
      <trkpt lat="53.56" lon="9.99"><time>2026-11-16T07:06:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>150</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
    </trkseg></trk></gpx>`
    const r = parseGpx(gpx)
    expect(r.distanceKm).toBeCloseTo(1.11, 1)
    expect(r.durationSec).toBe(360)
    expect(r.avgHr).toBe(145)
  })
  it('liest TCX', () => {
    const tcx = `<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Running"><Id>2026-11-16T07:00:00Z</Id>
      <Lap StartTime="2026-11-16T07:00:00Z"><TotalTimeSeconds>1800</TotalTimeSeconds><DistanceMeters>6000</DistanceMeters><AverageHeartRateBpm><Value>142</Value></AverageHeartRateBpm></Lap>
    </Activity></Activities></TrainingCenterDatabase>`
    const r = parseTcx(tcx)
    expect(r).toMatchObject({ date: '2026-11-16', distanceKm: 6, durationSec: 1800, avgHr: 142 })
  })
})
