import { useNav } from '../App'
import { useData } from '../data/store'
import { Sheet } from '../components/ui'
import { IconBike, IconPulse, IconStopwatch, IconStrength } from '../components/icons'
import { sessionsOn } from '../lib/plan'

export function AddSheet() {
  const nav = useNav()
  const { plan, today } = useData()
  const planned = sessionsOn(plan, today)
  const run = planned.find((s) => s.kind === 'run')
  const str = planned.find((s) => s.kind === 'strength')
  const items = [
    { t: 'Lauf eintragen', s: 'Manuell erfassen oder aus Datei', ico: <IconPulse color="var(--run)" />, bg: 'var(--run-bg)', go: () => nav.open({ kind: 'run', date: today, planned: run }) },
    { t: 'Krafteinheit eintragen', s: 'Übungen, Sätze und Wiederholungen', ico: <IconStrength color="var(--str)" />, bg: 'var(--str-bg)', go: () => nav.open({ kind: 'strength', date: today, planned: str }) },
    { t: 'Rad eintragen', s: 'Lockere Einheit, zählt nicht in die km', ico: <IconBike color="var(--text-2)" />, bg: 'var(--tile)', go: () => nav.open({ kind: 'run', date: today, planned: { day: 'do', kind: 'bike', title: 'Rad locker' } }) },
    { t: 'Leistungstest eintragen', s: 'Neue VDOT berechnen', ico: <IconStopwatch color="var(--run)" />, bg: 'var(--run-bg)', go: () => nav.open({ kind: 'test' }) },
  ]
  return (
    <Sheet title="Hinzufügen" onClose={nav.close}>
      {items.map((i) => (
        <button key={i.t} className="menu-item" onClick={i.go}>
          <span className="menu-ico" style={{ background: i.bg }}>{i.ico}</span>
          <span style={{ flex: 1 }}>
            <div className="menu-t">{i.t}</div>
            <div className="menu-s">{i.s}</div>
          </span>
          <span style={{ color: 'var(--faint)' }}>›</span>
        </button>
      ))}
    </Sheet>
  )
}
