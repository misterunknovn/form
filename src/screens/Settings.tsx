import { useRef, useState } from 'react'
import { useNav } from '../App'
import { useData } from '../data/store'
import { countExisting, exportBackup, importBackup, planHistory, saveActivities, savePlan, undoPlan, updateSettings, type Backup } from '../data/db'
import { importCsv, summarize, type CsvImport } from '../lib/importCsv'
import type { Plan } from '../data/types'
import { Card, CardHead, FullSheet } from '../components/ui'
import { buildClaudeExport, diffPlans, extractJson, validatePlan, type PlanDiff } from '../lib/claude'
import { fmtDate, fmtDayShort } from '../lib/dates'

// ---------------- Claude ----------------

export function ClaudeSheet({ mode, onClose }: { mode: 'export' | 'import'; onClose: () => void }) {
  return mode === 'export' ? <ExportSheet onClose={onClose} /> : <ImportSheet onClose={onClose} />
}

const QUESTIONS = [
  'Bitte analysiere meine letzten Einheiten im Vergleich zum Plan. Passe die kommenden Wochen an, wenn es nötig ist.',
  'Wie lief meine Woche? Was sollte ich nächste Woche anders machen?',
  'Ich hatte Fersenschmerzen bzw. war krank. Bitte passe die nächsten zwei Wochen an.',
  'Bitte verfeinere die nächsten vier Wochen ab heute mit konkreten Einheiten.',
]

function ExportSheet({ onClose }: { onClose: () => void }) {
  const { plan, activities, settings, today, toast } = useData()
  const [q, setQ] = useState(QUESTIONS[0])
  const [shown, setShown] = useState<string | null>(null)
  const text = () => buildClaudeExport(plan, activities, settings, today, q)

  const copy = async () => {
    const t = text()
    try {
      await navigator.clipboard.writeText(t)
      toast('Kopiert. Jetzt im Claude-Chat einfügen.')
    } catch {
      setShown(t)
    }
  }
  const share = async () => {
    try {
      await navigator.share({ title: 'Trainingsdaten aus Form', text: text() })
    } catch {
      /* abgebrochen */
    }
  }

  return (
    <FullSheet title="Für Claude kopieren" onClose={onClose}>
      <div className="hint" style={{ fontSize: 12 }}>
        Form erstellt eine Zusammenfassung deiner letzten 6 Wochen, deines Plans und deiner Frage. Füge sie im Claude-Chat ein. Wenn Claude den Plan ändert, kommt am Ende ein JSON-Block, den du über „Antwort einfügen“ übernimmst.
      </div>
      <div className="form-label">Deine Frage an Claude</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {QUESTIONS.map((x) => (
          <button key={x} onClick={() => setQ(x)} className="menu-item" style={{ padding: '10px 12px', borderColor: q === x ? 'var(--run-deep)' : undefined, background: q === x ? 'var(--run-bg)' : undefined }}>
            <span style={{ font: '500 12px/1.45 var(--font)', textAlign: 'left' }}>{x}</span>
          </button>
        ))}
      </div>
      <textarea className="note-box" value={q} onChange={(x) => setQ(x.target.value)} aria-label="Frage an Claude" />
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="btn-run" onClick={copy}>Kopieren</button>
        {'share' in navigator && <button className="btn-secondary" onClick={share}>Teilen …</button>}
      </div>
      {shown && (
        <>
          <div className="hint">Kopieren wurde vom Browser blockiert. Markiere den Text und kopiere ihn von Hand:</div>
          <textarea className="textarea-code" readOnly value={shown} style={{ marginTop: 8 }} onFocus={(e) => e.currentTarget.select()} />
        </>
      )}
    </FullSheet>
  )
}

function ImportSheet({ onClose }: { onClose: () => void }) {
  const { plan, toast } = useData()
  const [raw, setRaw] = useState('')
  const [errs, setErrs] = useState<string[]>([])
  const [candidate, setCandidate] = useState<{ plan: Plan; diff: PlanDiff } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const check = (text: string) => {
    setErrs([])
    setCandidate(null)
    try {
      const json = extractJson(text)
      const problems = validatePlan(json)
      if (problems.length) {
        setErrs(problems)
        return
      }
      const p = json as Plan
      setCandidate({ plan: p, diff: diffPlans(plan, p) })
    } catch (e) {
      setErrs([(e as Error).message])
    }
  }

  const apply = async () => {
    if (!candidate) return
    await savePlan(candidate.plan, `Import ${new Date().toLocaleDateString('de-DE')}`)
    toast('Neuer Plan übernommen')
    onClose()
  }

  const d = candidate?.diff
  return (
    <FullSheet
      title="Antwort von Claude einfügen"
      onClose={onClose}
      footer={candidate ? <button className="btn-primary" onClick={apply}>Plan übernehmen</button> : <button className="btn-primary" disabled={!raw.trim()} onClick={() => check(raw)}>Prüfen</button>}
    >
      <div className="hint" style={{ fontSize: 12 }}>Füge Claudes komplette Antwort ein. Form sucht den JSON-Block mit dem Plan und zeigt dir vor dem Übernehmen, was sich ändert. Der alte Plan bleibt gespeichert und lässt sich wiederherstellen.</div>
      <textarea className="textarea-code" style={{ marginTop: 14 }} placeholder="Antwort von Claude hier einfügen …" value={raw} onChange={(x) => { setRaw(x.target.value); setCandidate(null) }} />
      <button className="add-dashed" onClick={() => fileRef.current?.click()}>Oder Plan-Datei wählen (.json)</button>
      <input ref={fileRef} type="file" accept=".json,application/json,text/plain" hidden onChange={async (x) => { const f = x.target.files?.[0]; if (f) { const t = await f.text(); setRaw(t); check(t) } }} />
      {errs.length > 0 && (
        <div className="error">
          {errs.map((e) => <div key={e}>{e}</div>)}
          <div style={{ color: 'var(--text-2)', marginTop: 6 }}>Tipp: Bitte Claude, den vollständigen Plan im Format „form-plan“ als JSON-Block zu schicken.</div>
        </div>
      )}
      {candidate && d && (
        <div className="card" style={{ margin: '14px 0 0' }}>
          <CardHead title={candidate.plan.name} aside={`Stand ${fmtDate(candidate.plan.updated)}`} />
          <div className="rows" style={{ marginTop: 8 }}>
            <Line l="Geänderte Wochen" v={d.weeksChanged.length ? d.weeksChanged.map(fmtDayShort).join(', ') : 'keine'} />
            {(d.weeksAdded > 0 || d.weeksRemoved > 0) && <Line l="Wochen" v={`${d.weeksAdded} neu, ${d.weeksRemoved} entfernt`} />}
            <Line l="Krafteinheiten" v={d.workoutsChanged.length ? d.workoutsChanged.join(', ') : 'unverändert'} />
            <Line l="Rennen" v={d.racesChanged ? 'geändert' : 'unverändert'} />
            <Line l="Regeln" v={d.rulesChanged ? 'geändert' : 'unverändert'} />
          </div>
        </div>
      )}
    </FullSheet>
  )
}

function Line({ l, v }: { l: string; v: string }) {
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <span style={{ width: 120, flex: 'none', font: '500 12px var(--font)', color: 'var(--text-2)' }}>{l}</span>
      <span style={{ font: '600 12px/1.5 var(--font)' }}>{v}</span>
    </div>
  )
}

// ---------------- Einstellungen ----------------

async function deliverFile(name: string, text: string) {
  const file = new File([text], name, { type: 'application/json' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function runBackup(toast: (m: string) => void) {
  const b = await exportBackup()
  try {
    await deliverFile(`form-sicherung-${b.exportedAt.slice(0, 10)}.json`, JSON.stringify(b, null, 1))
    await updateSettings({ lastBackup: Date.now() })
    toast('Sicherung erstellt')
  } catch {
    /* abgebrochen */
  }
}

export function SettingsCard() {
  const { toast, plan } = useData()
  const fileRef = useRef<HTMLInputElement>(null)
  const csvRef = useRef<HTMLInputElement>(null)
  const [csv, setCsv] = useState<CsvPreview[] | null>(null)

  const readCsv = async (files: FileList | null) => {
    if (!files?.length) return
    const out: CsvPreview[] = []
    for (const f of Array.from(files)) {
      try {
        const r = importCsv(await f.text())
        out.push({ file: f.name, result: r, existing: await countExisting(r.activities.map((a) => a.id)) })
      } catch (e) {
        out.push({ file: f.name, error: (e as Error).message })
      }
    }
    setCsv(out)
    if (csvRef.current) csvRef.current.value = ''
  }
  const [history, setHistory] = useState<{ note: string; savedAt: number }[] | null>(null)

  const restore = async (f?: File) => {
    if (!f) return
    try {
      const b = JSON.parse(await f.text()) as Backup
      if (!confirm('Alle Daten in Form durch diese Sicherung ersetzen?')) return
      await importBackup(b)
      toast('Sicherung wiederhergestellt')
    } catch (e) {
      toast((e as Error).message.includes('Form') ? (e as Error).message : 'Die Datei ist keine gültige Sicherung.')
    }
  }

  const showHistory = async () => setHistory(await planHistory())

  const undo = async () => {
    if (!confirm('Den zuletzt importierten Plan verwerfen und zum vorherigen zurückkehren?')) return
    toast((await undoPlan()) ? 'Vorheriger Plan wiederhergestellt' : 'Es gibt keinen importierten Plan')
    setHistory(await planHistory())
  }

  return (
    <Card>
      <CardHead title="Einstellungen" />
      <div className="rows" style={{ marginTop: 6 }}>
        <SettingRow label="Daten importieren (CSV)" sub="Kraft aus Hevy, Läufe aus dem Lauftracker" onClick={() => csvRef.current?.click()} />
        <SettingRow label="Sicherung exportieren" sub="Alle Daten als Datei, z. B. in iCloud Drive" onClick={() => runBackup(toast)} />
        <SettingRow label="Sicherung importieren" sub="Ersetzt alle Daten auf diesem Gerät" onClick={() => fileRef.current?.click()} />
        <SettingRow label="Plan-Verlauf" sub={`Aktuell: ${plan.name}, Stand ${fmtDate(plan.updated)}`} onClick={showHistory} />
      </div>
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(x) => restore(x.target.files?.[0])} />
      <input ref={csvRef} type="file" accept=".csv,text/csv,text/plain" multiple hidden onChange={(x) => readCsv(x.target.files)} />
      {csv && <CsvSheet previews={csv} onClose={() => setCsv(null)} />}
      {history && (
        <div style={{ marginTop: 8 }}>
          {history.length === 0 ? (
            <div className="hint" style={{ margin: 0 }}>Noch kein Plan importiert. Aktiv ist der Startplan aus deinem PDF.</div>
          ) : (
            <>
              {history.map((h, i) => (
                <div key={h.savedAt} className="hint" style={{ margin: '4px 0 0' }}>{i === 0 ? 'Aktiv: ' : ''}{h.note} · {new Date(h.savedAt).toLocaleString('de-DE')}</div>
              ))}
              <button className="btn-secondary" style={{ marginTop: 10 }} onClick={undo}>Letzten Import rückgängig machen</button>
            </>
          )}
        </div>
      )}
      <div className="hint" style={{ margin: '12px 0 0' }}>Deine Daten liegen nur auf diesem Gerät. Exportiere regelmäßig eine Sicherung.</div>
    </Card>
  )
}

function SettingRow({ label, sub, onClick }: { label: string; sub: string; onClick: () => void }) {
  return (
    <button className="row" onClick={onClick}>
      <div className="row-main">
        <div className="row-t" style={{ fontSize: 14 }}>{label}</div>
        <div className="row-s">{sub}</div>
      </div>
      <span style={{ color: 'var(--faint)' }}>›</span>
    </button>
  )
}

/** Hinweis auf „Heute“, wenn die letzte Sicherung länger als 14 Tage her ist */
export function BackupReminder() {
  const { tab } = useNav()
  const { activities, settings, toast } = useData()
  if (tab !== 'heute' || activities.length < 3) return null
  const last = settings.lastBackup ?? 0
  if (Date.now() - last < 14 * 86400000) return null
  return (
    <div className="card dashed" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ font: '600 13px var(--font)' }}>{last ? 'Sicherung ist über 2 Wochen alt' : 'Noch keine Sicherung'}</div>
        <div style={{ font: '400 11px var(--font)', color: 'var(--text-2)', marginTop: 2 }}>Deine Daten liegen nur auf diesem iPhone.</div>
      </div>
      <button className="pill today" onClick={() => runBackup(toast)}>Sichern</button>
    </div>
  )
}

// ---------------- CSV-Import ----------------

interface CsvPreview {
  file: string
  result?: CsvImport
  existing?: number
  error?: string
}

function CsvSheet({ previews, onClose }: { previews: CsvPreview[]; onClose: () => void }) {
  const { toast } = useData()
  const [busy, setBusy] = useState(false)
  const all = previews.flatMap((p) => p.result?.activities ?? [])

  const run = async () => {
    setBusy(true)
    const r = await saveActivities(all)
    setBusy(false)
    toast(`${r.added} Einheiten importiert${r.updated ? `, ${r.updated} aktualisiert` : ''}`)
    onClose()
  }

  return (
    <FullSheet
      title="Daten importieren"
      onClose={onClose}
      footer={<button className="btn-primary" disabled={!all.length || busy} onClick={run}>{all.length ? `${all.length} Einheiten importieren` : 'Nichts zu importieren'}</button>}
    >
      <div className="hint" style={{ fontSize: 12 }}>
        Bereits importierte Einheiten werden aktualisiert, nicht doppelt angelegt. In Form selbst erfasste Einträge bleiben unverändert.
      </div>
      {previews.map((p) => {
        const s = p.result ? summarize(p.result.activities) : null
        return (
          <div key={p.file} className="card" style={{ margin: '12px 0 0' }}>
            <CardHead title={p.result ? (p.result.format === 'hevy' ? 'Hevy · Krafttraining' : 'Lauftracker · Läufe') : 'Nicht lesbar'} aside={p.file} />
            {p.error && <div className="error" style={{ margin: '8px 0 0' }}>{p.error}</div>}
            {s && p.result && (
              <>
                <div className="rows" style={{ marginTop: 8 }}>
                  {s.strength > 0 && <Line l="Krafteinheiten" v={String(s.strength)} />}
                  {s.runs > 0 && <Line l="Läufe" v={String(s.runs)} />}
                  {s.tests > 0 && <Line l="Leistungstests" v={String(s.tests)} />}
                  {s.from && <Line l="Zeitraum" v={`${fmtDate(s.from)} – ${fmtDate(s.to!)}`} />}
                  {!!p.existing && <Line l="Schon vorhanden" v={`${p.existing} (werden aktualisiert)`} />}
                </div>
                {p.result.warnings.length > 0 && (
                  <div className="error" style={{ margin: '10px 0 0' }}>
                    {p.result.warnings.map((w) => <div key={w}>{w}</div>)}
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}
    </FullSheet>
  )
}
