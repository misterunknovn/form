// Eigene Linien-Icons (20 px, Strich 1.8, runde Enden) wie im Design.

interface P {
  size?: number
  color?: string
}

const base = (size: number, color: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: color,
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  style: { flex: 'none' },
})

export const IconToday = ({ size = 20, color = 'currentColor' }: P) => (
  <svg {...base(size, color)}>
    <rect x="2.5" y="4" width="15" height="13" rx="3" />
    <path d="M2.5 8h15M7 2.5v3M13 2.5v3" />
    <circle cx="10" cy="12.5" r="1.4" fill={color} />
  </svg>
)

export const IconRun = ({ size = 20, color = 'currentColor' }: P) => (
  <svg {...base(size, color)}>
    <path d="M4 17V13M8 17V10M12 17V7M16 17V3.5" />
  </svg>
)

export const IconStrength = ({ size = 20, color = 'currentColor' }: P) => (
  <svg {...base(size, color)}>
    <path d="M6 10h8" />
    <rect x="3" y="6" width="3" height="8" rx="1" />
    <rect x="14" y="6" width="3" height="8" rx="1" />
    <path d="M1.5 8.5v3M18.5 8.5v3" />
  </svg>
)

export const IconPlan = ({ size = 20, color = 'currentColor' }: P) => (
  <svg {...base(size, color)}>
    <path d="M8 5h9M8 10h9M8 15h9" />
    <path d="M3 5l1 1 2-2M3 10l1 1 2-2M3 15l1 1 2-2" />
  </svg>
)

export const IconPlus = ({ size = 20, color = '#0d0e0e' }: P) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round">
    <path d="M10 3.5v13M3.5 10h13" />
  </svg>
)

export const IconPulse = ({ size = 20, color = 'currentColor' }: P) => (
  <svg {...base(size, color)}>
    <path d="M2 10h3.5l2-4.5 3.5 9 2-4.5H18" />
  </svg>
)

export const IconStopwatch = ({ size = 20, color = 'currentColor' }: P) => (
  <svg {...base(size, color)}>
    <circle cx="10" cy="11" r="6.5" />
    <path d="M10 11V8M8 2.5h4" />
  </svg>
)

export const IconBike = ({ size = 20, color = 'currentColor' }: P) => (
  <svg {...base(size, color)}>
    <circle cx="5" cy="13" r="3.2" />
    <circle cx="15" cy="13" r="3.2" />
    <path d="M5 13l3.5-6H13l2 6M8.5 7L11 13M11.5 4.5H14" />
  </svg>
)

export const IconSpark = ({ size = 20, color = 'currentColor' }: P) => (
  <svg {...base(size, color)}>
    <path d="M10 2.5v4M10 13.5v4M2.5 10h4M13.5 10h4M4.7 4.7l2.6 2.6M12.7 12.7l2.6 2.6M4.7 15.3l2.6-2.6M12.7 7.3l2.6-2.6" />
  </svg>
)

/** Kopfzeilen-Icon „Laufen“: Balken in Cyan-Abstufung */
export const HeaderRun = () => (
  <svg width="26" height="26" viewBox="0 0 20 20" fill="none" strokeWidth={2.2} strokeLinecap="round" style={{ flex: 'none' }}>
    <path d="M4 17V13" stroke="#0c8282" />
    <path d="M8 17V10" stroke="#12b0b0" />
    <path d="M12 17V7" stroke="#19e6e6" />
    <path d="M16 17V3.5" stroke="#a6f5f5" />
  </svg>
)

/** Kopfzeilen-Icon „Kraft“: Hantel in Violett */
export const HeaderStrength = () => (
  <svg width="28" height="28" viewBox="0 0 20 20" fill="none" stroke="#a99bff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
    <path d="M6 10h8" />
    <rect x="3" y="6" width="3" height="8" rx="1" />
    <rect x="14" y="6" width="3" height="8" rx="1" />
    <path d="M1.5 8.5v3M18.5 8.5v3" />
  </svg>
)
