import { createContext, useContext, useEffect, useState } from 'react'
import { useData } from './data/store'
import type { Activity, ISODate, PlannedSession } from './data/types'
import { IconPlan, IconRun, IconStrength, IconToday } from './components/icons'
import { Today } from './screens/Today'
import { Running } from './screens/Running'
import { Strength } from './screens/Strength'
import { PlanScreen } from './screens/Plan'
import { AddSheet } from './screens/AddSheet'
import { RunForm } from './screens/RunForm'
import { StrengthForm } from './screens/StrengthForm'
import { TestForm } from './screens/TestForm'

export type Tab = 'heute' | 'laufen' | 'kraft' | 'plan'

export type Overlay =
  | { kind: 'add' }
  | { kind: 'run'; date?: ISODate; planned?: PlannedSession; edit?: Activity }
  | { kind: 'strength'; date?: ISODate; planned?: PlannedSession; edit?: Activity }
  | { kind: 'test'; edit?: Activity }

interface Nav {
  tab: Tab
  go: (t: Tab) => void
  open: (o: Overlay) => void
  close: () => void
}

const NavCtx = createContext<Nav | null>(null)
export const useNav = () => {
  const v = useContext(NavCtx)
  if (!v) throw new Error('useNav außerhalb von App')
  return v
}

const TABS: { id: Tab; label: string; Icon: typeof IconToday }[] = [
  { id: 'heute', label: 'Heute', Icon: IconToday },
  { id: 'laufen', label: 'Laufen', Icon: IconRun },
  { id: 'kraft', label: 'Kraft', Icon: IconStrength },
  { id: 'plan', label: 'Plan', Icon: IconPlan },
]

function initialTab(): Tab {
  const t = new URLSearchParams(location.search).get('tab')
  return t === 'laufen' || t === 'kraft' || t === 'plan' ? t : 'heute'
}

export default function App() {
  const { ready } = useData()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [overlay, setOverlay] = useState<Overlay | null>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab])

  const nav: Nav = { tab, go: setTab, open: setOverlay, close: () => setOverlay(null) }

  return (
    <NavCtx.Provider value={nav}>
      <div className="app">
        {ready && (
          <>
            {tab === 'heute' && <Today />}
            {tab === 'laufen' && <Running />}
            {tab === 'kraft' && <Strength />}
            {tab === 'plan' && <PlanScreen />}
          </>
        )}
        <div className="tabbar-fade" />
        <nav className="tabbar" aria-label="Bereiche">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}>
              <Icon color={tab === id ? '#f2f4f4' : '#99a'} />
              {label}
            </button>
          ))}
        </nav>
      </div>
      {overlay?.kind === 'add' && <AddSheet />}
      {overlay?.kind === 'run' && <RunForm date={overlay.date} planned={overlay.planned} edit={overlay.edit} />}
      {overlay?.kind === 'strength' && <StrengthForm date={overlay.date} planned={overlay.planned} edit={overlay.edit} />}
      {overlay?.kind === 'test' && <TestForm edit={overlay.edit} />}
    </NavCtx.Provider>
  )
}
