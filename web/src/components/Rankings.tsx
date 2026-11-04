import { useMemo, useState } from 'react'
import type { ArtistStat, SongStat } from '../lib/stats'
import { formatDate, formatHours, nf } from '../lib/stats'
import { looseKey } from '../lib/parse'

const SIZES = [10, 25, 50, 100]

function useList<T>(items: T[], text: (x: T) => string) {
  const [q, setQ] = useState('')
  const [size, setSize] = useState(10)
  const filtered = useMemo(() => {
    const k = looseKey(q)
    // conservamos la posición real dentro del ranking
    const ranked = items.map((x, i) => ({ x, rank: i + 1 }))
    return k ? ranked.filter((r) => looseKey(text(r.x)).includes(k)) : ranked
  }, [items, q, text])
  const next = SIZES.find((s) => s > size)
  return { q, setQ, shown: filtered.slice(0, size), total: filtered.length, more: next && filtered.length > size ? () => setSize(next) : null }
}

const artistText = (a: ArtistStat) => a.name
const songText = (s: SongStat) => `${s.title} ${s.artist ?? ''}`

export function TopArtists({ artists, onSelect }: { artists: ArtistStat[]; onSelect: (name: string) => void }) {
  const { q, setQ, shown, total, more } = useList(artists, artistText)
  const max = artists[0]?.plays ?? 1
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Artistas más escuchados</h2>
          <div className="sub">{nf.format(artists.length)} artistas · tocá uno para ver el detalle</div>
        </div>
        <input className="search" placeholder="Buscar artista…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ol className="rank">
        {shown.map(({ x: a, rank }) => (
          <li key={a.name} className="clickable" onClick={() => onSelect(a.name)}>
            <span className="pos">{rank}</span>
            <div className="main">
              <div className="name">{a.name}</div>
              <div className="meta">{nf.format(a.songs)} canciones · ~{formatHours(a.ms)} · desde {formatDate(a.first)}</div>
              <div className="bar" style={{ width: `${(a.plays / max) * 100}%` }} />
            </div>
            <span className="count">{nf.format(a.plays)}<small>plays</small></span>
          </li>
        ))}
      </ol>
      {!total && <div className="empty-state">Sin resultados</div>}
      {more && <div className="more"><button className="btn" onClick={more}>Ver más</button></div>}
    </section>
  )
}

export function TopSongs({ songs, onArtist, title = 'Canciones más escuchadas' }: { songs: SongStat[]; onArtist?: (name: string) => void; title?: string }) {
  const { q, setQ, shown, total, more } = useList(songs, songText)
  const max = songs[0]?.plays ?? 1
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          <div className="sub">{nf.format(songs.length)} canciones distintas</div>
        </div>
        <input className="search" placeholder="Buscar canción…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ol className="rank">
        {shown.map(({ x: s, rank }) => (
          <li key={s.key}>
            <span className="pos">{rank}</span>
            <div className="main">
              <div className="name">
                {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : s.title}
              </div>
              <div className="meta">
                {s.artist && onArtist ? (
                  <a href="#" onClick={(e) => { e.preventDefault(); onArtist(s.artist!) }}>{s.artist}</a>
                ) : (s.artist ?? 'Desconocido')}
                {' · '}última vez {formatDate(s.last)}
              </div>
              <div className="bar" style={{ width: `${(s.plays / max) * 100}%` }} />
            </div>
            <span className="count">{nf.format(s.plays)}<small>plays</small></span>
          </li>
        ))}
      </ol>
      {!total && <div className="empty-state">Sin resultados</div>}
      {more && <div className="more"><button className="btn" onClick={more}>Ver más</button></div>}
    </section>
  )
}
