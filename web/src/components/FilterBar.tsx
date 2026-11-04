import type { Filters, Platform, PlatformFilter, YouTubeContent } from '../lib/types'
import { DAY } from '../lib/stats'

export type Preset = 'all' | '30d' | '90d' | '365d' | `y${number}` | 'custom'

interface Props {
  filters: Filters
  preset: Preset
  years: number[]
  lastPlay: number
  /** plataformas presentes en los datos cargados */
  platforms: Platform[]
  onChange: (f: Filters, preset: Preset) => void
}

const PLATFORMS: { id: PlatformFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'spotify', label: 'Spotify' },
]

const YT_CONTENT: { id: YouTubeContent; label: string; title: string }[] = [
  { id: 'music', label: 'Solo música', title: 'YouTube Music + videos de canales "Artista - Topic" en YouTube' },
  { id: 'ytmusic', label: 'Solo app YT Music', title: 'Solo lo reproducido desde la app YouTube Music' },
  { id: 'all', label: 'Incluir videos', title: 'Incluye videos de YouTube que no son música' },
]

const toInput = (t: number | null) => {
  if (t == null) return ''
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const fromInput = (s: string) => {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

export function FilterBar({ filters, preset, years, lastPlay, platforms, onChange }: Props) {
  const setPreset = (p: Preset) => {
    const endOfLast = new Date(lastPlay)
    endOfLast.setHours(24, 0, 0, 0)
    const end = endOfLast.getTime()
    let from: number | null = null
    let to: number | null = null
    if (p === '30d') from = end - 30 * DAY
    else if (p === '90d') from = end - 90 * DAY
    else if (p === '365d') from = end - 365 * DAY
    else if (p.startsWith('y')) {
      const y = Number(p.slice(1))
      from = new Date(y, 0, 1).getTime()
      to = new Date(y + 1, 0, 1).getTime()
    }
    onChange({ ...filters, from, to }, p)
  }

  return (
    <div className="filters" role="toolbar" aria-label="Filtros">
      {platforms.length > 1 && (
        <div className="filter-group">
          <label className="lbl">Plataforma</label>
          <div className="seg">
            {PLATFORMS.map((s) => (
              <button key={s.id} className={filters.platform === s.id ? 'on' : ''} onClick={() => onChange({ ...filters, platform: s.id }, preset)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {platforms.includes('youtube') && filters.platform !== 'spotify' && (
        <div className="filter-group">
          <label className="lbl">YouTube</label>
          <div className="seg">
            {YT_CONTENT.map((s) => (
              <button key={s.id} title={s.title} className={filters.youtube === s.id ? 'on' : ''} onClick={() => onChange({ ...filters, youtube: s.id }, preset)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="filter-group">
        <label className="lbl">Período</label>
        <div className="seg">
          <button className={preset === 'all' ? 'on' : ''} onClick={() => setPreset('all')}>Todo</button>
          <button className={preset === '30d' ? 'on' : ''} onClick={() => setPreset('30d')}>30 días</button>
          <button className={preset === '90d' ? 'on' : ''} onClick={() => setPreset('90d')}>90 días</button>
          <button className={preset === '365d' ? 'on' : ''} onClick={() => setPreset('365d')}>12 meses</button>
          {years.map((y) => (
            <button key={y} className={preset === `y${y}` ? 'on' : ''} onClick={() => setPreset(`y${y}`)}>{y}</button>
          ))}
        </div>
      </div>
      <div className="filter-group">
        <input
          type="date"
          aria-label="Desde"
          value={toInput(filters.from)}
          onChange={(e) => onChange({ ...filters, from: fromInput(e.target.value) }, 'custom')}
        />
        <span className="lbl">a</span>
        <input
          type="date"
          aria-label="Hasta"
          value={toInput(filters.to != null ? filters.to - DAY : null)}
          onChange={(e) => {
            const v = fromInput(e.target.value)
            onChange({ ...filters, to: v != null ? v + DAY : null }, 'custom')
          }}
        />
      </div>
    </div>
  )
}
