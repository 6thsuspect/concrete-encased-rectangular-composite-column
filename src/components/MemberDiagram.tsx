import { fmt } from '../lib/format'
import type { Inputs, Results } from '../lib/types'

/** Elevation of the simply supported member with the applied actions. */
export function MemberDiagram({
  inputs,
  results,
  className,
}: {
  inputs: Inputs
  results: Results
  className?: string
}) {
  const W = 340
  const H = 260
  const top = 42
  const bottom = H - 52
  const x = W / 2 - 40

  const { PD, PL, My, Mz, Ly, Ky } = inputs
  const P = results.required.P

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label="Simply supported member elevation">
      {/* member */}
      <line x1={x} y1={top} x2={x} y2={bottom} stroke="#334155" strokeWidth={3} className="dark:stroke-ink-300" />

      {/* supports */}
      <path d={`M${x - 11} ${bottom} l22 0 l-11 15 z`} fill="none" stroke="#334155" strokeWidth={1.4} className="dark:stroke-ink-300" />
      <line x1={x - 16} y1={bottom + 16} x2={x + 16} y2={bottom + 16} stroke="#64748b" strokeWidth={1.2} />
      <g stroke="#64748b" strokeWidth={1}>
        {[-12, -6, 0, 6, 12].map((dx, i) => (
          <line key={i} x1={x + dx} y1={bottom + 16} x2={x + dx - 5} y2={bottom + 22} />
        ))}
      </g>
      <g stroke="#334155" strokeWidth={1.4} className="dark:stroke-ink-300">
        <line x1={x - 12} y1={top} x2={x + 12} y2={top} />
        {[-9, -3, 3, 9].map((dx, i) => (
          <line key={i} x1={x + dx} y1={top} x2={x + dx - 5} y2={top - 6} />
        ))}
      </g>

      {/* axial load */}
      <line x1={x} y1={top - 30} x2={x} y2={top - 8} stroke="#0b7cc7" strokeWidth={1.8} />
      <path d={`M${x} ${top - 4} l-4 -7 h8 z`} fill="#0b7cc7" />
      <text x={x + 8} y={top - 22} fontSize={11} fill="#0b7cc7" fontWeight={600}>
        P = {fmt(P, 0)} kN
      </text>
      <text x={x + 8} y={top - 10} fontSize={9} fill="#64748b">
        PD = {fmt(PD, 0)} · PL = {fmt(PL, 0)} kN
      </text>

      {/* moments at the ends */}
      <path d={`M${x + 4} ${top + 16} a14 14 0 0 1 0 -14`} fill="none" stroke="#b45309" strokeWidth={1.6} />
      <path d={`M${x + 4} ${top + 2} l-4 6 h8 z`} fill="#b45309" transform={`rotate(-90 ${x + 4} ${top + 2})`} />
      <path d={`M${x + 4} ${bottom - 2} a14 14 0 0 0 0 -14`} fill="none" stroke="#b45309" strokeWidth={1.6} />
      <path d={`M${x + 4} ${bottom - 16} l-4 6 h8 z`} fill="#b45309" transform={`rotate(90 ${x + 4} ${bottom - 16})`} />
      <text x={x + 22} y={top + 10} fontSize={10} fill="#b45309">
        Mz = {fmt(Mz, 0)} kN-m
      </text>
      <text x={x + 22} y={top + 22} fontSize={10} fill="#b45309">
        My = {fmt(My, 0)} kN-m
      </text>

      {/* first-order moment diagram, linear with psi = 0 */}
      <g>
        <polygon
          points={`${x} ${top} ${x + 62} ${bottom} ${x} ${bottom}`}
          fill="#0b7cc7"
          opacity={0.12}
        />
        <polyline
          points={`${x} ${top} ${x + 62} ${bottom}`}
          fill="none"
          stroke="#0b7cc7"
          strokeWidth={1.4}
          strokeDasharray="5 3"
        />
        <text x={x + 30} y={(top + bottom) / 2 - 6} fontSize={9.5} fill="#0b7cc7">
          first-order M
        </text>
      </g>

      {/* length dimension */}
      <g stroke="#94a3b8" strokeWidth={0.9}>
        <line x1={x} y1={bottom + 34} x2={x} y2={bottom + 44} strokeDasharray="3 3" />
        <line x1={x} y1={bottom + 39} x2={W - 18} y2={bottom + 39} />
        <line x1={W - 18} y1={bottom} x2={W - 18} y2={bottom + 44} strokeDasharray="3 3" />
      </g>
      <path d={`M${x} ${bottom + 39} l6 -3 v6 z M${W - 18} ${bottom + 39} l-6 -3 v6 z`} fill="#94a3b8" />
      <text x={(x + W - 18) / 2} y={bottom + 35} textAnchor="middle" fontSize={10} fill="#475569" className="dark:fill-ink-300">
        L = {fmt(Ly / 1000, 2)} m
      </text>
      <text x={(x + W - 18) / 2} y={bottom + 52} textAnchor="middle" fontSize={9} fill="#64748b">
        Ky = Kz = {fmt(Ky, 2)} (pinned-pinned)
      </text>

      {/* second-order amplification note */}
      <text x={12} y={18} fontSize={9.5} fill="#64748b">
        kz = {fmt(results.axes.z.kAdopted, 3)} · ky = {fmt(results.axes.y.kAdopted, 3)} (second-order
        multipliers)
      </text>
      <text x={12} y={30} fontSize={9.5} fill="#64748b">
        χz = {fmt(results.global.chiZ, 3)} · χy = {fmt(results.global.chiY, 3)}
      </text>
    </svg>
  )
}
