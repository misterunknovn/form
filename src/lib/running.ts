// Laufformeln: VDOT nach Jack Daniels, Riegel-Formel, Pace-Referenzen.

/** VO2 für eine Geschwindigkeit v in m/min */
function vo2(v: number): number {
  return -4.6 + 0.182258 * v + 0.000104 * v * v
}

/** Anteil der VO2max, der über t Minuten gehalten werden kann */
function pctMax(tMin: number): number {
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * tMin) + 0.2989558 * Math.exp(-0.1932605 * tMin)
}

/** VDOT aus einer Wettkampf- oder Testleistung */
export function vdot(distanceKm: number, durationSec: number): number {
  const t = durationSec / 60
  const v = (distanceKm * 1000) / t
  return vo2(v) / pctMax(t)
}

/** Geschwindigkeit (m/min), bei der ein bestimmter VO2-Wert erreicht wird */
function velocityForVo2(target: number): number {
  const a = 0.000104
  const b = 0.182258
  const c = -4.6 - target
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)
}

/** Pace in s/km bei einem Anteil der VDOT */
export function paceAt(v: number, fraction: number): number {
  const vel = velocityForVo2(v * fraction)
  return 60000 / vel
}

/** Vorhergesagte Zeit (s) für eine Distanz bei gegebener VDOT */
export function predictTime(v: number, distanceKm: number): number {
  let lo = 60
  let hi = 60 * 60 * 8
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    // längere Zeit → kleinere VDOT
    if (vdot(distanceKm, mid) > v) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Riegel: T2 = T1 · (D2 / D1)^1.06 */
export function riegel(t1Sec: number, d1Km: number, d2Km: number): number {
  return t1Sec * Math.pow(d2Km / d1Km, 1.06)
}

export interface PaceRefs {
  easy: [number, number]
  schwelle: number
  intervall: number
  renntempo: number // Halbmarathon-Tempo
}

/** Trainings-Paces nach Daniels (Easy 59–74 %, Schwelle 88 %, Intervall 98 %, HM-Renntempo) */
export function paceRefs(v: number): PaceRefs {
  return {
    easy: [paceAt(v, 0.74), paceAt(v, 0.62)],
    schwelle: paceAt(v, 0.88),
    intervall: paceAt(v, 0.975),
    renntempo: predictTime(v, 21.0975) / 21.0975,
  }
}

export const STANDARD_DISTANCES = [
  { km: 5, name: '5 km' },
  { km: 10, name: '10 km' },
  { km: 21.0975, name: 'Halbmarathon' },
  { km: 42.195, name: 'Marathon' },
]
