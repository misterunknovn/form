// CSV-Import: Krafteinheiten aus Hevy und Läufe aus dem Lauftracker.
// Jede Einheit bekommt eine feste ID aus ihren Daten, damit ein erneuter
// Import derselben Datei nichts doppelt anlegt.

import type { Activity, IntervalRep, ISODate, Muscle, RunActivity, RunType, StrengthActivity, TestActivity } from '../data/types'
import { vdot } from './running'

export interface CsvImport {
  format: 'hevy' | 'lauftracker'
  activities: Activity[]
  warnings: string[]
}

// ---------- CSV ----------

/** CSV mit Anführungszeichen und Zeilenumbrüchen in Feldern */
export function parseCsv(text: string, delimiter?: string): Record<string, string>[] {
  const t = text.replace(/^\uFEFF/, '')
  const nl = t.indexOf('\n')
  const firstLine = nl < 0 ? t : t.slice(0, nl)
  const d = delimiter ?? ((firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (quoted) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === d) {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim() !== ''))
  if (!head) return []
  const keys = head.map((h) => h.trim())
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])))
}

const num = (s: string | undefined): number | undefined => {
  if (s === undefined || s.trim() === '') return undefined
  const n = Number(s.replace(',', '.'))
  return isFinite(n) ? n : undefined
}

export function detectFormat(text: string): CsvImport['format'] | null {
  const head = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0]
  if (head.includes('exercise_title') && head.includes('start_time')) return 'hevy'
  if (/\bdate\b/.test(head) && /\btype\b/.test(head) && /\bdurSec\b/.test(head)) return 'lauftracker'
  return null
}

export function importCsv(text: string): CsvImport {
  const f = detectFormat(text)
  if (f === 'hevy') return parseHevy(text)
  if (f === 'lauftracker') return parseLauftracker(text)
  throw new Error('Unbekanntes CSV-Format. Unterstützt werden Hevy-Exporte und der Lauftracker.')
}

// ---------- Lauftracker ----------

const RUN_TYPES: Record<string, RunType> = { easy: 'easy', long: 'long', int: 'intervall', thr: 'schwelle', test: 'test', race: 'rennen' }

function parseIntervals(s: string): IntervalRep[] {
  return s
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x): IntervalRep | null => {
      const m = x.match(/([\d.,]+)\s*km\/h(?:\s*@\s*(\d+))?/i)
      return m ? { kmh: Number(m[1].replace(',', '.')), hr: m[2] ? Number(m[2]) : undefined } : null
    })
    .filter((x): x is IntervalRep => x !== null)
}

const fmtNum1 = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')

export function parseLauftracker(text: string): CsvImport {
  const rows = parseCsv(text)
  const warnings: string[] = []
  const activities: Activity[] = []
  const seen = new Map<string, number>()
  for (const r of rows) {
    const date = r.date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
      warnings.push(`Zeile ohne gültiges Datum übersprungen („${date ?? ''}“).`)
      continue
    }
    const runType = RUN_TYPES[r.type]
    if (!runType) {
      warnings.push(`${date}: unbekannter Typ „${r.type}“, übersprungen.`)
      continue
    }
    const key = `${date}-${r.type}`
    const n = (seen.get(key) ?? 0) + 1
    seen.set(key, n)
    const id = `lt-${key}${n > 1 ? `-${n}` : ''}`

    let km = num(r.km) ?? 0
    let sec = num(r.durSec) ?? 0
    const notes = [r.note].filter(Boolean) as string[]
    // Unplausible Dauer (schneller als 2:30 /km) nicht übernehmen
    if (km > 0 && sec > 0 && sec / km < 150) {
      warnings.push(`${date}: Dauer ${sec} s für ${fmtNum1(km)} km ist unplausibel und wurde nicht übernommen. Bitte in der App nachtragen.`)
      notes.push(`Dauer in der CSV: ${sec} s (unplausibel, nicht übernommen)`)
      sec = 0
    }
    if (km > 60) {
      warnings.push(`${date}: ${km} km wirken unplausibel und wurden nicht übernommen.`)
      km = 0
    }
    const setting = r.setting === 'tm' ? 'laufband' : r.setting === 'out' ? 'draussen' : undefined
    const rpe = num(r.rpe)
    const note = notes.join(' · ') || undefined

    if (runType === 'test') {
      if (!km || !sec) {
        warnings.push(`${date}: Test ohne Distanz oder Zeit übersprungen.`)
        continue
      }
      const t: TestActivity = { id, kind: 'test', date, createdAt: 0, distanceKm: km, durationSec: sec, vdot: vdot(km, sec), maxHr: num(r.maxHr), setting, note }
      activities.push(t)
      continue
    }

    const intervals = r.intervals ? parseIntervals(r.intervals) : []
    const thrMin = num(r.thrMin)
    const main = thrMin || num(r.thrPaceSec) || num(r.thrHr) ? { minutes: thrMin, paceSec: num(r.thrPaceSec), hr: num(r.thrHr) } : undefined
    let title: string | undefined
    if (intervals.length) {
      const speeds = intervals.map((i) => i.kmh)
      const lo = Math.min(...speeds)
      const hi = Math.max(...speeds)
      title = `${intervals.length} × ${lo === hi ? fmtNum1(lo) : `${fmtNum1(lo)}–${fmtNum1(hi)}`} km/h`
    } else if (main?.minutes) title = `${main.minutes} Min`
    if (!km && !sec && !intervals.length) warnings.push(`${date}: Lauf ohne Distanz und Dauer.`)
    if (!km && intervals.length) warnings.push(`${date}: Intervalle ohne Distanz, sie zählen nicht in die Wochenkilometer.`)

    const run: RunActivity = {
      id,
      kind: 'run',
      date,
      createdAt: 0,
      runType,
      title,
      distanceKm: km,
      durationSec: sec,
      avgHr: num(r.avgHr),
      rpe,
      effort: rpe ? Math.min(5, Math.max(1, Math.round(rpe / 2))) : undefined,
      source: 'csv',
      setting,
      strides: r.strides === 'true' ? true : r.strides === 'false' ? false : undefined,
      last3Hr: num(r.last3Hr),
      maxHr: num(r.maxHr),
      main,
      intervals: intervals.length ? intervals : undefined,
      pain: num(r.pain),
      painNote: r.painLoc || undefined,
      note,
    }
    activities.push(run)
  }
  return { format: 'lauftracker', activities, warnings }
}

// ---------- Hevy ----------

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mär: 3, mar: 3, märz: 3, apr: 4, mai: 5, may: 5, jun: 6, juni: 6, jul: 7, juli: 7, aug: 8,
  sep: 9, sept: 9, okt: 10, oct: 10, nov: 11, dez: 12, dec: 12,
}

/** "16 Nov. 2026, 17:54" (deutsch) oder "Nov 16, 2026, 5:54 PM" (englisch) → ISO-Datum + Minuten */
export function parseHevyTime(s: string): { date: ISODate; minutes: number } | null {
  const de = s.match(/^(\d{1,2})\.?\s+([A-Za-zäÄ]+)\.?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})/)
  const en = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  let y: number, mo: number, d: number, h: number, mi: number
  if (de && MONTHS[de[2].toLowerCase()]) {
    ;[d, mo, y, h, mi] = [Number(de[1]), MONTHS[de[2].toLowerCase()], Number(de[3]), Number(de[4]), Number(de[5])]
  } else if (en && MONTHS[en[1].toLowerCase().slice(0, 3)]) {
    ;[mo, d, y, h, mi] = [MONTHS[en[1].toLowerCase().slice(0, 3)], Number(en[2]), Number(en[3]), Number(en[4]), Number(en[5])]
    if (en[6]?.toUpperCase() === 'PM' && h < 12) h += 12
    if (en[6]?.toUpperCase() === 'AM' && h === 12) h = 0
  } else return null
  const p = (n: number) => String(n).padStart(2, '0')
  return { date: `${y}-${p(mo)}-${p(d)}`, minutes: Date.UTC(y, mo - 1, d, h, mi) / 60000 }
}

/** Muskelgruppe einer Übung anhand ihres Namens */
export function muscleFor(name: string): Muscle {
  const n = name.toLowerCase()
  const has = (...k: string[]) => k.some((x) => n.includes(x))
  // englische Begriffe nur als ganze Wörter („row“ nicht in „Arrow“, „chin“ nicht in „Maschine“)
  const word = (...k: string[]) => k.some((x) => new RegExp(`(^|[^a-zäöüß])${x}([^a-zäöüß]|$)`).test(n))
  if (has('reverse flie', 'fliegende reverse', 'face pull', 'reverse fly', 'rear delt')) return 'hintere_schulter'
  if (has('seitheben', 'lateral raise')) return 'seitl_schulter'
  if (has('schulterdrücken', 'shoulder press', 'überkopfdrücken', 'overhead press', 'frontheben')) return 'vordere_schulter'
  if (has('beinbeug', 'leg curl', 'nordic', 'hamstring')) return 'beine'
  if (has('curl', 'trizeps', 'triceps', 'jm-press') || word('dips?')) return 'arme'
  if (has('crunch', 'rumpfbeug', 'beinheben', 'leg raise', 'dragon flag', 'pallof', 'twist', 'plank', 'bauch')) return 'bauch'
  if (has('latzug', 'pulldown', 'lat-pull', 'rudern', 'klimmzug', 'pull-up', 'pull up') || word('rows?', 'chin-ups?', 'chin ups?')) return 'ruecken'
  if (has('bankdrücken', 'brustpresse', 'bench', 'chest', 'fliegende', 'liegestütz', 'push-up') || word('fly', 'flys', 'flyes')) return 'brust'
  return 'beine'
}

/** Hevy-Routine → Einheit im Plan (Upper Body A → Oberkörper A usw.) */
export function workoutIdFor(title: string): string | undefined {
  const t = ` ${title.toLowerCase().replace(/[()\-/]/g, ' ')} `
  const ab = / b /.test(t) ? 'b' : / a /.test(t) ? 'a' : null
  if (/upper|oberkörper/.test(t) && ab) return `ok-${ab}`
  if (/lower|unterkörper|legs|beine/.test(t)) return `uk-${ab ?? 'a'}`
  return undefined
}

export function parseHevy(text: string): CsvImport {
  const rows = parseCsv(text, ',')
  const warnings: string[] = []
  const sessions = new Map<string, { title: string; start: string; end: string; description: string; rows: Record<string, string>[] }>()
  for (const r of rows) {
    const k = `${r.title}|${r.start_time}`
    if (!sessions.has(k)) sessions.set(k, { title: r.title, start: r.start_time, end: r.end_time, description: r.description, rows: [] })
    sessions.get(k)!.rows.push(r)
  }
  const activities: Activity[] = []
  let skippedWarmups = 0
  for (const s of sessions.values()) {
    const start = parseHevyTime(s.start)
    const end = parseHevyTime(s.end)
    if (!start) {
      warnings.push(`Einheit „${s.title}“ mit unlesbarem Datum („${s.start}“) übersprungen.`)
      continue
    }
    const exMap = new Map<string, StrengthActivity['exercises'][number]>()
    const exNotes = new Set<string>()
    for (const r of s.rows) {
      if (r.set_type === 'warmup') {
        skippedWarmups++
        continue
      }
      const reps = num(r.reps) ?? 0
      if (reps <= 0) continue // Cardio- oder Zeitübungen ohne Wiederholungen
      const name = r.exercise_title.trim()
      if (!exMap.has(name)) exMap.set(name, { name, muscle: muscleFor(name), sets: [] })
      const rpe = num(r.rpe)
      exMap.get(name)!.sets.push({ reps, kg: num(r.weight_kg) ?? 0, rir: rpe !== undefined ? Math.max(0, Math.round(10 - rpe)) : undefined })
      if (r.exercise_notes) exNotes.add(`${name}: ${r.exercise_notes}`)
    }
    if (!exMap.size) continue
    const note = [s.description?.replace(/\\n/g, ' '), ...exNotes].filter(Boolean).join(' · ') || undefined
    activities.push({
      id: `hevy-${start.minutes}`,
      kind: 'strength',
      date: start.date,
      createdAt: 0,
      title: s.title,
      workoutId: workoutIdFor(s.title),
      durationMin: end ? Math.max(1, end.minutes - start.minutes) : 60,
      exercises: [...exMap.values()],
      note,
      source: 'hevy',
    })
  }
  if (skippedWarmups) warnings.push(`${skippedWarmups} Aufwärmsätze nicht gezählt.`)
  return { format: 'hevy', activities, warnings }
}

export function summarize(acts: Activity[]) {
  const dates = acts.map((a) => a.date).sort()
  return {
    runs: acts.filter((a) => a.kind === 'run').length,
    tests: acts.filter((a) => a.kind === 'test').length,
    strength: acts.filter((a) => a.kind === 'strength').length,
    from: dates[0] as ISODate | undefined,
    to: dates[dates.length - 1] as ISODate | undefined,
  }
}
