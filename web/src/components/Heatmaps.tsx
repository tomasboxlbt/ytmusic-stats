import { useState } from 'react'
import { DAY, WEEKDAYS, dayKey, formatDate, nf } from '../lib/stats'

const STEPS = 6

/** Escala secuencial de un solo tono (cuantiles simples sobre el máximo). */
function level(v: number, max: number): number {
  if (v <= 0 || max <= 0) return 0
  return Math.min(STEPS, Math.max(1, Math.ceil(Math.sqrt(v / max) * STEPS)))
}
const color = (l: number) => `var(--seq-${l})`

function Scale() {
  return (
    <div className="legend-scale" aria-hidden>
      menos
      {Array.from({ length: STEPS + 1 }, (_, i) => (
        <span key={i} className="sw" style={{ background: color(i) }} />
      ))}
      más
    </div>
  )
}

interface Tip { x: number; y: number; text: React.ReactNode }

export function WeekHourHeatmap({ data }: { data: number[][] }) {
  const max = Math.max(...data.flat())
  const [tip, setTip] = useState<Tip | null>(null)
  return (
    <div className="chart" onMouseLeave={() => setTip(null)}>
      <div className="heat">
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="collabel">{h % 3 === 0 ? h : ''}</span>
        ))}
        {data.map((row, wd) => (
          <Row key={wd} label={WEEKDAYS[wd]}>
            {row.map((v, h) => (
              <div
                key={h}
                className="cell"
                style={{ background: color(level(v, max)) }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget
                  const parent = el.closest('.chart')!.getBoundingClientRect()
                  const r = el.getBoundingClientRect()
                  setTip({
                    x: r.left - parent.left + r.width / 2,
                    y: r.top - parent.top,
                    text: <>{WEEKDAYS[wd]} {h}:00–{h + 1}:00 · <b>{nf.format(v)}</b> reproducciones</>,
                  })
                }}
              />
            ))}
          </Row>
        ))}
      </div>
      <Scale />
      {tip && <div className="tooltip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div>}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="rowlabel">{label}</span>
      {children}
    </>
  )
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Calendario estilo "contribuciones": una celda por día, semanas en columnas. */
export function CalendarHeatmap({ byDay, end }: { byDay: Map<string, number>; end: number }) {
  const [tip, setTip] = useState<Tip | null>(null)
  const endDay = new Date(end)
  endDay.setHours(0, 0, 0, 0)
  // 53 semanas hacia atrás, arrancando en lunes
  const start = new Date(endDay.getTime() - 364 * DAY)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  const cells: { key: string; t: number; v: number }[] = []
  for (let d = new Date(start); d <= endDay; d.setDate(d.getDate() + 1)) {
    const k = dayKey(d.getTime())
    cells.push({ key: k, t: d.getTime(), v: byDay.get(k) ?? 0 })
  }
  const max = Math.max(...cells.map((c) => c.v), 0)
  const weeks = Math.ceil(cells.length / 7)
  const monthLabels: string[] = []
  for (let w = 0; w < weeks; w++) {
    const c = cells[w * 7]
    const prev = cells[(w - 1) * 7]
    const m = new Date(c.t).getMonth()
    monthLabels.push(!prev || new Date(prev.t).getMonth() !== m ? MONTHS[m] : '')
  }

  return (
    <div className="chart" onMouseLeave={() => setTip(null)}>
      <div className="cal-wrap">
        <div className="cal-months">
          {monthLabels.map((m, i) => <span key={i}>{m}</span>)}
        </div>
        <div className="cal">
          {cells.map((c) => (
            <div
              key={c.key}
              className="d"
              style={{ background: color(level(c.v, max)) }}
              onMouseEnter={(e) => {
                const el = e.currentTarget
                const parent = el.closest('.chart')!.getBoundingClientRect()
                const r = el.getBoundingClientRect()
                setTip({
                  x: Math.min(Math.max(r.left - parent.left + r.width / 2, 90), parent.width - 90),
                  y: r.top - parent.top,
                  text: <>{formatDate(c.t)} · <b>{nf.format(c.v)}</b> reproducciones</>,
                })
              }}
            />
          ))}
        </div>
      </div>
      <Scale />
      {tip && <div className="tooltip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div>}
    </div>
  )
}
