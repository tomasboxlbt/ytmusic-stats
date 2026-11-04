import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Filters, Play } from './lib/types'
import { parseHistory } from './lib/parse'
import { applyFilters, formatDate, nf } from './lib/stats'
import { clearPlays, loadPlays, savePlays } from './lib/storage'
import { Dropzone } from './components/Dropzone'
import { FilterBar, type Preset } from './components/FilterBar'
import { Dashboard } from './components/Dashboard'
import { ArtistPanel } from './components/ArtistPanel'

type Theme = 'auto' | 'light' | 'dark'

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

export default function App() {
  const [plays, setPlays] = useState<Play[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>({ source: 'music', from: null, to: null })
  const [preset, setPreset] = useState<Preset>('all')
  const [artist, setArtist] = useState<string | null>(null)
  const [theme, setTheme] = useTheme()

  const ingest = useCallback(async (text: string, name: string, persist: boolean) => {
    const { plays } = parseHistory(JSON.parse(text))
    if (!plays.length) throw new Error('No se encontraron reproducciones en el archivo.')
    setPlays(plays)
    setFileName(name)
    if (persist) await savePlays({ plays, fileName: name, savedAt: Date.now() })
  }, [])

  // Al iniciar: primero lo guardado en el navegador; si no hay, /historial.json (útil en desarrollo).
  useEffect(() => {
    ;(async () => {
      const saved = await loadPlays()
      if (saved?.plays?.length) {
        setPlays(saved.plays)
        setFileName(saved.fileName)
      } else {
        try {
          const res = await fetch('/historial.json')
          if (res.ok && res.headers.get('content-type')?.includes('json')) await ingest(await res.text(), 'historial.json', false)
        } catch { /* no hay archivo local */ }
      }
      setLoading(false)
    })()
  }, [ingest])

  const onFile = async (file: File) => {
    setLoading(true)
    setError(null)
    try {
      await ingest(await file.text(), file.name, true)
      setFilters({ source: 'music', from: null, to: null })
      setPreset('all')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => (plays ? applyFilters(plays, filters) : []), [plays, filters])
  const years = useMemo(() => {
    if (!plays?.length) return []
    const set = new Set(plays.map((p) => new Date(p.t).getFullYear()))
    return [...set].sort()
  }, [plays])
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
    setArtist(null)
  }

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <div className="brand-mark">▶</div>
          <div>
            <h1>YT Music Stats</h1>
            {plays && (
              <small>
                {fileName} · {nf.format(plays.length)} reproducciones · {formatDate(plays[0].t)} → {formatDate(plays[plays.length - 1].t)}
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
          {plays && <button className="btn" onClick={reset}>Cargar otro archivo</button>}
        </div>
      </header>

      {!plays ? (
        <Dropzone onFile={onFile} error={error} loading={loading} />
      ) : (
        <>
          <FilterBar
            filters={filters}
            preset={preset}
            years={years}
            lastPlay={plays[plays.length - 1].t}
            onChange={(f, p) => { setFilters(f); setPreset(p) }}
          />
          <Dashboard plays={filtered} onArtist={setArtist} />
          <p className="foot">
            El tiempo escuchado es una estimación: el historial no incluye la duración, así que se calcula con el hueco entre
            reproducciones (máx. 10 min) y 3,5 min cuando no hay una siguiente.
          </p>
        </>
      )}

      {artist && plays && <ArtistPanel name={artist} plays={filtered} rank={artistRank} onClose={() => setArtist(null)} />}
    </div>
  )
}
