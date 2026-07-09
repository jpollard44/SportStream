// SVG charts. Series colors are the validated dark-mode categorical palette
// (see dataviz notes in README): slot 1 blue #3987e5, slot 2 aqua #199e70 —
// both ≥3:1 on the app surface with CVD-safe adjacent separation.

import { useState } from 'react'

export const SERIES = ['#3987e5', '#199e70', '#c98500', '#9085e9']
const GRID = '#273250'
const MUTED = '#8b94ab'

// Bars (sent) + line (replies) share one count axis — same unit, one scale.
export function DailyChart({ daily, height = 180 }) {
  const [hover, setHover] = useState(null)
  const data = daily.slice(-21)
  if (data.length === 0) return <div className="py-10 text-center text-sm text-slate-500">No sends yet</div>

  const w = 640
  const padL = 34
  const padB = 20
  const padT = 8
  const plotW = w - padL - 6
  const plotH = height - padB - padT
  const max = Math.max(4, ...data.map((d) => d.sent))
  const step = plotW / data.length
  const barW = Math.min(18, step * 0.55)
  const y = (v) => padT + plotH - (v / max) * plotH
  const x = (i) => padL + i * step + step / 2

  const ticks = [0, Math.round(max / 2), max]
  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.replied).toFixed(1)}`).join(' ')

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[0] }} /> Sent</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded" style={{ background: SERIES[1] }} /> Replies</span>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${w} ${height}`} className="w-full" role="img" aria-label="Daily emails sent and replies received">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={w - 6} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
              <text x={padL - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill={MUTED}>{t}</text>
            </g>
          ))}
          {data.map((d, i) => (
            <rect
              key={d.date}
              x={x(i) - barW / 2}
              y={y(d.sent)}
              width={barW}
              height={Math.max(0, padT + plotH - y(d.sent))}
              rx="3"
              fill={SERIES[0]}
              opacity={hover === null || hover === i ? 1 : 0.45}
            />
          ))}
          <path d={line} fill="none" stroke={SERIES[1]} strokeWidth="2" strokeLinejoin="round" />
          {data.map((d, i) => (
            <circle key={d.date} cx={x(i)} cy={y(d.replied)} r={hover === i ? 4 : 0} fill={SERIES[1]} stroke="#0f1524" strokeWidth="2" />
          ))}
          {/* hover hit targets */}
          {data.map((d, i) => (
            <rect
              key={`h${d.date}`} x={padL + i * step} y={0} width={step} height={height}
              fill="transparent"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            />
          ))}
          {[0, data.length - 1].map((i) => (
            <text key={i} x={x(i)} y={height - 5} textAnchor="middle" fontSize="10" fill={MUTED}>
              {data[i].date.slice(5)}
            </text>
          ))}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute -top-1 z-10 rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-xs shadow-xl"
            style={{ left: `${((x(hover)) / w) * 100}%`, transform: `translateX(${hover > data.length / 2 ? '-105%' : '8px'})` }}
          >
            <div className="font-medium text-slate-200">{data[hover].date}</div>
            <div className="mt-1 space-y-0.5 text-slate-300">
              <div><span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: SERIES[0] }} /> Sent {data[hover].sent}</div>
              <div><span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: SERIES[1] }} /> Replies {data[hover].replied}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function Sparkline({ points, color = SERIES[0], height = 36, width = 120 }) {
  if (!points || points.length < 2) return null
  const max = Math.max(1, ...points)
  const min = Math.min(...points)
  const range = Math.max(1, max - min)
  const step = width / (points.length - 1)
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(height - 4 - ((p - min) / range) * (height - 8)).toFixed(1)}`)
    .join(' ')
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

// Horizontal bars for categorical breakdowns (e.g. reply intents).
export function BreakdownBars({ items }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <div className="space-y-2.5">
      {items.map((item, idx) => (
        <div key={item.label} className="flex items-center gap-3 text-sm">
          <div className="w-32 shrink-0 truncate text-slate-300">{item.label}</div>
          <div className="h-4 flex-1 rounded bg-ink-800">
            <div
              className="flex h-4 items-center rounded pl-1.5"
              style={{ width: `${Math.max(3, (item.value / max) * 100)}%`, background: item.color || SERIES[idx % SERIES.length] }}
            />
          </div>
          <div className="w-10 shrink-0 text-right tabular-nums text-slate-400">{item.value}</div>
        </div>
      ))}
    </div>
  )
}

// Funnel: sent → opened → replied → positive.
export function Funnel({ stats }) {
  const stages = [
    { label: 'Sent', value: stats.sent },
    { label: 'Opened', value: stats.opened },
    { label: 'Replied', value: stats.replied },
    { label: 'Positive', value: stats.positive },
  ]
  const max = Math.max(1, stats.sent)
  // Ordinal blue ramp, dark-mode-safe steps (400→600)
  const ramp = ['#3987e5', '#2a78d6', '#256abf', '#1c5cab']
  return (
    <div className="space-y-2.5">
      {stages.map((s, i) => (
        <div key={s.label} className="flex items-center gap-3 text-sm">
          <div className="w-20 shrink-0 text-slate-300">{s.label}</div>
          <div className="h-5 flex-1 rounded bg-ink-800">
            <div className="h-5 rounded" style={{ width: `${Math.max(2, (s.value / max) * 100)}%`, background: ramp[i] }} />
          </div>
          <div className="w-24 shrink-0 text-right tabular-nums text-slate-400">
            {s.value.toLocaleString()}{i > 0 && stats.sent > 0 && <span className="ml-1 text-slate-500">({((s.value / max) * 100).toFixed(1)}%)</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
