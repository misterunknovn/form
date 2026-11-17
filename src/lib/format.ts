const pad = (n: number) => String(n).padStart(2, '0')

/** Sekunden → "4:40" (mm:ss) bzw. "1:44:20" (h:mm:ss) */
export function fmtDuration(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return '–'
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`
}

/** Sekunden → "2:53" (h:mm) */
export function fmtHours(sec: number): string {
  const m = Math.round(sec / 60)
  return `${Math.floor(m / 60)}:${pad(m % 60)}`
}

/** Pace in s/km → "5:07" */
export function fmtPace(secPerKm: number): string {
  if (!isFinite(secPerKm) || secPerKm <= 0) return '–'
  const s = Math.round(secPerKm)
  return `${Math.floor(s / 60)}:${pad(s % 60)}`
}

/** Deutsche Zahl: 10,2 / 2.480 */
export function fmtNum(n: number, digits = 0): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** Zahl mit höchstens einer Nachkommastelle, ohne ",0" */
export function fmtKm(n: number): string {
  const r = Math.round(n * 10) / 10
  return r % 1 === 0 ? fmtNum(r) : fmtNum(r, 1)
}

export function fmtKg(n: number): string {
  const r = Math.round(n * 10) / 10
  return r % 1 === 0 ? fmtNum(r) : fmtNum(r, 1)
}

/** "52:10" oder "1:05:30" → Sekunden; "45" → 45 Minuten */
export function parseDuration(input: string): number | null {
  const t = input.trim().replace(',', '.')
  if (!t) return null
  const parts = t.split(':').map(Number)
  if (parts.some((p) => !isFinite(p) || p < 0)) return null
  if (parts.length === 1) return Math.round(parts[0] * 60)
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return null
}

export function parseNum(input: string): number | null {
  const t = input.trim().replace(/\./g, '').replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return isFinite(n) ? n : null
}

/** Dezimalzahl, Punkt oder Komma als Trennzeichen erlaubt (10.2 oder 10,2) */
export function parseDecimal(input: string): number | null {
  const t = input.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return isFinite(n) ? n : null
}

/** km/h mit einer Nachkommastelle: "13,8 km/h" */
export function fmtKmh(kmh: number): string {
  return isFinite(kmh) && kmh > 0 ? `${fmtNum(Math.round(kmh * 10) / 10, 1)} km/h` : '–'
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function pct(n: number): string {
  return `${fmtNum(Math.round(n))} %`
}
