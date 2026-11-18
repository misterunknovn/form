import { describe, expect, it } from 'vitest'
import { niceTop } from '../../components/charts'
import { step } from '../../components/swipe'
import { intensity } from '../stats'
import type { Activity } from '../../data/types'

describe('Wochenumfang-Achse', () => {
  it('passt sich dem Umfang an', () => {
    expect(niceTop(42)).toBe(50)
    expect(niceTop(38)).toBe(40)
    expect(niceTop(58)).toBe(70)
    expect(niceTop(8)).toBe(20)
  })
})

describe('Wischen', () => {
  it('geht einen Reiter weiter und bleibt an den Enden stehen', () => {
    const l = ['volumen', 'leistung', 'daten'] as const
    expect(step(l, 'volumen', 1)).toBe('leistung')
    expect(step(l, 'daten', 1)).toBe('daten')
    expect(step(l, 'volumen', -1)).toBe('volumen')
  })
})

describe('Intensität', () => {
  it('zählt Tests nicht als Intervalle', () => {
    const acts: Activity[] = [
      { id: '1', kind: 'run', runType: 'easy', date: '2026-11-02', createdAt: 0, distanceKm: 10, durationSec: 3600 },
      { id: '2', kind: 'run', runType: 'intervall', date: '2026-11-03', createdAt: 0, distanceKm: 7, durationSec: 3000 },
      { id: '3', kind: 'test', date: '2026-11-04', createdAt: 0, distanceKm: 5, durationSec: 1400, vdot: 41 },
    ]
    const it = intensity(acts, '2026-11-01', '2026-11-08')
    expect(it.intv).toBe(7)
    expect(it.total).toBe(17)
  })
})
