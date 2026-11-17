import type { ISODate, Weekday } from '../data/types'
import { WEEKDAYS } from '../data/types'

const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 12) // Mittag: robust gegen Zeitumstellung
}

export function today(): ISODate {
  return toISO(new Date())
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = fromISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((fromISO(a).getTime() - fromISO(b).getTime()) / 86400000)
}

/** 0 = Montag … 6 = Sonntag */
export function weekdayIndex(s: ISODate): number {
  return (fromISO(s).getDay() + 6) % 7
}

export function weekdayOf(s: ISODate): Weekday {
  return WEEKDAYS[weekdayIndex(s)]
}

export function mondayOf(s: ISODate): ISODate {
  return addDays(s, -weekdayIndex(s))
}

export function dateForWeekday(monday: ISODate, day: Weekday): ISODate {
  return addDays(monday, WEEKDAYS.indexOf(day))
}

export const DAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
export const DAY_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
export const MONTH_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
export const MONTH_LONG = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

/** "Donnerstag, 22. Okt" */
export function fmtDayLong(s: ISODate): string {
  const d = fromISO(s)
  return `${DAY_LONG[weekdayIndex(s)]}, ${d.getDate()}. ${MONTH_SHORT[d.getMonth()]}`
}

/** "Do, 22. Okt 2026" */
export function fmtDayFull(s: ISODate): string {
  const d = fromISO(s)
  return `${DAY_SHORT[weekdayIndex(s)]}, ${d.getDate()}. ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

/** "Do 22. Okt" */
export function fmtDayShort(s: ISODate): string {
  const d = fromISO(s)
  return `${DAY_SHORT[weekdayIndex(s)]} ${d.getDate()}. ${MONTH_SHORT[d.getMonth()]}`
}

/** "22.10." */
export function fmtDotDate(s: ISODate): string {
  const d = fromISO(s)
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`
}

/** "13. Dez 2026" */
export function fmtDate(s: ISODate): string {
  const d = fromISO(s)
  return `${d.getDate()}. ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

/** "19.–25. Okt" bzw. "28. Dez – 3. Jan" */
export function fmtWeekRange(monday: ISODate): string {
  const a = fromISO(monday)
  const b = fromISO(addDays(monday, 6))
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}.–${b.getDate()}. ${MONTH_SHORT[b.getMonth()]}`
  return `${a.getDate()}. ${MONTH_SHORT[a.getMonth()]} – ${b.getDate()}. ${MONTH_SHORT[b.getMonth()]}`
}

export function monthShort(s: ISODate): string {
  return MONTH_SHORT[fromISO(s).getMonth()]
}
