import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Filters, HistoryKind, Platform, Play } from './lib/types'
import { DEFAULT_FILTERS } from './lib/types'
import { finalize, parseFile } from './lib/parse'
import { applyFilters, formatDate, nf } from './lib/stats'
import { clearPlays, loadPlays, savePlays, type LoadedFile } from './lib/storage'
import { Dropzone, FileInput } from './components/Dropzone'
import { FilterBar, type Preset } from './components/FilterBar'
import { Dashboard } from './components/Dashboard'
import { ArtistPanel } from './components/ArtistPanel'
import { AdBanner, AdRail } from './components/AdSlot'

type Theme = 'auto' | 'light' | 'dark'

const KIND_LABEL: Record<HistoryKind, string> = {
  youtube: 'YouTube',
  spotify: 'Spotify',
  'spotify-extended': 'Spotify (ampliado)',
  'spotify-podcast': 'Spotify podcasts (ignorado)',
}

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try { return (localStorage.getItem('theme') as Theme) || 'auto' } catch { return 'auto' }
  })
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'auto') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    try { localStorage.setItem('theme', theme) } catch { /* noop */ }
  }, [theme])
  return [theme, setTheme] as const
}

async function readFiles(files: { name: string; text: string }[]) {
  const plays: Play[] = []
  const loaded: LoadedFile[] = []
  const errors: string[] = []
  for (const f of files) {
    try {
      const r = parseFile(JSON.parse(f.text))
      plays.push(...r.plays)
      loaded.push({ name: f.name, kind: KIND_LABEL[r.kind], plays: r.plays.length })
    } catch (e) {
      errors.push(`${f.name}: ${e instanceof Error ? e.message : 'no se pudo leer'}`)
    }
  }
  return { plays, loaded, errors }
}

export default function App() {
  const [plays, setPlays] = useState<Play[] | null>(null)
  const [files, setFiles] = useState<LoadedFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [preset, setPreset] = useState<Preset>('all')
  const [artist, setArtist] = useState<string | null>(null)
  const [theme, setTheme] = useTheme()
  const addInput = useRef<HTMLInputElement>(null)

  /** Agrega archivos a lo ya cargado (o reemplaza si `replace`). */
  const ingest = useCallback(
    async (input: { name: string; text: string }[], base: { plays: Play[]; files: LoadedFile[] }, persist: boolean) => {
      const { plays: parsed, loaded, errors } = await readFiles(input)
      if (!loaded.length) throw new Error(errors.join(' · ') || 'No se pudo leer ningún archivo.')
      const merged = finalize([...base.plays, ...parsed])
      if (!merged.length) throw new Error('No se encontraron reproducciones de música en los archivos.')
      const allFiles = [...base.files, ...loaded]
      setPlays(merged)
      setFiles(allFiles)
      setError(errors.length ? errors.join(' · ') : null)
      if (persist) await savePlays({ plays: merged, files: allFiles, savedAt: Date.now() })
    },
    [],
  )

  // Al iniciar: primero lo guardado en el navegador; si no hay y estamos en desarrollo, web/data/historial.json.
  useEffect(() => {
    ;(async () => {
      const saved = await loadPlays()
      if (saved?.plays?.length) {
        setPlays(saved.plays)
        setFiles(saved.files ?? [])
      } else if (import.meta.env.DEV) {
        try {
          const res = await fetch('/historial.json')
          if (res.ok && res.headers.get('content-type')?.includes('json')) {
            await ingest([{ name: 'historial.json', text: await res.text() }], { plays: [], files: [] }, false)
          }
        } catch { /* no hay archivo local */ }
      }
      setLoading(false)
    })()
  }, [ingest])

  const onFiles = async (list: File[], append: boolean) => {
    setLoading(true)
    setError(null)
    try {
      const input = await Promise.all(list.map(async (f) => ({ name: f.name, text: await f.text() })))
      await ingest(input, append && plays ? { plays, files } : { plays: [], files: [] }, true)
      if (!append) {
        setFilters(DEFAULT_FILTERS)
        setPreset('all')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => (plays ? applyFilters(plays, filters) : []), [plays, filters])
  const years = useMemo(() => {
    if (!plays?.length) return []
    return [...new Set(plays.map((p) => new Date(p.t).getFullYear()))].sort()
  }, [plays])
  const platforms = useMemo(() => [...new Set((plays ?? []).map((p) => p.platform))] as Platform[], [plays])
  const artistRank = useMemo(() => {
    if (!artist) return 0
    const counts = new Map<string, number>()
    for (const p of filtered) if (p.artist) counts.set(p.artist, (counts.get(p.artist) ?? 0) + 1)
    const mine = counts.get(artist) ?? 0
    let rank = 1
    for (const n of counts.values()) if (n > mine) rank++
    return rank
  }, [filtered, artist])

  const reset = async () => {
    await clearPlays()
    setPlays(null)
    setFiles([])
    setArtist(null)
    setFilters(DEFAULT_FILTERS)
    setPreset('all')
  }

  const fileSummary = files.length === 1 ? files[0].name : `${files.length} archivos`

  return (
    <div className="layout">
      <AdRail side="left" />
      <div className="app">
        <header className="top">
          <div className="brand">
            <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden>
              <rect x="3" y="15" width="7" height="14" rx="3.5" />
              <rect x="12.5" y="3" width="7" height="26" rx="3.5" />
              <rect x="22" y="9" width="7" height="20" rx="3.5" />
            </svg>
            <div>
              <h1>Music Stats</h1>
              {plays && (
                <small title={files.map((f) => `${f.name} · ${f.kind} · ${nf.format(f.plays)}`).join('\n')}>
                  {fileSummary} · {nf.format(plays.length)} reproducciones · {formatDate(plays[0].t)} → {formatDate(plays[plays.length - 1].t)}
                </small>
              )}
            </div>
          </div>
          <div className="top-actions">
            <div className="seg" aria-label="Tema">
              {(['auto', 'light', 'dark'] as Theme[]).map((t) => (
                <button key={t} className={theme === t ? 'on' : ''} onClick={() => setTheme(t)}>
                  {t === 'auto' ? 'Auto' : t === 'light' ? 'Claro' : 'Oscuro'}
                </button>
              ))}
            </div>
            {plays && (
              <>
                <button className="btn" disabled={loading} onClick={() => addInput.current?.click()}>
                  {loading ? 'Procesando…' : '+ Agregar archivos'}
                </button>
                <FileInput ref={addInput} onFiles={(f) => onFiles(f, true)} />
                <button className="btn" onClick={reset}>Empezar de nuevo</button>
              </>
            )}
          </div>
        </header>

        <AdBanner />

        {plays && error && <div className="card error" style={{ marginBottom: 16 }}>{error}</div>}

        {!plays ? (
          <Dropzone onFiles={(f) => onFiles(f, false)} error={error} loading={loading} />
        ) : (
          <>
            <FilterBar
              filters={filters}
              preset={preset}
              years={years}
              platforms={platforms}
              lastPlay={plays[plays.length - 1].t}
              onChange={(f, p) => { setFilters(f); setPreset(p) }}
            />
            <Dashboard plays={filtered} onArtist={setArtist} />
            <p className="foot">
              Spotify informa la duración real de cada reproducción y solo se cuentan las de 30 segundos o más.
              YouTube no la informa, así que ahí el tiempo se estima con el hueco entre reproducciones (máx. 10 min,
              3,5 min si no hay una siguiente).
            </p>
          </>
        )}

        {artist && plays && <ArtistPanel name={artist} plays={filtered} rank={artistRank} onClose={() => setArtist(null)} />}
      </div>
      <AdRail side="right" />
    </div>
  )
}
