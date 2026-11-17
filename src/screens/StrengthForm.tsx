import { useState } from 'react'
import { useNav } from '../App'
import { useData } from '../data/store'
import { deleteActivity, saveActivity } from '../data/db'
import type { Activity, ExerciseEntry, ISODate, Muscle, Plan, PlannedSession, StrengthActivity } from '../data/types'
import { MUSCLES } from '../data/types'
import { FullSheet } from '../components/ui'
import { fmtDayFull, fmtDayShort } from '../lib/dates'
import { fmtKg, parseDecimal, uid } from '../lib/format'
import { plannedSets, sessionsOn, workoutById } from '../lib/plan'
import { lastExercise, topSet } from '../lib/stats'

interface Row {
  reps: string
  kg: string
  rir: string
}
interface Ex {
  name: string
  muscle: Muscle
  target?: string
  rows: Row[]
}

const firstNum = (s: string) => {
  const m = s.match(/\d+/)
  return m ? m[0] : ''
}

function buildExercises(plan: Plan, workoutId: string, planned: PlannedSession | undefined, acts: Activity[], day: ISODate): Ex[] {
  const wo = workoutById(plan, workoutId)
  if (!wo) return []
  return wo.exercises
    .filter((e) => !e.optional)
    .map((e) => {
      const n = plannedSets(e.sets, planned?.workoutId === workoutId ? planned : undefined)
      const last = lastExercise(acts, e.name, day)
      const rows: Row[] = Array.from({ length: n }, (_, i) => {
        const l = last?.sets[Math.min(i, last.sets.length - 1)]
        return { reps: l ? String(l.reps) : firstNum(e.reps), kg: l ? fmtKg(l.kg) : '', rir: firstNum(e.rir) }
      })
      return { name: e.name, muscle: e.muscle, target: `${n} × ${e.reps} · RIR ${e.rir}`, rows }
    })
}

export function StrengthForm({ date, planned, edit }: { date?: ISODate; planned?: PlannedSession; edit?: Activity }) {
  const nav = useNav()
  const { plan, activities, today, toast } = useData()
  const e = edit as StrengthActivity | undefined
  const [day, setDay] = useState<ISODate>(e?.date ?? date ?? today)
  const initialWo = e?.workoutId ?? planned?.workoutId ?? sessionsOn(plan, day).find((s) => s.kind === 'strength')?.workoutId ?? plan.workouts[0]?.id ?? ''
  const [wo, setWo] = useState<string>(e ? e.workoutId ?? '' : initialWo)
  const [exs, setExs] = useState<Ex[]>(() =>
    e
      ? e.exercises.map((x) => ({ name: x.name, muscle: x.muscle, rows: x.sets.map((s) => ({ reps: String(s.reps), kg: fmtKg(s.kg), rir: s.rir !== undefined ? String(s.rir) : '' })) }))
      : buildExercises(plan, initialWo, planned, activities, day),
  )
  const [open, setOpen] = useState<number | null>(null)
  const [dur, setDur] = useState(e ? String(e.durationMin) : '')
  const [note, setNote] = useState(e?.note ?? '')
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newMuscle, setNewMuscle] = useState<Muscle>('ruecken')

  const plannedToday = sessionsOn(plan, day).find((s) => s.kind === 'strength')
  const counts = (r: Row) => Number(r.reps) > 0 && r.kg.trim() !== ''
  const totalSets = exs.reduce((n, x) => n + x.rows.filter(counts).length, 0)
  const valid = totalSets > 0 && Number(dur) > 0

  const pickWorkout = (id: string) => {
    setWo(id)
    setOpen(null)
    setExs(id ? buildExercises(plan, id, planned, activities, day) : [])
  }

  const setRow = (i: number, j: number, patch: Partial<Row>) =>
    setExs((xs) => xs.map((x, k) => (k !== i ? x : { ...x, rows: x.rows.map((r, m) => (m === j ? { ...r, ...patch } : r)) })))

  const addRow = (i: number) =>
    setExs((xs) => xs.map((x, k) => (k !== i ? x : { ...x, rows: [...x.rows, { ...(x.rows[x.rows.length - 1] ?? { reps: '', kg: '', rir: '' }) }] })))

  const delRow = (i: number, j: number) => setExs((xs) => xs.map((x, k) => (k !== i ? x : { ...x, rows: x.rows.filter((_, m) => m !== j) })))

  const delEx = (i: number) => {
    setExs((xs) => xs.filter((_, k) => k !== i))
    setOpen(null)
  }

  const addEx = () => {
    if (!newName.trim()) return
    setExs((xs) => [...xs, { name: newName.trim(), muscle: newMuscle, rows: [{ reps: '', kg: '', rir: '' }] }])
    setOpen(exs.length)
    setNewName('')
    setAdding(false)
  }

  const save = async () => {
    if (!valid) return
    const exercises: ExerciseEntry[] = exs
      .map((x) => ({
        name: x.name,
        muscle: x.muscle,
        sets: x.rows
          .filter(counts)
          .map((r) => ({ reps: Number(r.reps), kg: parseDecimal(r.kg) ?? 0, rir: r.rir === '' ? undefined : Number(r.rir) })),
      }))
      .filter((x) => x.sets.length)
    const title = workoutById(plan, wo)?.name ?? 'Krafttraining'
    await saveActivity({
      id: e?.id ?? uid(),
      kind: 'strength',
      date: day,
      createdAt: e?.createdAt ?? Date.now(),
      workoutId: wo || undefined,
      title,
      durationMin: Number(dur),
      exercises,
      note: note.trim() || undefined,
      planned: plannedToday?.title,
    })
    toast(e ? 'Änderung gespeichert' : 'Krafteinheit gespeichert')
    nav.close()
  }

  const remove = async () => {
    if (!e || !confirm('Diese Krafteinheit löschen?')) return
    await deleteActivity(e.id)
    toast('Eintrag gelöscht')
    nav.close()
  }

  return (
    <FullSheet
      className="str-form"
      title={e ? 'Krafteinheit bearbeiten' : 'Krafteinheit eintragen'}
      onClose={nav.close}
      footer={<button className="btn-primary" disabled={!valid} onClick={save}>Krafteinheit speichern</button>}
    >
      <div className="form-label">Einheit</div>
      <div className="chips str wrap3">
        {plan.workouts.map((w) => (
          <button key={w.id} className={`chip ${wo === w.id ? 'on' : ''}`} onClick={() => pickWorkout(w.id)}>{w.name}</button>
        ))}
        <button className={`chip ${wo === '' ? 'on' : ''}`} onClick={() => pickWorkout('')}>Frei</button>
      </div>

      <div className="fields" style={{ marginTop: 16 }}>
        <div className="field">
          <label htmlFor="dur">Dauer</label>
          <div className="field-in">
            <input id="dur" inputMode="numeric" placeholder="45" value={dur} onChange={(x) => setDur(x.target.value.replace(/\D/g, ''))} />
            <span>min</span>
          </div>
        </div>
        <div className="field" style={{ background: 'var(--card)' }}>
          <label>Sätze</label>
          <div className="field-in">
            <b className="num" style={{ font: '700 26px var(--font)', letterSpacing: '-.02em' }}>{totalSets}</b>
            <span>gesamt</span>
          </div>
        </div>
      </div>

      <div className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Übungen</span>
        <span>{exs.length}</span>
      </div>
      <div className="hint" style={{ margin: '-4px 4px 4px' }}>Ein Satz zählt, sobald Gewicht eingetragen ist. Bei Körpergewicht 0 eintragen.</div>
      {exs.map((x, i) => {
        const filled = x.rows.filter(counts)
        const top = topSet(filled.map((r) => ({ reps: Number(r.reps), kg: parseDecimal(r.kg) ?? 0 })))
        const last = lastExercise(activities, x.name, day)
        const lastTop = last ? topSet(last.sets) : null
        return (
          <div className="ex" key={i}>
            <button className="ex-head" onClick={() => setOpen(open === i ? null : i)}>
              <div className="row-main">
                <b>{x.name}</b>
                <span style={{ font: '400 11px var(--font)', color: 'var(--text-2)' }}>
                  {x.target ?? MUSCLES.find((m) => m.id === x.muscle)?.name}
                  {lastTop ? ` · zuletzt ${fmtKg(lastTop.kg)} kg` : ''}
                </span>
              </div>
              <span className="num" style={{ font: '600 13px var(--font)', whiteSpace: 'nowrap' }}>
                {filled.length ? `${filled.length} × ${top!.reps}${top!.kg ? ` · ${fmtKg(top!.kg)} kg` : ''}` : <span style={{ color: 'var(--faint)' }}>offen</span>}
              </span>
              <span style={{ color: 'var(--faint)', transform: open === i ? 'rotate(90deg)' : 'none', transition: 'transform .18s' }}>›</span>
            </button>
            {open === i && (
              <div className="ex-body">
                <div className="set-grid">
                  <span className="h">SATZ</span>
                  <span className="h">WDH.</span>
                  <span className="h">KG</span>
                  <span className="h">RIR</span>
                  <span />
                  {x.rows.map((r, j) => (
                    <Fragment4 key={j}>
                      <span className="n">{j + 1}</span>
                      <input inputMode="numeric" value={r.reps} onChange={(ev) => setRow(i, j, { reps: ev.target.value.replace(/\D/g, '') })} aria-label={`Satz ${j + 1} Wiederholungen`} />
                      <input inputMode="decimal" value={r.kg} onChange={(ev) => setRow(i, j, { kg: ev.target.value })} aria-label={`Satz ${j + 1} Gewicht`} />
                      <input inputMode="numeric" value={r.rir} onChange={(ev) => setRow(i, j, { rir: ev.target.value.replace(/\D/g, '') })} aria-label={`Satz ${j + 1} RIR`} />
                      <button className="x" onClick={() => delRow(i, j)} aria-label={`Satz ${j + 1} entfernen`}>✕</button>
                    </Fragment4>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                  <button style={{ font: '600 12px var(--font)', color: 'var(--str)' }} onClick={() => addRow(i)}>+ Satz</button>
                  <button style={{ font: '500 12px var(--font)', color: 'var(--text-2)' }} onClick={() => delEx(i)}>Übung entfernen</button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {adding ? (
        <div className="list-box">
          <div className="list-row">
            <label htmlFor="exname">Name</label>
            <input id="exname" placeholder="z. B. Face Pull" value={newName} onChange={(x) => setNewName(x.target.value)} autoFocus />
          </div>
          <div className="list-row">
            <label htmlFor="exmuscle">Muskelgruppe</label>
            <select id="exmuscle" value={newMuscle} onChange={(x) => setNewMuscle(x.target.value as Muscle)}>
              {MUSCLES.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="list-row" style={{ justifyContent: 'flex-end', gap: 16 }}>
            <button style={{ color: 'var(--text-2)' }} onClick={() => setAdding(false)}>Abbrechen</button>
            <button style={{ color: 'var(--str)', fontWeight: 600 }} onClick={addEx}>Hinzufügen</button>
          </div>
        </div>
      ) : (
        <button className="add-dashed" onClick={() => setAdding(true)}>+ Übung hinzufügen</button>
      )}

      <div className="list-box">
        <div className="list-row">
          <label htmlFor="day">Datum</label>
          <span style={{ position: 'relative' }}>
            <b>{fmtDayFull(day)}</b>
            <input id="day" type="date" value={day} max={today} onChange={(x) => x.target.value && setDay(x.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%' }} />
          </span>
        </div>
      </div>

      <div className="list-box" style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ font: '500 11px var(--font)', color: 'var(--text-2)' }}>Geplante Einheit</div>
            <div style={{ font: '600 13px var(--font)', marginTop: 4 }}>{plannedToday ? `${plannedToday.title} · ${fmtDayShort(day)}` : 'Keine geplant'}</div>
          </div>
          {plannedToday && <span className="pill done-str">Zugeordnet</span>}
        </div>
      </div>

      <textarea className="note-box" placeholder="Notiz hinzufügen" value={note} onChange={(x) => setNote(x.target.value)} />

      {e && (
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <button className="btn-danger" onClick={remove}>Eintrag löschen</button>
        </div>
      )}
    </FullSheet>
  )
}

function Fragment4({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
