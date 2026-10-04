import type { Axis, Point, Results } from '../lib/types'
import { fmt, tickLabel } from '../lib/format'

interface Props {
  results: Results
  axis: Axis
  showOther?: boolean
  marker?: Point
  className?: string
}

const extent = (values: number[], pad = 0.08) => {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || Math.abs(max) || 1
  return [min - span * pad, max + span * pad] as const
}

/**
 * Axial force (P) versus moment (M) interaction diagram of one principal axis:
 * the plastic interaction curve A → B → C → D, the simplified bilinear curve
 * A → B → D and the design point of the member.
 */
export function InteractionChart({ results, axis, showOther = false, marker, className }: Props) {
  const W = 560
  const H = 420
  const margin = { top: 24, right: 24, bottom: 46, left: 62 }
  const iw = W - margin.left - margin.right
  const ih = H - margin.top - margin.bottom

  const a = results.axes[axis]
  const other = results.axes[axis === 'z' ? 'y' : 'z']
  const kp = results.keyPoints[axis]

  const curves = showOther ? [a, other] : [a]
  const allM = curves.flatMap((c) => [...c.curve.map((p) => p.m), ...c.bilinear.map((p) => p.m)])
  const allP = curves.flatMap((c) => [...c.curve.map((p) => p.p), ...c.bilinear.map((p) => p.p)])

  const [m0, m1] = extent(allM)
  const [p0, p1] = extent(allP)
  const sx = (m: number) => margin.left + ((m - m0) / (m1 - m0)) * iw
  const sy = (p: number) => margin.top + ih - ((p - p0) / (p1 - p0)) * ih

  const path = (pts: Point[]) => pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${sx(pt.m).toFixed(2)},${sy(pt.p).toFixed(2)}`).join(' ')

  const mTicks = ticks(m0, m1, 6)
  const pTicks = ticks(p0, p1, 7)

  const point = marker ?? { m: a.M2nd, p: results.required.P }
  const status = a.dcMoment + (axis === 'z' ? results.dc.ratioY : results.dc.ratioZ) > 0 && a.dcMoment > results.axes[axis].chiC ? 'fail' : 'ok'

  const legend: { label: string; color: string; dash?: string }[] = [
    { label: 'plastic interaction curve (A→B→C→D)', color: '#0b7cc7' },
    { label: 'simplified bilinear curve (A→B→D)', color: '#64748b', dash: '6 4' },
    { label: `design point (M = ${fmt(point.m, 1)} kN-m, P = ${fmt(point.p, 0)} kN)`, color: '#b45309' },
  ]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label="Interaction diagram">
      {/* grid */}
      <g stroke="#e2e8f0" strokeWidth={1} className="dark:stroke-ink-800">
        {mTicks.map((t) => (
          <line key={`gm${t}`} x1={sx(t)} y1={margin.top} x2={sx(t)} y2={margin.top + ih} />
        ))}
        {pTicks.map((t) => (
          <line key={`gp${t}`} x1={margin.left} y1={sy(t)} x2={margin.left + iw} y2={sy(t)} />
        ))}
      </g>

      {/* axes */}
      <g stroke="#94a3b8" strokeWidth={1.2}>
        <line x1={margin.left} y1={margin.top + ih} x2={margin.left + iw} y2={margin.top + ih} />
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + ih} />
      </g>
      <path d={`M${margin.left + iw + 8} ${margin.top + ih} l-9 -3.5 v7 z`} fill="#94a3b8" />
      <path d={`M${margin.left} ${margin.top - 8} l-3.5 9 h7 z`} fill="#94a3b8" />

      {/* curves */}
      {curves.map((c) => (
        <path
          key={`bil-${c.axis}`}
          d={path(c.bilinear)}
          fill="none"
          stroke="#64748b"
          strokeWidth={1.4}
          strokeDasharray="6 4"
          opacity={c.axis === axis ? 1 : 0.4}
        />
      ))}
      {curves.map((c) => (
        <path
          key={`cur-${c.axis}`}
          d={path(c.curve)}
          fill="none"
          stroke={c.axis === axis ? '#0b7cc7' : '#94a3b8'}
          strokeWidth={c.axis === axis ? 2.2 : 1.4}
          opacity={c.axis === axis ? 1 : 0.55}
        />
      ))}

      {/* key points */}
      {(['A', 'B', 'C', 'D'] as const).map((k) => {
        const p = kp[k]
        const label = { A: 'A — pure compression', B: "B — P'd,c", C: 'C — Mmax', D: 'D — pure bending' }[k]
        return (
          <g key={k}>
            <circle cx={sx(p.m)} cy={sy(p.p)} r={3.6} fill="#0b7cc7" stroke="#fff" strokeWidth={1.2} />
            <text
              x={sx(p.m) + 7}
              y={sy(p.p) - 6}
              fontSize={10}
              fill="#0b7cc7"
              className="font-medium"
              style={{ paintOrder: 'stroke', stroke: 'white', strokeWidth: 3 }}
            >
              {k}
            </text>
            <title>{label}</title>
          </g>
        )
      })}

      {/* design point */}
      <g>
        <line
          x1={sx(point.m)}
          y1={sy(point.p)}
          x2={sx(point.m)}
          y2={margin.top + ih}
          stroke="#b45309"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <line
          x1={margin.left}
          y1={sy(point.p)}
          x2={sx(point.m)}
          y2={sy(point.p)}
          stroke="#b45309"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <circle cx={sx(point.m)} cy={sy(point.p)} r={5} fill="#b45309" stroke="#fff" strokeWidth={1.5} />
        <title>{`Demand: M = ${fmt(point.m, 2)} kN-m, P = ${fmt(point.p, 1)} kN`}</title>
      </g>

      {/* ticks */}
      <g fontSize={10} fill="#64748b" className="dark:fill-ink-400">
        {mTicks.map((t) => (
          <text key={`tm${t}`} x={sx(t)} y={margin.top + ih + 15} textAnchor="middle">
            {tickLabel(t)}
          </text>
        ))}
        {pTicks.map((t) => (
          <text key={`tp${t}`} x={margin.left - 8} y={sy(t) + 3.5} textAnchor="end">
            {tickLabel(t)}
          </text>
        ))}
      </g>

      {/* titles */}
      <text x={margin.left + iw / 2} y={H - 8} fontSize={11} fill="#334155" textAnchor="middle" className="dark:fill-ink-300">
        Moment M{axis} (kN-m)
      </text>
      <text
        x={16}
        y={margin.top + ih / 2}
        fontSize={11}
        fill="#334155"
        textAnchor="middle"
        className="dark:fill-ink-300"
        transform={`rotate(-90 16 ${margin.top + ih / 2})`}
      >
        Axial force P (kN)
      </text>

      {/* legend */}
      <g transform={`translate(${margin.left + 12},${margin.top + 8})`} fontSize={10}>
        <rect x={0} y={0} width={230} height={14 * legend.length + 8} rx={5} fill="white" opacity={0.86} className="dark:fill-ink-900" />
        {legend.map((l, i) => (
          <g key={i} transform={`translate(8,${11 + i * 14})`}>
            <line x1={0} y1={0} x2={18} y2={0} stroke={l.color} strokeWidth={2} strokeDasharray={l.dash} />
            <text x={24} y={3.5} fill="#475569" className="dark:fill-ink-300">
              {l.label}
            </text>
          </g>
        ))}
      </g>
      <text x={margin.left + iw} y={margin.top - 8} fontSize={10} fill="#64748b" textAnchor="end">
        μdd,{axis} = {fmt(a.muDD, 3)} · D/C{axis} = {fmt(a.dcMoment, 3)}
        {a.dcMoment > 1 ? ' — exceeds αmm' : ''}
      </text>
      <title>{status === 'fail' ? 'Design point outside the interaction diagram' : 'Design point within the interaction diagram'}</title>
    </svg>
  )
}

function ticks(min: number, max: number, count: number): number[] {
  const span = max - min
  if (!Number.isFinite(span) || span <= 0) return [min]
  const raw = span / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  const start = Math.ceil(min / step) * step
  const out: number[] = []
  for (let v = start; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(6)))
  return out
}
