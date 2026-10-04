import type { Inputs } from '../lib/types'
import { fmt } from '../lib/format'

/**
 * Scaled drawing of the concrete-encased section, after the figure of the
 * reference example: encasement outline, embedded I-section, corner bars and
 * the principal dimensions.
 */
export function CrossSection({ inputs, className }: { inputs: Inputs; className?: string }) {
  const { bc, hc, h, bf, tf, tw, e, db, n } = inputs

  const W = 340
  const H = 320
  const padX = 40
  const padY = 30
  const scale = Math.max(
    0.01,
    Math.min((W - 2 * padX) / Math.max(bc, 1), (H - 2 * padY) / Math.max(hc, 1)),
  )
  const cx = W / 2
  const cy = H / 2
  const px = (z: number) => cx + z * scale
  const py = (y: number) => cy - y * scale

  /* reinforcement laid out on the rectangle of side (bc − 2e) × (hc − 2e) */
  const rw = Math.max(bc - 2 * e, 0.1)
  const rh = Math.max(hc - 2 * e, 0.1)
  const per = 2 * (rw + rh)
  const bars: { x: number; y: number }[] = []
  for (let i = 0; i < Math.max(1, Math.round(n)); i++) {
    let d = ((i + 0.5) / Math.max(1, Math.round(n))) * per
    let z = 0
    let y = 0
    if (d < rw) {
      z = -rw / 2 + d
      y = rh / 2
    } else if (d < rw + rh) {
      d -= rw
      z = rw / 2
      y = rh / 2 - d
    } else if (d < 2 * rw + rh) {
      d -= rw + rh
      z = rw / 2 - d
      y = -rh / 2
    } else {
      d -= 2 * rw + rh
      z = -rw / 2
      y = -rh / 2 + d
    }
    bars.push({ x: px(z), y: py(y) })
  }

  const barR = Math.max((db * scale) / 2, 1.8)
  const tfPx = Math.max(tf * scale, 1.2)
  const webW = Math.max(tw * scale, 1)
  const steelX = px(-bf / 2)
  const steelY = py(h / 2)
  const steelH = h * scale
  const dim = '#94a3b8'
  const text = '#475569'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label="Concrete-encased composite cross-section">
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

      {/* steel I-section (flanges + web) */}
      <rect x={steelX} y={steelY} width={bf * scale} height={tfPx} className="fill-ink-900 dark:fill-ink-950" />
      <rect
        x={steelX}
        y={steelY + steelH - tfPx}
        width={bf * scale}
        height={tfPx}
        className="fill-ink-900 dark:fill-ink-950"
      />
      <rect x={px(-tw / 2)} y={steelY} width={webW} height={steelH} className="fill-ink-900 dark:fill-ink-950" />

      {/* reinforcement */}
      {bars.map((b, i) => (
        <circle key={i} cx={b.x} cy={b.y} r={barR} className="fill-ink-950 dark:fill-ink-100" />
      ))}

      {/* centrelines */}
      <g stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="7 3 1.5 3">
        <line x1={6} y1={cy} x2={W - 6} y2={cy} />
        <line x1={cx} y1={6} x2={cx} y2={H - 6} />
      </g>

      {/* overall width */}
      <g stroke={dim} strokeWidth={0.9}>
        <line x1={px(-bc / 2)} y1={15} x2={px(bc / 2)} y2={15} />
        <line x1={px(-bc / 2)} y1={15} x2={px(-bc / 2)} y2={py(hc / 2) + 4} strokeDasharray="3 3" />
        <line x1={px(bc / 2)} y1={15} x2={px(bc / 2)} y2={py(hc / 2) + 4} strokeDasharray="3 3" />
      </g>
      <path
        d={`M${px(-bc / 2)} 15 l6 -3 v6 z M${px(bc / 2)} 15 l-6 -3 v6 z`}
        fill={dim}
      />
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

      {/* bar spacing along z */}
      <g stroke={dim} strokeWidth={0.9}>
        <line x1={px(-e)} y1={H - 15} x2={px(e)} y2={H - 15} />
        <line x1={px(-e)} y1={py(-hc / 2) - 4} x2={px(-e)} y2={H - 15} strokeDasharray="3 3" />
        <line x1={px(e)} y1={py(-hc / 2) - 4} x2={px(e)} y2={H - 15} strokeDasharray="3 3" />
      </g>
      <path d={`M${px(-e)} ${H - 15} l6 -3 v6 z M${px(e)} ${H - 15} l-6 -3 v6 z`} fill={dim} />
      <text x={cx} y={H - 19} textAnchor="middle" fontSize={10} fill={text} className="dark:fill-ink-300">
        {fmt(2 * e, 0)}
      </text>

      {/* section labels */}
      <g fontSize={9.5} className="fill-ink-600 dark:fill-ink-300">
        <text x={steelX + bf * scale + 5} y={steelY + 9}>
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
        <text x={W - 20} y={py(-hc / 2) + 14} textAnchor="end">
          {fmt(db, 0)} mm bar · {Math.round(n)} nos.
        </text>
      </g>

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
