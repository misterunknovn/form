import { useState, type ReactNode } from 'react'
import { IconPlus } from './icons'

export function Header({ icon, title, onPlus }: { icon: ReactNode; title: string; onPlus?: () => void }) {
  return (
    <div className="header">
      <div className="header-title">
        {icon}
        {title}
      </div>
      {onPlus && (
        <button className="plus-btn" onClick={onPlus} aria-label="Hinzufügen">
          <IconPlus />
        </button>
      )}
    </div>
  )
}

export function SubHeader({ kicker, title, onBack }: { kicker: string; title: string; onBack: () => void }) {
  return (
    <div className="subheader">
      <button className="back-btn" onClick={onBack} aria-label="Zurück">‹</button>
      <div>
        <div className="subheader-kicker">{kicker}</div>
        <div className="subheader-title">{title}</div>
      </div>
    </div>
  )
}

export function Segmented<T extends string>({
  value, options, onChange, tone = 'run',
}: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; tone?: 'run' | 'str' }) {
  return (
    <div className={`seg ${tone}`}>
      {options.map((o) => (
        <button key={o.id} className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`card ${className}`} style={style}>{children}</div>
}

export function CardHead({ title, aside }: { title: ReactNode; aside?: ReactNode }) {
  return (
    <div className="card-head">
      <span className="card-title">{title}</span>
      {aside && <span className="card-aside">{aside}</span>}
    </div>
  )
}

export function CardLink({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button className="card-link" onClick={onClick}>
      <span>{label}</span>
      <span className="chev">›</span>
    </button>
  )
}

/**
 * Delta-Chip. `good` bestimmt die Farbe (Akzent bei Verbesserung, neutral sonst),
 * `up` die Richtung des Dreiecks.
 */
export function Delta({ up, children, tone = 'run', good = true }: { up: boolean | null; children: ReactNode; tone?: 'run' | 'str'; good?: boolean }) {
  const cls = up === null ? 'neutral' : good ? tone : 'neutral'
  return (
    <span className={`delta ${cls}`}>
      {up !== null && <i>{up ? '▲' : '▼'}</i>}
      {children}
    </span>
  )
}

export function Tiles({ items, large }: { items: { v: ReactNode; l: string }[]; large?: boolean }) {
  return (
    <div className={`tiles ${large ? 'lg' : ''}`}>
      {items.map((t, i) => (
        <div className="tile" key={i}>
          <div className="tile-v">{t.v}</div>
          <div className="tile-l">{t.l}</div>
        </div>
      ))}
    </div>
  )
}

export function Toggle({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: [string, string] }) {
  return (
    <button className="toggle" onClick={onToggle}>
      <span>{open ? label[1] : label[0]}</span>
      <span className={`toggle-ico ${open ? 'open' : ''}`}>▼</span>
    </button>
  )
}

export function useToggle(init = false): [boolean, () => void] {
  const [v, set] = useState(init)
  return [v, () => set((x) => !x)]
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {children}
    </div>
  )
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={title}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <b>{title}</b>
          <button className="close-btn" onClick={onClose} aria-label="Schließen">✕</button>
        </div>
        {children}
      </div>
    </>
  )
}

export function FullSheet({ title, onClose, children, footer, className = '' }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <div className={`fullsheet ${className}`} role="dialog" aria-label={title}>
      <div className="fullsheet-inner">
        <div className="form-head">
          <button className="close-btn" onClick={onClose} aria-label="Schließen">✕</button>
          <b>{title}</b>
        </div>
        {children}
      </div>
      {footer && <div className="save-bar">{footer}</div>}
    </div>
  )
}

export function Dot({ color }: { color: string }) {
  return <i className="dot" style={{ background: color }} />
}

export function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="bar">
      <div style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  )
}
