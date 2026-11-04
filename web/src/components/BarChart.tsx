import { useEffect, useRef, useState } from 'react'
import { nf } from '../lib/stats'

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(600)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.floor(e.contentRect.width))))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

export interface BarDatum {
  label: string
  value: number
  /** etiqueta corta para el eje (opcional) */
  tick?: string
}

interface Props {
  data: BarDatum[]
  height?: number
  unit?: string
  /** cada cuántas barras mostrar una etiqueta del eje */
  tickEvery?: number
  onSelect?: (i: number) => void
}

function niceMax(v: number) {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p
  return 10 * p
}

/** Barras verticales finas con tooltip por barra (eje Y único, grilla tenue). */
export function BarChart({ data, height = 220, unit = 'reproducciones', tickEvery, onSelect }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const padL = 38, padR = 6, padT = 8, padB = 22
  const innerW = width - padL - padR
  const innerH = height - padT - padB
  const max = niceMax(Math.max(...data.map((d) => d.value), 0))
  const n = Math.max(data.length, 1)
  const slot = innerW / n
  const gap = slot > 6 ? 2 : slot > 3 ? 1 : 0
  const barW = Math.max(1, slot - gap)
  const ticks = [0, max / 2, max]
  const every = tickEvery ?? Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 70))))

  return (
    <div className="chart" ref={ref} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} height={height} role="img" aria-label={`Gráfico de barras de ${unit}`}>
        <g className="axis">
          {ticks.map((t) => {
            const y = padT + innerH - (t / max) * innerH
            return (
              <g key={t}>
                <line className="gridline" x1={padL} x2={width - padR} y1={y} y2={y} />
                <text x={padL - 6} y={y + 4} textAnchor="end">{nf.format(Math.round(t))}</text>
              </g>
            )
          })}
          {data.map((d, i) =>
            i % every === 0 ? (
              <text key={i} x={padL + i * slot + slot / 2} y={height - 6} textAnchor="middle">{d.tick ?? d.label}</text>
            ) : null,
          )}
        </g>
        {data.map((d, i) => {
          const h = (d.value / max) * innerH
          const x = padL + i * slot + gap / 2
          const y = padT + innerH - h
          const r = Math.min(4, barW / 2, h)
          return (
            <g key={i}>
              {h > 0 && (
                <path
                  d={`M${x},${padT + innerH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${padT + innerH} Z`}
                  fill="var(--accent)"
                  opacity={hover == null || hover === i ? 1 : 0.45}
                />
              )}
              {/* zona de hover más grande que la barra */}
              <rect
                x={padL + i * slot}
                y={padT}
                width={slot}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onClick={onSelect ? () => onSelect(i) : undefined}
                style={{ cursor: onSelect ? 'pointer' : 'default' }}
              />
            </g>
          )
        })}
      </svg>
      {hover != null && data[hover] && (
        <div
          className="tooltip"
          style={{
            left: Math.min(Math.max(padL + hover * slot + slot / 2, 70), width - 70),
            top: padT + innerH - (data[hover].value / max) * innerH,
          }}
        >
          {data[hover].label}: <b>{nf.format(data[hover].value)}</b> {unit}
        </div>
      )}
    </div>
  )
}
