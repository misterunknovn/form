import { useState } from 'react'
import { useNav } from '../App'
import { useData } from '../data/store'
import { deleteActivity, saveActivity } from '../data/db'
import type { Activity, ISODate, TestActivity } from '../data/types'
import { Delta, FullSheet } from '../components/ui'
import { fmtDayFull } from '../lib/dates'
import { fmtDuration, fmtPace, parseDuration, uid } from '../lib/format'
import { paceRefs, vdot as calcVdot } from '../lib/running'
import { currentVdot } from '../lib/stats'

const DISTS = [
  { km: 5, label: '5 km' },
  { km: 10, label: '10 km' },
  { km: 21.0975, label: '21,1 km' },
  { km: 42.195, label: '42,2 km' },
]

export function TestForm({ edit }: { edit?: Activity }) {
  const nav = useNav()
  const { activities, today, toast } = useData()
  const e = edit as TestActivity | undefined
  const [km, setKm] = useState(e?.distanceKm ?? 5)
  const [time, setTime] = useState(e ? fmtDuration(e.durationSec) : '')
  const [day, setDay] = useState<ISODate>(e?.date ?? today)
  const [note, setNote] = useState(e?.note ?? 'Laufband, 1 % Steigung')

  const sec = parseDuration(time)
  const v = sec ? calcVdot(km, sec) : null
  const prev = currentVdot(activities.filter((a) => a.id !== e?.id), day)
  const refs = v ? paceRefs(v) : null
  const prevRefs = prev ? paceRefs(prev.vdot) : null

  const save = async () => {
    if (!sec || !v) return
    await saveActivity({ id: e?.id ?? uid(), kind: 'test', date: day, createdAt: e?.createdAt ?? Date.now(), distanceKm: km, durationSec: sec, vdot: v, note: note.trim() || undefined })
    toast(`Test gespeichert · VDOT ${v.toFixed(1).replace('.', ',')}`)
    nav.close()
  }

  const remove = async () => {
    if (!e || !confirm('Diesen Test löschen?')) return
    await deleteActivity(e.id)
    toast('Test gelöscht')
    nav.close()
  }

  const rows: { name: string; v: string; cur: number; old?: number }[] = refs
    ? [
        { name: 'Easy', v: `${fmtPace(refs.easy[0])}–${fmtPace(refs.easy[1])}`, cur: refs.easy[0], old: prevRefs?.easy[0] },
        { name: 'Schwelle', v: fmtPace(refs.schwelle), cur: refs.schwelle, old: prevRefs?.schwelle },
        { name: 'Intervall', v: fmtPace(refs.intervall), cur: refs.intervall, old: prevRefs?.intervall },
        { name: 'Renntempo HM', v: fmtPace(refs.renntempo), cur: refs.renntempo, old: prevRefs?.renntempo },
      ]
    : []

  return (
    <FullSheet
      title={e ? 'Test bearbeiten' : 'Leistungstest eintragen'}
      onClose={nav.close}
      footer={<button className="btn-primary" disabled={!v} onClick={save}>Test speichern</button>}
    >
      <div className="form-label">Testdistanz</div>
      <div className="chips">
        {DISTS.map((d) => (
          <button key={d.km} className={`chip ${km === d.km ? 'on' : ''}`} onClick={() => setKm(d.km)}>{d.label}</button>
        ))}
      </div>

      <div className="fields" style={{ marginTop: 16 }}>
        <div className="field">
          <label htmlFor="time">Zeit</label>
          <div className="field-in">
            <input id="time" inputMode="numeric" placeholder="22:40" value={time} onChange={(x) => setTime(x.target.value)} />
            <span>min</span>
          </div>
        </div>
        <div className="field">
          <label>Ø Pace</label>
          <div className="field-in">
            <b className="num" style={{ font: '700 26px var(--font)', letterSpacing: '-.02em' }}>{sec ? fmtPace(sec / km) : '–'}</b>
            <span>/km</span>
          </div>
        </div>
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

      <div className="list-box" style={{ padding: '12px 14px' }}>
        <div style={{ font: '500 11px var(--font)', color: 'var(--text-2)' }}>Neue VDOT</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <b className="num" style={{ font: '700 26px var(--font)' }}>{v ? v.toFixed(1).replace('.', ',') : '–'}</b>
          {v && prev && <Delta up={v > prev.vdot} good={v >= prev.vdot}>{(Math.abs(v - prev.vdot)).toFixed(1).replace('.', ',')}</Delta>}
        </div>
        {refs && (
          <>
            <div className="section-label">Neue Pace-Referenzen</div>
            <div className="rows">
              {rows.map((r) => {
                const d = r.old ? Math.round(r.cur - r.old) : null
                return (
                  <div key={r.name} className="row" style={{ padding: '9px 0' }}>
                    <i className="dot" style={{ background: 'var(--run-deep)' }} />
                    <span className="row-main" style={{ font: '600 13px var(--font)' }}>{r.name}</span>
                    <span className="num" style={{ font: '600 13px var(--font)' }}>{r.v} <small style={{ color: 'var(--text-2)', fontWeight: 500 }}>/km</small></span>
                    {d !== null && d !== 0 && <Delta up={d > 0} good={d < 0}>{Math.abs(d)} s</Delta>}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
      <div className="hint">Der Test sollte ein maximaler Einsatz auf flacher Strecke sein. Die Pace-Referenzen werden nach dem Speichern aktualisiert.</div>

      <textarea className="note-box" placeholder="Notiz" value={note} onChange={(x) => setNote(x.target.value)} />

      {e && (
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <button className="btn-danger" onClick={remove}>Test löschen</button>
        </div>
      )}
    </FullSheet>
  )
}
