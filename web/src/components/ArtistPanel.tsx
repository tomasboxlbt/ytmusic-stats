import { useEffect, useMemo } from 'react'
import type { Play } from '../lib/types'
import { computeStats, formatDate, formatHours, nf } from '../lib/stats'
import { Kpi, Timeline } from './Dashboard'
import { TopSongs } from './Rankings'

interface Props {
  name: string
  plays: Play[]
  /** posición en el ranking general */
  rank: number
  onClose: () => void
}

export function ArtistPanel({ name, plays, rank, onClose }: Props) {
  const mine = useMemo(() => plays.filter((p) => p.artist === name), [plays, name])
  const s = useMemo(() => computeStats(mine), [mine])
  const share = plays.length ? mine.length / plays.length : 0

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onClick={onClose}>
      <aside className="panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Detalle de ${name}`}>
        <div className="panel-head">
          <div>
            <div className="sub" style={{ color: 'var(--text-3)', fontSize: 12 }}>#{rank} en tu ranking</div>
            <h2>{name}</h2>
          </div>
          <button className="btn" onClick={onClose}>Cerrar ✕</button>
        </div>
        <div className="kpis">
          <Kpi label="Reproducciones" value={nf.format(s.plays)} hint={`${(share * 100).toFixed(1).replace('.', ',')}% de todo lo escuchado`} />
          <Kpi label="Tiempo (est.)" value={formatHours(s.listenMs)} />
          <Kpi label="Canciones distintas" value={nf.format(s.uniqueSongs)} />
          <Kpi label="Días escuchándolo" value={nf.format(s.activeDays)} />
        </div>
        <section className="card">
          <div className="facts">
            {s.first && <div className="fact"><div className="k">Primera vez</div><div className="v">{formatDate(s.first.t)}</div><div className="d">{s.first.title}</div></div>}
            {s.last && <div className="fact"><div className="k">Última vez</div><div className="v">{formatDate(s.last.t)}</div><div className="d">{s.last.title}</div></div>}
            {s.topDay && <div className="fact"><div className="k">Día récord</div><div className="v">{nf.format(s.topDay.plays)} plays</div><div className="d">{formatDate(s.topDay.day)}</div></div>}
          </div>
        </section>
        <Timeline plays={mine} title="Cuándo lo escuchaste" />
        <TopSongs songs={s.songs} title="Sus canciones" />
      </aside>
    </div>
  )
}
