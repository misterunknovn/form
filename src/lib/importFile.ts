// Läufe aus GPX- oder TCX-Dateien lesen (z. B. Export aus HealthFit oder Strava).

import type { ISODate } from '../data/types'
import { toISO } from './dates'

export interface ImportedRun {
  date: ISODate
  distanceKm: number
  durationSec: number
  avgHr?: number
  source: 'gpx' | 'tcx'
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

const byLocal = (el: Element | Document, name: string) =>
  Array.from(el.getElementsByTagName('*')).filter((e) => e.localName === name)

export function parseGpx(xml: string): ImportedRun {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Die GPX-Datei ist nicht lesbar.')
  const pts = byLocal(doc, 'trkpt')
  if (pts.length < 2) throw new Error('In der GPX-Datei sind keine Streckenpunkte.')
  let dist = 0
  const hrs: number[] = []
  let first: number | null = null
  let last: number | null = null
  let prev: [number, number] | null = null
  for (const p of pts) {
    const lat = Number(p.getAttribute('lat'))
    const lon = Number(p.getAttribute('lon'))
    if (prev) dist += haversine(prev[0], prev[1], lat, lon)
    prev = [lat, lon]
    const t = byLocal(p, 'time')[0]?.textContent
    if (t) {
      const ms = Date.parse(t)
      if (!isNaN(ms)) {
        if (first === null) first = ms
        last = ms
      }
    }
    const hr = byLocal(p, 'hr')[0]?.textContent
    if (hr) hrs.push(Number(hr))
  }
  if (first === null || last === null) throw new Error('In der GPX-Datei fehlen Zeitangaben.')
  return {
    date: toISO(new Date(first)),
    distanceKm: Math.round(dist / 10) / 100,
    durationSec: Math.round((last - first) / 1000),
    avgHr: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : undefined,
    source: 'gpx',
  }
}

export function parseTcx(xml: string): ImportedRun {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Die TCX-Datei ist nicht lesbar.')
  const laps = byLocal(doc, 'Lap')
  if (!laps.length) throw new Error('In der TCX-Datei ist keine Runde enthalten.')
  let sec = 0
  let m = 0
  let hrWeighted = 0
  let hrSec = 0
  for (const l of laps) {
    const s = Number(byLocal(l, 'TotalTimeSeconds')[0]?.textContent ?? 0)
    const d = Number(byLocal(l, 'DistanceMeters')[0]?.textContent ?? 0)
    sec += s
    // DistanceMeters gibt es auch je Trackpoint; nur das direkte Kind der Runde zählt
    const lapDist = Array.from(l.children).find((c) => c.localName === 'DistanceMeters')
    m += lapDist ? Number(lapDist.textContent) : d
    const avg = Array.from(l.children).find((c) => c.localName === 'AverageHeartRateBpm')
    const v = avg ? Number(byLocal(avg, 'Value')[0]?.textContent) : NaN
    if (isFinite(v) && v > 0) {
      hrWeighted += v * s
      hrSec += s
    }
  }
  const start = laps[0].getAttribute('StartTime') ?? byLocal(doc, 'Id')[0]?.textContent ?? ''
  const ms = Date.parse(start)
  return {
    date: toISO(isNaN(ms) ? new Date() : new Date(ms)),
    distanceKm: Math.round(m / 10) / 100,
    durationSec: Math.round(sec),
    avgHr: hrSec ? Math.round(hrWeighted / hrSec) : undefined,
    source: 'tcx',
  }
}

export async function readRunFile(file: File): Promise<ImportedRun> {
  const text = await file.text()
  const name = file.name.toLowerCase()
  if (name.endsWith('.gpx')) return parseGpx(text)
  if (name.endsWith('.tcx')) return parseTcx(text)
  if (name.endsWith('.fit')) throw new Error('FIT-Dateien werden noch nicht unterstützt. Exportiere den Lauf bitte als GPX oder TCX.')
  if (text.includes('<gpx')) return parseGpx(text)
  if (text.includes('TrainingCenterDatabase')) return parseTcx(text)
  throw new Error('Unbekanntes Dateiformat. Unterstützt werden GPX und TCX.')
}
