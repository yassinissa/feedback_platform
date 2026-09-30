import { useLayoutEffect, useRef, useState } from 'react'
import { moodVar } from '../lib/copy'
import { fmtAvg, shortDay } from '../lib/format'
import type { Stats } from '../lib/types'

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/** Daily responses (bars) with average rating (line, 1–5 scale). */
export function TrendChart({ series }: { series: Stats['series'] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const height = 220
  const pad = { t: 16, r: 34, b: 26, l: 30 }
  const w = Math.max(0, width - pad.l - pad.r)
  const h = height - pad.t - pad.b
  const maxCount = Math.max(4, ...series.map((d) => d.count))
  const n = series.length
  const step = n ? w / n : 0
  const barW = Math.max(2, Math.min(22, step * 0.62))
  const x = (i: number) => pad.l + step * i + step / 2
  const yCount = (c: number) => pad.t + h - (c / maxCount) * h
  const yAvg = (a: number) => pad.t + h - ((a - 1) / 4) * h

  let path = ''
  series.forEach((d, i) => {
    if (d.avg == null) return
    path += `${path && series[i - 1]?.avg != null ? 'L' : 'M'}${x(i).toFixed(1)},${yAvg(d.avg).toFixed(1)}`
  })

  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 70))))
  const active = hover != null ? series[hover] : null

  return (
    <div className="chart" ref={ref}>
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label="Daily responses and average rating">
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={pad.l} x2={pad.l + w} y1={pad.t + h * f} y2={pad.t + h * f} className="grid" />
              <text x={pad.l - 8} y={pad.t + h * f + 4} className="axis" textAnchor="end">
                {Math.round(maxCount * (1 - f))}
              </text>
              <text x={pad.l + w + 8} y={pad.t + h * f + 4} className="axis">
                {(5 - 4 * f).toFixed(0)}★
              </text>
            </g>
          ))}
          {series.map((d, i) => (
            <rect
              key={d.date}
              x={x(i) - barW / 2}
              y={yCount(d.count)}
              width={barW}
              height={Math.max(0, pad.t + h - yCount(d.count))}
              rx={Math.min(4, barW / 2)}
              className={hover === i ? 'bar bar-on' : 'bar'}
            />
          ))}
          <path d={path} className="line" />
          {series.map((d, i) =>
            d.avg != null && (n <= 31 || hover === i) ? (
              <circle key={d.date} cx={x(i)} cy={yAvg(d.avg)} r={hover === i ? 5 : 3} className="dot" style={{ fill: moodVar(d.avg) }} />
            ) : null,
          )}
          {series.map((d, i) =>
            i % labelEvery === 0 ? (
              <text key={d.date} x={x(i)} y={height - 6} className="axis" textAnchor="middle">
                {shortDay(d.date)}
              </text>
            ) : null,
          )}
          <rect
            x={pad.l}
            y={pad.t}
            width={w}
            height={h}
            fill="transparent"
            onPointerMove={(e) => {
              const box = (e.currentTarget as SVGRectElement).getBoundingClientRect()
              const i = Math.floor((e.clientX - box.left) / step)
              setHover(i >= 0 && i < n ? i : null)
            }}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      ) : null}
      {active && hover != null ? (
        <div
          className="tip"
          style={{ left: Math.min(Math.max(x(hover), 70), width - 70), top: 0 }}
          role="status"
        >
          <strong>{shortDay(active.date)}</strong>
          <span className="tabular">{active.count} responses</span>
          <span className="tabular">Avg {fmtAvg(active.avg)}★</span>
        </div>
      ) : null}
      <div className="legend" aria-hidden>
        <span>
          <i className="key key-bar" /> Responses
        </span>
        <span>
          <i className="key key-line" /> Avg rating
        </span>
      </div>
    </div>
  )
}

export function Distribution({ dist, total }: { dist: Stats['distribution']; total: number }) {
  return (
    <ul className="hbars">
      {(['5', '4', '3', '2', '1'] as const).map((k) => {
        const v = dist[k]
        const pct = total ? (v / total) * 100 : 0
        return (
          <li key={k}>
            <span className="hbar-label tabular">{k}★</span>
            <span className="hbar-track">
              <span className="hbar-fill" style={{ width: `${pct}%`, background: `var(--mood-${k})` }} />
            </span>
            <span className="hbar-value tabular">
              {v} <span className="muted">· {Math.round(pct)}%</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export function CategoryBars({ items }: { items: { label: string; value: number | null }[] }) {
  return (
    <ul className="hbars hbars-wide">
      {items.map((it) => (
        <li key={it.label}>
          <span className="hbar-label">{it.label}</span>
          <span className="hbar-track">
            <span
              className="hbar-fill"
              style={{ width: `${it.value ? ((it.value - 1) / 4) * 100 : 0}%`, background: moodVar(it.value) }}
            />
          </span>
          <span className="hbar-value tabular">{fmtAvg(it.value)}</span>
        </li>
      ))}
    </ul>
  )
}
