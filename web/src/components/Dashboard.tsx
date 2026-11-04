import { useMemo, useState } from 'react'
import type { Play } from '../lib/types'
import type { Bucket, Stats } from '../lib/stats'
import { WEEKDAYS, computeStats, formatDate, formatDuration, formatHours, formatMonth, nf, pct, timeline } from '../lib/stats'
import { BarChart } from './BarChart'
import { CalendarHeatmap, WeekHourHeatmap } from './Heatmaps'
import { TopArtists, TopSongs } from './Rankings'

export function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  )
}

export function Timeline({ plays, title = 'Reproducciones en el tiempo' }: { plays: Play[]; title?: string }) {
  const spanDays = plays.length ? (plays[plays.length - 1].t - plays[0].t) / 86_400_000 : 0
  const auto: Bucket = spanDays > 400 ? 'month' : spanDays > 100 ? 'week' : 'day'
  const [bucket, setBucket] = useState<Bucket | null>(null)
  const b = bucket ?? auto
  const series = useMemo(() => timeline(plays, b), [plays, b])
  const data = series.map((s) => ({
    label: s.label,
    value: s.plays,
    tick: b === 'month' ? s.label : new Date(s.start).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
  }))
  return (
    <section className="card">
      <div className="card-head">
        <h2>{title}</h2>
        <div className="seg">
          {(['day', 'week', 'month'] as Bucket[]).map((x) => (
            <button key={x} className={b === x ? 'on' : ''} onClick={() => setBucket(x)}>
              {x === 'day' ? 'Día' : x === 'week' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
      </div>
      {data.length ? <BarChart data={data} /> : <div className="empty-state">Sin datos</div>}
    </section>
  )
}

function Facts({ s }: { s: Stats }) {
  const peakHour = s.byHour.indexOf(Math.max(...s.byHour))
  const peakDay = s.byWeekday.indexOf(Math.max(...s.byWeekday))
  const facts: { k: string; v: string; d?: string }[] = []
  if (s.topDay) facts.push({ k: 'Día récord', v: `${nf.format(s.topDay.plays)} canciones`, d: formatDate(s.topDay.day) })
  if (s.longestStreak.days) facts.push({ k: 'Racha más larga', v: `${s.longestStreak.days} días seguidos`, d: `${formatDate(s.longestStreak.start)} → ${formatDate(s.longestStreak.end)}` })
  if (s.longestSession) facts.push({ k: 'Sesión más larga', v: `${formatHours(s.longestSession.ms)} sin parar`, d: `${nf.format(s.longestSession.plays)} temas · ${formatDate(s.longestSession.start, true)}` })
  if (s.onRepeat) facts.push({ k: 'En loop', v: `${s.onRepeat.song.title}`, d: `${s.onRepeat.times} veces seguidas · ${s.onRepeat.song.artist ?? ''} · ${formatDate(s.onRepeat.start)}` })
  facts.push({ k: 'Hora pico', v: `${peakHour}:00 – ${peakHour + 1}:00`, d: `El día que más escuchás: ${WEEKDAYS[peakDay].toLowerCase()}` })
  facts.push({ k: 'Música de madrugada', v: pct(s.nightShare), d: 'de las reproducciones entre las 0 y las 6 h' })
  facts.push({ k: 'Concentración', v: pct(s.top10Share), d: 'de lo escuchado viene de tus 10 artistas top' })
  facts.push({ k: 'Artistas de una sola canción', v: nf.format(s.oneSongArtists), d: `${pct(s.uniqueArtists ? s.oneSongArtists / s.uniqueArtists : 0)} de todos tus artistas` })
  facts.push({ k: 'Sesiones de escucha', v: nf.format(s.sessions), d: `~${formatHours(s.sessions ? s.listenMs / s.sessions : 0)} promedio por sesión` })
  if (s.first) facts.push({ k: 'Primera canción del período', v: s.first.title, d: `${s.first.artist ?? ''} · ${formatDate(s.first.t, true)}` })
  if (s.currentStreak > 1) facts.push({ k: 'Racha actual', v: `${s.currentStreak} días`, d: 'escuchando todos los días' })
  return (
    <section className="card">
      <div className="card-head"><h2>Datos curiosos</h2></div>
      <div className="facts">
        {facts.map((f) => (
          <div className="fact" key={f.k}>
            <div className="k">{f.k}</div>
            <div className="v">{f.v}</div>
            {f.d && <div className="d">{f.d}</div>}
          </div>
        ))}
      </div>
    </section>
  )
}

export function Dashboard({ plays, onArtist }: { plays: Play[]; onArtist: (name: string) => void }) {
  const s = useMemo(() => computeStats(plays), [plays])

  if (!plays.length) return <div className="card empty-state">No hay reproducciones para estos filtros.</div>

  const hourData = s.byHour.map((v, h) => ({ label: `${h}:00–${h + 1}:00`, tick: String(h), value: v }))
  const discoveries = s.newArtistsByMonth.map((m) => ({ label: formatMonth(m.month), tick: formatMonth(m.month), value: m.count }))
  const loyalty = s.deepCuts

  return (
    <>
      <div className="kpis">
        <Kpi label="Reproducciones" value={nf.format(s.plays)} hint={`${nf.format(Math.round(s.plays / Math.max(1, s.activeDays)))} por día activo`} />
        <Kpi label="Tiempo escuchado (est.)" value={formatDuration(s.listenMs)} hint={`${formatHours(s.listenMs)} en total`} />
        <Kpi label="Canciones distintas" value={nf.format(s.uniqueSongs)} hint={`${(s.plays / Math.max(1, s.uniqueSongs)).toFixed(1).replace('.', ',')} plays por canción`} />
        <Kpi label="Artistas distintos" value={nf.format(s.uniqueArtists)} />
        <Kpi label="Días con música" value={nf.format(s.activeDays)} hint={`de ${nf.format(s.spanDays)} días (${pct(s.activeDays / Math.max(1, s.spanDays))})`} />
      </div>

      <div className="grid">
        <div className="span-12"><Timeline plays={plays} /></div>
        <div className="span-6"><TopArtists artists={s.artists} onSelect={onArtist} /></div>
        <div className="span-6"><TopSongs songs={s.songs} onArtist={onArtist} /></div>
        <div className="span-12"><Facts s={s} /></div>
        <div className="span-7">
          <section className="card">
            <div className="card-head">
              <h2>¿Cuándo escuchás?</h2>
              <span className="sub">día de la semana × hora</span>
            </div>
            <WeekHourHeatmap data={s.weekHour} />
          </section>
        </div>
        <div className="span-5">
          <section className="card">
            <div className="card-head"><h2>Por hora del día</h2></div>
            <BarChart data={hourData} height={200} tickEvery={3} />
          </section>
        </div>
        <div className="span-12">
          <section className="card">
            <div className="card-head">
              <h2>Calendario</h2>
              <span className="sub">últimos 12 meses del período</span>
            </div>
            {s.last && <CalendarHeatmap byDay={s.byDay} end={s.last.t} />}
          </section>
        </div>
        <div className="span-7">
          <section className="card">
            <div className="card-head">
              <h2>Artistas nuevos por mes</h2>
              <span className="sub">primera vez que aparecen en el período</span>
            </div>
            <BarChart data={discoveries} height={200} unit="artistas nuevos" />
          </section>
        </div>
        <div className="span-5">
          <section className="card">
            <div className="card-head">
              <h2>Fanatismo</h2>
              <span className="sub">más plays por canción (mín. 15 plays)</span>
            </div>
            <ol className="rank">
              {loyalty.map((a, i) => (
                <li key={a.name} className="clickable" onClick={() => onArtist(a.name)}>
                  <span className="pos">{i + 1}</span>
                  <div className="main">
                    <div className="name">{a.name}</div>
                    <div className="meta">{nf.format(a.plays)} plays en {nf.format(a.songs)} canciones</div>
                  </div>
                  <span className="count">{(a.plays / a.songs).toFixed(1).replace('.', ',')}<small>por canción</small></span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  )
}
