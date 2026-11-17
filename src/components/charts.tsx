// Diagramme als schlanke SVG-/Flex-Komponenten im Stil des Designs.

import type { ISODate } from '../data/types'
import { addDays, fromISO, mondayOf, MONTH_SHORT } from '../lib/dates'
import { fmtKm } from '../lib/format'

/** Monatsbeschriftungen unter einer Wochenreihe */
export function MonthAxis({ starts }: { starts: ISODate[] }) {
  let last = -1
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
      {starts.map((s, i) => {
        const m = fromISO(s).getMonth()
        const show = m !== last && (i > 0 || fromISO(s).getDate() <= 7)
        last = m
        return (
          <div key={s} style={{ flex: 1, minWidth: 0, font: '500 10px var(--font)', color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'visible' }}>
            {show ? MONTH_SHORT[m] : ''}
          </div>
        )
      })}
    </div>
  )
}

/** Wochenumfang: Säule = Wochen-km, innen der längste Lauf; aktuelle Woche hervorgehoben */
export function WeeklyBars({ weeks, avg }: { weeks: { start: ISODate; km: number; longest: number }[]; avg: number }) {
  const max = Math.max(20, ...weeks.map((w) => w.km), avg) * 1.1
  const top = Math.ceil(max / 20) * 20
  const H = 92
  const ticks = [top, (top * 2) / 3, top / 3].map((t) => Math.round(t))
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ position: 'relative', height: H, display: 'flex' }}>
        <div style={{ width: 22, position: 'relative', flex: 'none' }}>
          {ticks.map((t) => (
            <span key={t} style={{ position: 'absolute', top: H - (t / top) * H - 6, font: '500 10px var(--font)', color: 'var(--text-2)' }}>{t}</span>
          ))}
        </div>
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 4 }}>
          {ticks.map((t) => (
            <div key={t} style={{ position: 'absolute', left: 0, right: 0, top: H - (t / top) * H, borderTop: '1px solid var(--line)' }} />
          ))}
          {avg > 0 && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: H - (avg / top) * H, borderTop: '1px dashed var(--text-2)', opacity: 0.6 }} />
          )}
          {weeks.map((w, i) => {
            const cur = i === weeks.length - 1
            const h = (w.km / top) * H
            const lh = (w.longest / top) * H
            return (
              <div key={w.start} className="grow" style={{ flex: 1, height: Math.max(h, w.km ? 3 : 0), borderRadius: 4, background: cur ? 'var(--run-light)' : 'var(--run-darker)', position: 'relative', overflow: 'hidden', opacity: cur ? 1 : 0.95 }} title={`${fmtKm(w.km)} km`}>
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: lh, background: cur ? 'var(--run)' : 'var(--run-deep)' }} />
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ paddingLeft: 22 }}>
        <MonthAxis starts={weeks.map((w) => w.start)} />
      </div>
    </div>
  )
}

/** Plan-Säulen: vergangene Wochen gedämpft, aktuelle Woche weiß */
export function PlanBars({ values, current, tone, labels }: { values: { v: number; deload?: boolean }[]; current: number; tone: 'run' | 'str'; labels: [string, string, string] }) {
  const max = Math.max(1, ...values.map((x) => x.v))
  const H = 76
  const past = tone === 'run' ? 'var(--run-deep)' : 'var(--str-deep)'
  const future = tone === 'run' ? 'var(--run-darker)' : 'var(--str-dark)'
  const accent = tone === 'run' ? 'var(--run)' : 'var(--str)'
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ height: H, display: 'flex', alignItems: 'flex-end', gap: 3 }}>
        {values.map((x, i) => (
          <div key={i} className="grow" style={{ flex: 1, height: Math.max(2, (x.v / max) * H), borderRadius: 3, background: i === current ? 'var(--text)' : i < current ? past : future, opacity: x.deload && i !== current ? 0.7 : 1 }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, font: '500 10px var(--font)', color: 'var(--text-2)' }}>
        <span>{labels[0]}</span>
        <span style={{ color: accent }}>{labels[1]}</span>
        <span>{labels[2]}</span>
      </div>
    </div>
  )
}

/** Kleine Verlaufslinie mit Fläche */
export function Sparkline({ values, color, width = 96, height = 30, invert = false }: { values: (number | null)[]; color: string; width?: number; height?: number; invert?: boolean }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null)
  if (pts.length < 2) return <svg width={width} height={height} />
  const min = Math.min(...pts.map((p) => p.v))
  const max = Math.max(...pts.map((p) => p.v))
  const span = max - min || 1
  const x = (i: number) => (i / (values.length - 1)) * (width - 6) + 3
  const y = (v: number) => {
    const n = (v - min) / span
    return 4 + (invert ? n : 1 - n) * (height - 8)
  }
  const d = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join('')
  const area = `${d}L${x(pts[pts.length - 1].i).toFixed(1)},${height}L${x(pts[0].i).toFixed(1)},${height}Z`
  const last = pts[pts.length - 1]
  const id = `g${color.replace(/[^a-z0-9]/gi, '')}`
  return (
    <svg width={width} height={height} style={{ flex: 'none', overflow: 'visible' }}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} stroke={color} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last.i)} cy={y(last.v)} r={3} fill={color} />
    </svg>
  )
}

const RUN_LEVELS = ['#1b1f1f', 'var(--run-bg)', 'var(--run-darker)', 'var(--run-deep)', 'var(--run-mid)']
const STR_LEVELS = ['#1b1f1f', 'var(--str-bg)', 'var(--str-dark)', 'var(--str-deep)', 'var(--str)']

/** Trainingskalender: Zeilen Mo–So, Spalten Wochen */
export function CalendarHeatmap({ levels, date, weeks = 13, tone }: { levels: Map<ISODate, number>; date: ISODate; weeks?: number; tone: 'run' | 'str' }) {
  const pal = tone === 'run' ? RUN_LEVELS : STR_LEVELS
  const lastMon = mondayOf(date)
  const starts = Array.from({ length: weeks }, (_, i) => addDays(lastMon, -7 * (weeks - 1 - i)))
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ width: 22, display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', gap: 3, flex: 'none' }}>
          {['Mo', '', 'Mi', '', 'Fr', '', ''].map((l, i) => (
            <span key={i} style={{ font: '500 10px var(--font)', color: 'var(--text-2)', lineHeight: '14px' }}>{l}</span>
          ))}
        </div>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${weeks}, 1fr)`, gridAutoFlow: 'column', gridTemplateRows: 'repeat(7, 14px)', gap: 3 }}>
          {starts.flatMap((s) =>
            Array.from({ length: 7 }, (_, d) => {
              const day = addDays(s, d)
              const lvl = day > date ? -1 : levels.get(day) ?? 0
              return <div key={day} title={day} style={{ borderRadius: 3, background: lvl < 0 ? 'transparent' : pal[lvl], border: lvl < 0 ? '1px solid #1b1f1f' : 'none' }} />
            }),
          )}
        </div>
      </div>
      <div style={{ paddingLeft: 28 }}>
        <MonthAxis starts={starts} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10, font: '500 10px var(--font)', color: 'var(--text-2)' }}>
        <span style={{ marginRight: 4 }}>Weniger</span>
        {pal.map((c, i) => (
          <i key={i} style={{ width: 9, height: 9, borderRadius: 2, background: c }} />
        ))}
        <span style={{ marginLeft: 4 }}>Mehr</span>
      </div>
    </div>
  )
}

/** Säulen mit Wert darüber (z. B. Sätze pro Einheit) */
export function ValueBars({ items, colorFor }: { items: { label: string; v: number; key: string }[]; colorFor: (key: string, i: number) => string }) {
  const max = Math.max(1, ...items.map((x) => x.v))
  const H = 90
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ height: H + 16, display: 'flex', alignItems: 'flex-end', gap: 5 }}>
        {items.map((x, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ font: '600 10px var(--font)', color: 'var(--text-2)' }} className="num">{x.v}</span>
            <div className="grow" style={{ width: '100%', height: Math.max(2, (x.v / max) * H), borderRadius: 4, background: colorFor(x.key, i) }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
        {items.map((x, i) => (
          <span key={i} style={{ flex: 1, textAlign: 'center', font: '500 9px var(--font)', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{x.label}</span>
        ))}
      </div>
    </div>
  )
}

/** Bandbreite mit Zielbereich und aktuellem Wert */
export function RangeMeter({ value, min, max, scaleMax }: { value: number; min: number; max: number; scaleMax: number }) {
  const p = (v: number) => `${Math.min(100, (v / scaleMax) * 100)}%`
  return (
    <div style={{ position: 'relative', height: 8, marginTop: 10 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 3, height: 2, borderRadius: 1, background: 'var(--line)' }} />
      <div style={{ position: 'absolute', left: p(min), width: `calc(${p(max)} - ${p(min)})`, top: 2, height: 4, borderRadius: 2, background: 'var(--line-2)' }} />
      <div style={{ position: 'absolute', left: `calc(${p(value)} - 4px)`, top: 0, width: 8, height: 8, borderRadius: 4, background: 'var(--str)' }} />
    </div>
  )
}
