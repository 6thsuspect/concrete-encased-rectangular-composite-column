import type { BarInstance, Inputs } from '../lib/types'
import { fmt } from '../lib/format'
import { barInstances } from '../lib/calc/geometry'

/** Vertices of the embedded I-section silhouette, clockwise in drawing coordinates. */
export function iSectionOutline(
  i: Inputs,
  x: (z: number) => number,
  y: (value: number) => number,
): { x: number; y: number }[] {
  const x1 = x(-i.bf / 2)
  const x2 = x(i.bf / 2)
  const xw1 = x(-i.tw / 2)
  const xw2 = x(i.tw / 2)
  const y0 = y(i.h / 2)
  const y1 = y(i.h / 2 - i.tf)
  const y2 = y(-i.h / 2 + i.tf)
  const y3 = y(-i.h / 2)
  return [
    { x: x1, y: y0 },
    { x: x2, y: y0 },
    { x: x2, y: y1 },
    { x: xw2, y: y1 }, // concave (web, top right)
    { x: xw2, y: y2 }, // concave (web, bottom right)
    { x: x2, y: y2 },
    { x: x2, y: y3 },
    { x: x1, y: y3 },
    { x: x1, y: y2 },
    { x: xw1, y: y2 }, // concave (web, bottom left)
    { x: xw1, y: y1 }, // concave (web, top left)
    { x: x1, y: y1 },
  ]
}

/** Indices of the concave web/flange corners where the root radius is drawn. */
const CONCAVE = new Set([3, 4, 9, 10])

/**
 * SVG path through the outline vertices; the four concave corners are rounded
 * with a quadratic segment so that the root radius `r` shows in the drawing.
 */
export function iSectionPath(points: { x: number; y: number }[], fillet: number): string {
  const n = (v: number) => Math.round(v * 100) / 100
  const at = (k: number) => points[(k + points.length) % points.length]
  const out: string[] = [`M${n(points[0].x)} ${n(points[0].y)}`]
  for (let k = 1; k <= points.length; k++) {
    const prev = at(k - 1)
    const cur = at(k)
    const next = at(k + 1)
    if (k < points.length && fillet > 0.05 && CONCAVE.has(k)) {
      const inLen = Math.hypot(cur.x - prev.x, cur.y - prev.y) || 1
      const outLen = Math.hypot(next.x - cur.x, next.y - cur.y) || 1
      const fi = Math.min(fillet, inLen / 2)
      const fo = Math.min(fillet, outLen / 2)
      const sx = cur.x - ((cur.x - prev.x) / inLen) * fi
      const sy = cur.y - ((cur.y - prev.y) / inLen) * fi
      const ex = cur.x + ((next.x - cur.x) / outLen) * fo
      const ey = cur.y + ((next.y - cur.y) / outLen) * fo
      out.push(`L${n(sx)} ${n(sy)}`, `Q${n(cur.x)} ${n(cur.y)} ${n(ex)} ${n(ey)}`)
    } else {
      out.push(`L${n(cur.x)} ${n(cur.y)}`)
    }
  }
  out.push('Z')
  return out.join(' ')
}

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
  const { h, bf, tf, tw, r, sectionType } = inputs
  const circular = sectionType === 'circular'
  /* for a circular encasement both dimensions are the diameter */
  const bc = circular ? inputs.diameter : inputs.bc
  const hc = circular ? inputs.diameter : inputs.hc
  const hasSlab = sectionType === 'rect-slab' && inputs.slabWidth > 0 && inputs.slabThickness > 0
  const bs = hasSlab ? inputs.slabWidth : 0
  const ts = hasSlab ? inputs.slabThickness : 0
  const D = inputs.diameter
  const R = D / 2

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
  const ringRows = inputs.bars.filter((b) => b.spread === 'ring')
  const barR = (db: number) => Math.max((db * scale) / 2, preview ? 1.4 : 1.8)
  const tfPx = Math.max(tf * scale, 1.2)
  const steelX = px(-bf / 2)
  const steelY = py(h / 2)
  const steelH = h * scale
  const hb = bf * scale
  const dim = '#94a3b8'
  const text = '#475569'
  const dims = !preview

  /* I-section silhouette (both flanges *and* the web) with the root radii
     rounded at the four web/flange junctions */
  const outline = iSectionOutline(inputs, px, py)
  const filletPx = Math.max(
    0,
    Math.min((r * scale), ((bf - tw) / 2) * scale * 0.9, tfPx * 1.2, (steelH - 2 * tfPx) / 2 - 0.5),
  )
  const iPath = iSectionPath(outline, filletPx)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label="Concrete-encased composite cross-section"
    >
      {/* encasement */}
      {circular ? (
        <circle
          cx={cx}
          cy={cy}
          r={R * scale}
          className="fill-ink-200 dark:fill-ink-800"
          stroke="#64748b"
          strokeWidth={1.2}
        />
      ) : (
        <rect
          x={px(-bc / 2)}
          y={py(hc / 2)}
          width={bc * scale}
          height={hc * scale}
          className="fill-ink-200 dark:fill-ink-800"
          stroke="#64748b"
          strokeWidth={1.2}
        />
      )}
      {/* peripheral reinforcement ring(s) */}
      {circular &&
        ringRows.map((row) => (
          <circle
            key={`ring-${row.id}`}
            cx={cx}
            cy={cy}
            r={Math.abs(row.x) * scale}
            fill="none"
            stroke="#94a3b8"
            strokeWidth={0.9}
            strokeDasharray="6 3 1.5 3"
          />
        ))}
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
            {circular ? `⌀${fmt(bc, 0)}` : fmt(bc, 0)}
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
            {circular &&
              ringRows.map((row) => (
                <text key={`ring-label-${row.id}`} x={px(-bc / 2) + 3} y={py(-hc / 2) - 6}>
                  {row.count} × ⌀{fmt(row.db, 0)} on ⌀{fmt(2 * Math.abs(row.x), 0)}
                </text>
              ))}
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
