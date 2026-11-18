// Wischgesten nach links und rechts innerhalb eines Tabs.

import { useRef, useState, type TouchEvent } from 'react'

/** Nicht wischen, wenn die Geste in einem Eingabefeld oder einem waagerecht scrollbaren Bereich beginnt */
function ignore(target: EventTarget | null): boolean {
  let el = target as HTMLElement | null
  while (el && el !== document.body) {
    if (el.matches?.('input, textarea, select, [data-noswipe]')) return true
    if (el.scrollWidth > el.clientWidth + 2) {
      const ox = getComputedStyle(el).overflowX
      if (ox === 'auto' || ox === 'scroll') return true
    }
    el = el.parentElement
  }
  return false
}

/**
 * Liefert Touch-Handler für einen Bereich. `onNext` bei Wisch nach links,
 * `onPrev` bei Wisch nach rechts. Nur klar waagerechte, zügige Gesten zählen.
 */
export function useSwipe(onNext: () => void, onPrev: () => void) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null)
  return {
    onTouchStart: (e: TouchEvent) => {
      if (e.touches.length !== 1 || ignore(e.target)) {
        start.current = null
        return
      }
      const t = e.touches[0]
      start.current = { x: t.clientX, y: t.clientY, t: Date.now() }
    },
    onTouchEnd: (e: TouchEvent) => {
      const s = start.current
      start.current = null
      if (!s) return
      const t = e.changedTouches[0]
      const dx = t.clientX - s.x
      const dy = t.clientY - s.y
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5 || Date.now() - s.t > 700) return
      if (dx < 0) onNext()
      else onPrev()
    },
  }
}

/** Nächster bzw. vorheriger Eintrag einer Liste, ohne über die Enden hinauszugehen */
export function step<T>(list: readonly T[], current: T, dir: 1 | -1): T {
  const i = list.indexOf(current)
  return list[Math.max(0, Math.min(list.length - 1, i + dir))]
}

/** Reiter eines Tabs mit Wischgeste und Richtung für die Einblend-Animation */
export function useSegments<T extends string>(list: readonly T[], initial: T) {
  const [seg, setSeg] = useState<T>(initial)
  const [dir, setDir] = useState<1 | -1>(1)
  const go = (next: T) => {
    if (next === seg) return
    setDir(list.indexOf(next) > list.indexOf(seg) ? 1 : -1)
    setSeg(next)
  }
  const swipe = useSwipe(() => go(step(list, seg, 1)), () => go(step(list, seg, -1)))
  return { seg, go, swipe, slide: dir > 0 ? 'slide-next' : 'slide-prev' }
}
