import { createContext, useContext, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Activity, ISODate, Plan, Settings, Shoe } from './types'
import { db, getActivePlan, getSettings } from './db'
import { SEED_PLAN } from './seedPlan'
import { today as todayISO } from '../lib/dates'

interface Data {
  plan: Plan
  activities: Activity[]
  shoes: Shoe[]
  settings: Settings
  today: ISODate
  ready: boolean
  toast: (msg: string) => void
}

const Ctx = createContext<Data | null>(null)

/** Für Vorschau und Tests: ?heute=2026-11-19 setzt das aktuelle Datum */
function resolveToday(): ISODate {
  const q = new URLSearchParams(location.search).get('heute')
  return q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : todayISO()
}

export function DataProvider({ children }: { children: ReactNode }) {
  const plan = useLiveQuery(getActivePlan, [], undefined)
  const activities = useLiveQuery(() => db.activities.toArray(), [], undefined)
  const shoes = useLiveQuery(() => db.shoes.toArray(), [], undefined)
  const settings = useLiveQuery(getSettings, [], undefined)
  const [msg, setMsg] = useState<string | null>(null)
  const [today] = useState(resolveToday)

  const toast = (m: string) => {
    setMsg(m)
    window.setTimeout(() => setMsg((cur) => (cur === m ? null : cur)), 2600)
  }

  const value: Data = {
    plan: plan ?? SEED_PLAN,
    activities: activities ?? [],
    shoes: shoes ?? [],
    settings: settings ?? {},
    today,
    ready: plan !== undefined && activities !== undefined,
    toast,
  }
  return (
    <Ctx.Provider value={value}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </Ctx.Provider>
  )
}

export function useData(): Data {
  const v = useContext(Ctx)
  if (!v) throw new Error('useData außerhalb von DataProvider')
  return v
}
