import { useState } from 'react'
import { fmtCompact, fmtINR } from '../lib/format'
import { cn } from './ui'

/** Budget meter: fill tone follows severity, the track is a lighter step of the same tone. */
export function Meter({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? value / max : 0
  const tone = pct >= 1 ? 'var(--critical)' : pct >= 0.85 ? 'var(--warning)' : 'var(--accent)'
  return (
    <div
      className={cn('h-2.5 rounded-full overflow-hidden', className)}
      style={{ background: `color-mix(in oklab, ${tone} 20%, var(--surface))` }}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.min(100, pct * 100))}
    >
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, pct * 100)}%`, background: tone }} />
    </div>
  )
}

/** Horizontal bar list — one hue, the label beside each bar carries identity. */
export function BarList({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label}>
          <div className="flex justify-between gap-3 text-sm mb-1">
            <span className="truncate">{i.label}</span>
            <span className="text-ink-2 tabular-nums shrink-0">{fmtINR(i.value)}</span>
          </div>
          <div className="h-2 rounded-[4px] bg-surface-2">
            <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max(1, (i.value / max) * 100)}%`, background: 'var(--series-1)' }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function niceCeil(v: number) {
  if (v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const m = v / p
  const n = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10
  return n * p
}

function topRounded(x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0) return ''
  r = Math.min(r, h, w / 2)
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
}

export interface ColumnDatum {
  key: string
  label: string
  values: number[]
}

/** Stacked monthly columns; tap/hover a month to read its breakdown below the plot. */
export function MonthlyColumns({ data, series }: { data: ColumnDatum[]; series: { name: string; color: string }[] }) {
  const [active, setActive] = useState(Math.max(0, data.length - 1))
  const W = 320
  const H = 170
  const padT = 20
  const padB = 22
  const padL = 36
  const padR = 8
  const plotH = H - padT - padB
  const plotW = W - padL - padR
  const slot = plotW / Math.max(1, data.length)
  const barW = Math.min(24, slot * 0.6)
  const gap = 2
  const totals = data.map((d) => d.values.reduce((a, b) => a + b, 0))
  const niceMax = niceCeil(Math.max(...totals, 1))
  const y = (v: number) => padT + plotH - (v / niceMax) * plotH
  const ticks = [0, 0.5, 1].map((f) => f * niceMax)
  const current = data[active]

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" role="img">
        {ticks.map((tv) => (
          <g key={tv}>
            <line x1={padL} x2={W - padR} y1={y(tv)} y2={y(tv)} stroke={tv === 0 ? 'var(--baseline)' : 'var(--hairline)'} strokeWidth={1} />
            <text x={padL - 6} y={y(tv) + 3} textAnchor="end" fontSize={9} fill="var(--muted)">
              {tv === 0 ? '0' : fmtCompact(tv).replace('₹', '')}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = padL + i * slot + (slot - barW) / 2
          let bottom = padT + plotH
          const segs = d.values.map((v) => {
            const h = (v / niceMax) * plotH
            const top = bottom - h
            const seg = { top, h }
            bottom = top
            return seg
          })
          const lastIdx = segs.map((s) => s.h > 0).lastIndexOf(true)
          const isActive = i === active
          return (
            <g key={d.key} onClick={() => setActive(i)} onMouseEnter={() => setActive(i)} className="cursor-pointer">
              <rect x={padL + i * slot} y={padT - 10} width={slot} height={plotH + padB + 10} fill="transparent" />
              {segs.map((s, si) => {
                if (s.h <= 0) return null
                // upper segments give up 2px at their base so a surface-coloured gap separates the stack
                const hh = si === 0 ? s.h : Math.max(0, s.h - gap)
                return <path key={si} d={topRounded(x, s.top, barW, hh, si === lastIdx ? 4 : 0)} fill={series[si]?.color} opacity={isActive ? 1 : 0.8} />
              })}
              {isActive && totals[i] > 0 && lastIdx >= 0 && (
                <text x={x + barW / 2} y={segs[lastIdx].top - 5} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--ink)">
                  {fmtCompact(totals[i])}
                </text>
              )}
              <text x={x + barW / 2} y={H - 7} textAnchor="middle" fontSize={10} fill={isActive ? 'var(--ink)' : 'var(--muted)'} fontWeight={isActive ? 600 : 400}>
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2 mt-1">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      {current && (
        <div className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-sm flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="font-medium">{current.label}</span>
          {series.map((s, si) => (
            <span key={s.name} className="text-ink-2 tabular-nums">
              {s.name}: <span className="text-ink font-medium">{fmtINR(current.values[si] ?? 0)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
