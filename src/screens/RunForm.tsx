import { useRef, useState } from 'react'
import { useNav } from '../App'
import { useData } from '../data/store'
import { deleteActivity, saveActivity } from '../data/db'
import type { Activity, BikeActivity, ISODate, PlannedSession, RunActivity, RunType } from '../data/types'
import { FullSheet } from '../components/ui'
import { fmtDayFull, fmtDayShort } from '../lib/dates'
import { fmtDuration, fmtKm, fmtPace, parseDecimal, parseDuration, uid } from '../lib/format'
import { sessionsOn } from '../lib/plan'
import { readRunFile } from '../lib/importFile'

const TYPES: { id: RunType | 'rad'; label: string }[] = [
  { id: 'easy', label: 'Easy' },
  { id: 'intervall', label: 'Intervall' },
  { id: 'schwelle', label: 'Schwelle' },
  { id: 'long', label: 'Long Run' },
  { id: 'rennen', label: 'Rennen' },
  { id: 'rad', label: 'Rad' },
]

export function RunForm({ date, planned, edit }: { date?: ISODate; planned?: PlannedSession; edit?: Activity }) {
  const nav = useNav()
  const { plan, shoes, today, toast } = useData()
  const e = edit as RunActivity | BikeActivity | undefined
  const [type, setType] = useState<RunType | 'rad'>(
    e ? (e.kind === 'bike' ? 'rad' : e.runType) : planned?.kind === 'bike' ? 'rad' : planned?.runType && planned.runType !== 'test' ? planned.runType : 'easy',
  )
  const [day, setDay] = useState<ISODate>(e?.date ?? date ?? today)
  const [dist, setDist] = useState(e?.kind === 'run' ? fmtKm(e.distanceKm) : '')
  const [dur, setDur] = useState(e ? fmtDuration(e.durationSec) : '')
  const [hr, setHr] = useState(e?.avgHr ? String(e.avgHr) : '')
  const [effort, setEffort] = useState(e?.kind === 'run' ? e.effort ?? 3 : 3)
  const [shoeId, setShoeId] = useState(e?.kind === 'run' ? e.shoeId ?? '' : shoes.find((s) => !s.retired)?.id ?? '')
  const [note, setNote] = useState(e?.note ?? '')
  const [source, setSource] = useState<RunActivity['source']>(e?.kind === 'run' ? e.source : 'manuell')
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const isBike = type === 'rad'
  const km = parseDecimal(dist)
  const sec = parseDuration(dur)
  const pace = km && sec ? sec / km : null
  const plannedToday = sessionsOn(plan, day).find((s) => (isBike ? s.kind === 'bike' : s.kind === 'run'))
  const valid = isBike ? !!sec : !!km && !!sec && km > 0 && sec > 0

  const onFile = async (f?: File) => {
    if (!f) return
    setErr(null)
    try {
      const r = await readRunFile(f)
      setDist(fmtKm(r.distanceKm))
      setDur(fmtDuration(r.durationSec))
      if (r.avgHr) setHr(String(r.avgHr))
      setDay(r.date)
      setSource(r.source)
      toast('Datei eingelesen')
    } catch (x) {
      setErr((x as Error).message)
    }
  }

  const save = async () => {
    if (!valid || !sec) return
    const base = { id: e?.id ?? uid(), date: day, createdAt: e?.createdAt ?? Date.now(), note: note.trim() || undefined, planned: plannedToday?.title }
    const avgHr = hr ? Number(hr) || undefined : undefined
    if (isBike) {
      await saveActivity({ ...base, kind: 'bike', durationSec: sec, avgHr })
    } else {
      const title = plannedToday?.runType === type && plannedToday.steps?.find((s) => s.key)?.name
      await saveActivity({
        ...base,
        kind: 'run',
        runType: type,
        title: (e?.kind === 'run' ? e.title : undefined) ?? (title || undefined),
        distanceKm: km!,
        durationSec: sec,
        avgHr,
        effort,
        shoeId: shoeId || undefined,
        source,
      })
    }
    toast(e ? 'Änderung gespeichert' : isBike ? 'Rad gespeichert' : 'Lauf gespeichert')
    nav.close()
  }

  const remove = async () => {
    if (!e || !confirm('Diesen Eintrag löschen?')) return
    await deleteActivity(e.id)
    toast('Eintrag gelöscht')
    nav.close()
  }

  return (
    <FullSheet
      title={e ? 'Eintrag bearbeiten' : isBike ? 'Rad eintragen' : 'Lauf eintragen'}
      onClose={nav.close}
      footer={<button className="btn-primary" disabled={!valid} onClick={save}>{isBike ? 'Rad speichern' : 'Lauf speichern'}</button>}
    >
      <div className="form-label">Typ</div>
      <div className="chips">
        {TYPES.map((t) => (
          <button key={t.id} className={`chip ${type === t.id ? 'on' : ''}`} onClick={() => setType(t.id)}>{t.label}</button>
        ))}
      </div>

      <div className="fields" style={{ marginTop: 16 }}>
        {!isBike && (
          <div className="field">
            <label htmlFor="dist">Distanz</label>
            <div className="field-in">
              <input id="dist" inputMode="decimal" placeholder="10,2" value={dist} onChange={(x) => setDist(x.target.value)} />
              <span>km</span>
            </div>
          </div>
        )}
        <div className="field">
          <label htmlFor="dur">Dauer</label>
          <div className="field-in">
            <input id="dur" inputMode="numeric" placeholder={isBike ? '40' : '52:10'} value={dur} onChange={(x) => setDur(x.target.value)} />
            <span>{isBike ? 'min' : 'min'}</span>
          </div>
        </div>
      </div>
      {!isBike && <div className="hint">Dauer als 52:10 (Minuten:Sekunden) oder 1:05:30 eingeben.</div>}

      <div className="list-box">
        {!isBike && (
          <div className="list-row">
            <span>Ø Pace (min/km)</span>
            <b>{pace ? fmtPace(pace) : '–'}</b>
          </div>
        )}
        <div className="list-row">
          <label htmlFor="hr">Ø Puls (bpm)</label>
          <input id="hr" inputMode="numeric" placeholder="–" value={hr} onChange={(x) => setHr(x.target.value.replace(/\D/g, ''))} />
        </div>
        {!isBike && (
          <div className="list-row">
            <span>Anstrengung</span>
            <div className="effort" role="radiogroup" aria-label="Anstrengung">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={n <= effort ? 'on' : ''} onClick={() => setEffort(n)} aria-label={`${n} von 5`} />
              ))}
            </div>
          </div>
        )}
        {!isBike && shoes.length > 0 && (
          <div className="list-row">
            <label htmlFor="shoe">Schuh</label>
            <select id="shoe" value={shoeId} onChange={(x) => setShoeId(x.target.value)}>
              <option value="">Kein Schuh</option>
              {shoes.filter((s) => !s.retired || s.id === shoeId).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

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
          {plannedToday && <span className="pill done-run">Zugeordnet</span>}
        </div>
      </div>

      {!isBike && !e && (
        <>
          <button className="add-dashed" onClick={() => fileRef.current?.click()}>Aus Datei importieren (GPX, TCX)</button>
          <input ref={fileRef} type="file" accept=".gpx,.tcx,application/gpx+xml,application/xml,text/xml" hidden onChange={(x) => onFile(x.target.files?.[0])} />
        </>
      )}
      {err && <div className="error">{err}</div>}

      <textarea className="note-box" placeholder="Notiz hinzufügen, z. B. Ferse, Wetter, Gefühl" value={note} onChange={(x) => setNote(x.target.value)} />

      {e && (
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <button className="btn-danger" onClick={remove}>Eintrag löschen</button>
        </div>
      )}
    </FullSheet>
  )
}
