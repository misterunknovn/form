// Lokale Datenbank (IndexedDB über Dexie). Alle Zugriffe laufen über die
// Funktionen in diesem Modul, damit später ein Supabase-Backend dieselbe
// Schnittstelle bedienen kann.

import Dexie, { type Table } from 'dexie'
import type { Activity, Plan, Settings, Shoe } from './types'
import { SEED_PLAN } from './seedPlan'

export interface StoredPlan {
  id?: number
  savedAt: number
  note: string
  plan: Plan
}

interface KV {
  key: string
  value: unknown
}

class FormDB extends Dexie {
  activities!: Table<Activity, string>
  plans!: Table<StoredPlan, number>
  shoes!: Table<Shoe, string>
  kv!: Table<KV, string>

  constructor() {
    super('form')
    this.version(1).stores({
      activities: 'id, date, kind',
      plans: '++id, savedAt',
      shoes: 'id',
      kv: 'key',
    })
  }
}

export const db = new FormDB()

// ---------- Plan ----------

export async function getActivePlan(): Promise<Plan> {
  const last = await db.plans.orderBy('savedAt').last()
  return last?.plan ?? SEED_PLAN
}

export async function savePlan(plan: Plan, note: string): Promise<void> {
  await db.plans.add({ savedAt: Date.now(), note, plan })
}

export async function planHistory(): Promise<StoredPlan[]> {
  return db.plans.orderBy('savedAt').reverse().toArray()
}

/** Letzten Planimport rückgängig machen */
export async function undoPlan(): Promise<boolean> {
  const last = await db.plans.orderBy('savedAt').last()
  if (!last?.id) return false
  await db.plans.delete(last.id)
  return true
}

// ---------- Einheiten ----------

export async function saveActivity(a: Activity): Promise<void> {
  await db.activities.put(a)
}

export async function deleteActivity(id: string): Promise<void> {
  await db.activities.delete(id)
}

// ---------- Schuhe ----------

export async function saveShoe(s: Shoe): Promise<void> {
  await db.shoes.put(s)
}

export async function deleteShoe(id: string): Promise<void> {
  await db.shoes.delete(id)
}

// ---------- Einstellungen ----------

export async function getSettings(): Promise<Settings> {
  const row = await db.kv.get('settings')
  return (row?.value as Settings) ?? {}
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const cur = await getSettings()
  await db.kv.put({ key: 'settings', value: { ...cur, ...patch } })
}

// ---------- Sicherung ----------

export interface Backup {
  format: 'form-backup'
  version: 1
  exportedAt: string
  activities: Activity[]
  plans: StoredPlan[]
  shoes: Shoe[]
  settings: Settings
}

export async function exportBackup(): Promise<Backup> {
  return {
    format: 'form-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    activities: await db.activities.toArray(),
    plans: await db.plans.toArray(),
    shoes: await db.shoes.toArray(),
    settings: await getSettings(),
  }
}

export async function importBackup(b: Backup): Promise<void> {
  if (b?.format !== 'form-backup') throw new Error('Das ist keine Sicherung aus Form.')
  await db.transaction('rw', [db.activities, db.plans, db.shoes, db.kv], async () => {
    await Promise.all([db.activities.clear(), db.plans.clear(), db.shoes.clear(), db.kv.clear()])
    await db.activities.bulkPut(b.activities ?? [])
    await db.plans.bulkPut((b.plans ?? []).map((p) => ({ savedAt: p.savedAt, note: p.note, plan: p.plan })))
    await db.shoes.bulkPut(b.shoes ?? [])
    await db.kv.put({ key: 'settings', value: b.settings ?? {} })
  })
}
