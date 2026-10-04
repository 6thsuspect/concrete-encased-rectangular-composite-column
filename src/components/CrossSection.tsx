import type { BarInstance, Inputs } from '../lib/types'
import { fmt } from '../lib/format'
import { barInstances } from '../lib/calc/geometry'

interface Props {
  inputs: Inputs
  className?: string
  /** compact drawing without dimension lines / annotations (sidebar preview) */
  preview?: boolean
}

/**
 * Scaled drawing of the concrete-encased section: encasement outline (with the
 * optional slab), embedded I-section including its root radii, every bar of the
 * reinforcement position table and the principal dimensions.
 */
export function CrossSection({ inputs, className, preview = false }: Props) {
  const { bc, hc, h, bf, tf, tw, r, sectionType } = inputs
  const hasSlab = sectionType === 'rect-slab' && inputs.slabWidth > 0 && inputs.slabThickness > 0
  const bs = hasSlab ? inputs.slabWidth : 0
  const ts = hasSlab ? inputs.slabThickness : 0

  const totalWidth = Math.max(bc, bs)
  const totalHeight = hc + ts

  const W = preview ? 300 : 340
  const H = preview ? 210 : 330
  const padX = preview ? 10 : 46
  const padY = preview ? 10 : 34
  const scale = Math.max(
    0.01,
    Math.min((W - 2 * padX) / Math.max(totalWidth, 1), (H - 2 * padY) / Math.max(totalHeight, 1)),
  )
  const cx = W / 2
  // the encasement centroid sits at the origin; the slab (if any) extends upwards
  const yTop = hc / 2 + ts
  // the origin (encasement centroid) sits ts/2 below the centre of the outline
  const cy = padY + (H - 2 * padY) / 2 + (ts / 2) * scale
  const px = (z: number) => cx + z * scale
  const py = (y: number) => cy - y * scale

  const bars: BarInstance[] = barInstances(inputs.bars)
  const barR = (db: number) => Math.max((db * scale) / 2, preview ? 1.4 : 1.8)
  const tfPx = Math.max(tf * scale, 1.2)
  const fillet = Math.min(Math.max(r * scale, 0), Math.min((bf - tw) * scale * 0.45, tfPx * 1.2))
  const steelX = px(-bf / 2)
  const steelY = py(h / 2)
  const steelH = h * scale
  const dim = '#94a3b8'
  const text = '#475569'
  const dims = !preview

  /* I-section silhouette with root radii at the four web/flange junctions */
  const hb = bf * scale
  const x1 = steelX
  const x2 = steelX + hb
  const xw2 = px(tw / 2)
  const f = fillet
  const iPath = [
    `M${x1} ${steelY}`,
    `H${x2}`,
    `V${steelY + tfPx}`,
    `H${xw2 + f}`,
    `Q${xw2} ${steelY + tfPx} ${xw2} ${steelY + tfPx + f}`,
    `V${steelY + steelH - tfPx - f}`,
    `Q${xw2} ${steelY + steelH - tfPx} ${xw2 + f} ${steelY + steelH - tfPx}`,
    `H${x1}`,
    `Z`,
    `M${x1} ${steelY + steelH}`,
    `H${x2}`,
    `V${steelY + steelH - tfPx}`,
    `H${xw2 + f}`,
    `Q${xw2} ${steelY + steelH - tfPx} ${xw2} ${steelY + steelH - tfPx - f}`,
    `V${steelY + tfPx + f}`,
    `Q${xw2} ${steelY + tfPx} ${xw2 + f} ${steelY + tfPx}`,
    `H${x1}`,
    `Z`,
  ].join(' ')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label="Concrete-encased composite cross-section"
    >
      {/* encasement */}
      <rect
        x={px(-bc / 2)}
        y={py(hc / 2)}
        width={bc * scale}
        height={hc * scale}
        className="fill-ink-200 dark:fill-ink-800"
        stroke="#64748b"
        strokeWidth={1.2}
      />
      {/* slab */}
      {hasSlab && (
        <rect
          x={px(-bs / 2)}
          y={py(yTop)}
          width={bs * scale}
          height={ts * scale}
          className="fill-ink-200/70 dark:fill-ink-800/70"
          stroke="#94a3b8"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      )}

      {/* steel I-section with root radii */}
      <path d={iPath} className="fill-ink-900 dark:fill-ink-950" />

      {/* reinforcement from the position table */}
      {bars.map((b, i) => (
        <circle
          key={`${b.rowId}-${i}`}
          cx={px(b.x)}
          cy={py(b.y)}
          r={barR(b.db)}
          className="fill-ink-950 dark:fill-ink-100"
        >
          <title>{`${b.label} · ⌀${fmt(b.db, 0)} at (${fmt(b.x, 0)}, ${fmt(b.y, 0)}) mm`}</title>
        </circle>
      ))}

      {/* centrelines */}
      <g stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="7 3 1.5 3">
        <line x1={6} y1={cy} x2={W - 6} y2={cy} />
        <line x1={cx} y1={6} x2={cx} y2={H - 6} />
      </g>

      {dims && (
        <>
          {/* overall width */}
          <g stroke={dim} strokeWidth={0.9}>
            <line x1={px(-bc / 2)} y1={15} x2={px(bc / 2)} y2={15} />
            <line x1={px(-bc / 2)} y1={15} x2={px(-bc / 2)} y2={py(hc / 2) + 4} strokeDasharray="3 3" />
            <line x1={px(bc / 2)} y1={15} x2={px(bc / 2)} y2={py(hc / 2) + 4} strokeDasharray="3 3" />
          </g>
          <path d={`M${px(-bc / 2)} 15 l6 -3 v6 z M${px(bc / 2)} 15 l-6 -3 v6 z`} fill={dim} />
          <text x={cx} y={11} textAnchor="middle" fontSize={10} fill={text} className="dark:fill-ink-300">
            {fmt(bc, 0)}
          </text>

          {/* overall depth */}
          <g stroke={dim} strokeWidth={0.9}>
            <line x1={W - 14} y1={py(hc / 2)} x2={W - 14} y2={py(-hc / 2)} />
            <line x1={W - 14} y1={py(hc / 2)} x2={px(bc / 2) + 4} y2={py(hc / 2)} strokeDasharray="3 3" />
            <line x1={W - 14} y1={py(-hc / 2)} x2={px(bc / 2) + 4} y2={py(-hc / 2)} strokeDasharray="3 3" />
          </g>
          <path d={`M${W - 14} ${py(hc / 2)} l-3 6 h6 z M${W - 14} ${py(-hc / 2)} l-3 -6 h6 z`} fill={dim} />
          <text
            x={W - 18}
            y={cy}
            textAnchor="middle"
            fontSize={10}
            fill={text}
            className="dark:fill-ink-300"
            transform={`rotate(-90 ${W - 18} ${cy})`}
          >
            {fmt(hc, 0)}
          </text>

          {/* section labels */}
          <g fontSize={9.5} className="fill-ink-600 dark:fill-ink-300">
            <text x={steelX + hb + 5} y={steelY + 9}>
              bf = {fmt(bf, 0)}
            </text>
            <text x={px(tw / 2) + 5} y={cy + 16}>
              tw = {fmt(tw, 1)}
            </text>
            <text x={steelX - 4} y={steelY + tfPx + 10} textAnchor="end">
              tf = {fmt(tf, 1)}
            </text>
            <text x={px(-bc / 2) + 3} y={py(hc / 2) - 5}>
              h = {fmt(h, 0)}
            </text>
            {hasSlab && (
              <text x={px(-bs / 2) + 4} y={py(yTop) + 12}>
                slab {fmt(bs, 0)} × {fmt(ts, 0)}
              </text>
            )}
            <text x={W - 20} y={py(-hc / 2) + 14} textAnchor="end">
              {bars.length} bars · ⌀{fmt(Math.max(0, ...bars.map((b) => b.db)), 0)} max
            </text>
          </g>
        </>
      )}

      {/* axes */}
      <g stroke="#475569" strokeWidth={1} className="stroke-ink-600 dark:stroke-ink-300">
        <line x1={8} y1={cy} x2={28} y2={cy} />
        <line x1={cx} y1={H - 4} x2={cx} y2={H - 24} />
      </g>
      <path d={`M34 ${cy} l-5 -3 v6 z`} fill={text} />
      <path d={`M${cx} ${H - 32} l-3 5 h6 z`} fill={text} />
      <text x={37} y={cy + 3.5} fontSize={10} fill={text} className="dark:fill-ink-300">
        z
      </text>
      <text x={cx + 5} y={H - 33} fontSize={10} fill={text} className="dark:fill-ink-300">
        y
      </text>
    </svg>
  )
}
