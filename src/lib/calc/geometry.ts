import type {
  Axis,
  BarInstance,
  BarRow,
  BarsSummary,
  ConcreteGeometry,
  Inputs,
} from '../types'

/** Area of one bar, mm². */
export const barArea = (db: number): number => (Math.PI * db ** 2) / 4

/** Second moment of one bar about its own axis, mm⁴. */
export const barInertia = (db: number): number => (Math.PI * db ** 4) / 64

/**
 * Resolve the reinforcement table into individual bar positions.
 *
 * `corner` spreads four bars to (±X, ±Y); `point` stacks `count` bars at (X, Y).
 */
export function barInstances(rows: BarRow[]): BarInstance[] {
  const out: BarInstance[] = []
  for (const row of rows) {
    const area = barArea(row.db)
    const count = Math.max(0, Math.round(row.count))
    if (row.spread === 'corner') {
      const signs: [number, number][] = [
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ]
      const per = Math.max(1, Math.floor(count / 4))
      for (const [sx, sy] of signs) {
        for (let k = 0; k < per; k++) {
          out.push({
            rowId: row.id,
            label: row.label,
            layer: row.layer,
            db: row.db,
            area,
            x: sx * row.x,
            y: sy * row.y,
          })
        }
      }
    } else {
      for (let k = 0; k < count; k++) {
        out.push({
          rowId: row.id,
          label: row.label,
          layer: row.layer,
          db: row.db,
          area,
          x: row.x,
          y: row.y,
        })
      }
    }
  }
  return out
}

/** Aggregate properties of the resolved reinforcement. */
export function barsSummary(rows: BarRow[]): BarsSummary {
  const instances = barInstances(rows)
  let Ast = 0
  let IstZ = 0
  let IstY = 0
  let ZprZ = 0
  let ZprY = 0
  let dbMax = 0
  for (const bar of instances) {
    const own = barInertia(bar.db)
    Ast += bar.area
    IstZ += own + bar.area * bar.y ** 2
    IstY += own + bar.area * bar.x ** 2
    ZprZ += bar.area * Math.abs(bar.y)
    ZprY += bar.area * Math.abs(bar.x)
    dbMax = Math.max(dbMax, bar.db)
  }
  return { instances, Ast, IstZ, IstY, ZprZ, ZprY, dbMax, count: instances.length }
}

/**
 * Concrete outline properties about the reference axes, which are the centroidal
 * axes of the rectangular encasement (the slab does not shift them — a
 * documented assumption of the slab extension).
 */
export function concreteGeometry(
  i: Inputs,
  steel: { As: number; IsZ: number; IsY: number; ZpsZ: number; ZpsY: number },
  bars: BarsSummary,
): ConcreteGeometry {
  const hasSlab = i.sectionType === 'rect-slab' && i.slabWidth > 0 && i.slabThickness > 0
  const bs = hasSlab ? i.slabWidth : 0
  const ts = hasSlab ? i.slabThickness : 0
  const Aslab = bs * ts
  const slabOffsetY = ts > 0 ? i.hc / 2 + ts / 2 : 0

  const Ac = i.bc * i.hc + Aslab - steel.As - bars.Ast
  const IcZ =
    (i.bc * i.hc ** 3) / 12 +
    (bs * ts ** 3) / 12 +
    Aslab * slabOffsetY ** 2 -
    steel.IsZ -
    bars.IstZ
  const IcY = (i.hc * i.bc ** 3) / 12 + (ts * bs ** 3) / 12 - steel.IsY - bars.IstY
  const ZpcZ = (i.bc * i.hc ** 2) / 4 + Aslab * slabOffsetY - steel.ZpsZ - bars.ZprZ
  const ZpcY = (i.hc * i.bc ** 2) / 4 + (ts * bs ** 2) / 4 - steel.ZpsY - bars.ZprY

  return { bc: i.bc, hc: i.hc, slabWidth: bs, slabThickness: ts, Ac, IcZ, IcY, ZpcZ, ZpcY, slabOffsetY }
}

/** One-line description of a reinforcement table row (report / label). */
export function describeBarRow(row: BarRow): string {
  const arrangement = row.spread === 'corner' ? '4 corners' : `${row.count} nos.`
  return `${row.label}: ${row.count} × ⌀${row.db} mm ${row.spread === 'corner' ? `at (±${row.x}, ±${row.y})` : `at (${row.x}, ${row.y})`} mm — layer ${row.layer}, cover ${row.cover} mm (${arrangement})`
}

/** Is the point (bar centre) inside the concrete outline, with the bar radius respected? */
export function barInsideConcrete(i: Inputs, bar: { x: number; y: number; db: number }): boolean {
  const r = bar.db / 2
  const inEncasement =
    Math.abs(bar.x) + r <= i.bc / 2 + 1e-6 && Math.abs(bar.y) + r <= i.hc / 2 + 1e-6
  if (inEncasement) return true
  if (i.sectionType !== 'rect-slab') return false
  const top = i.hc / 2 + i.slabThickness
  const inSlab =
    Math.abs(bar.x) + r <= i.slabWidth / 2 + 1e-6 && bar.y - r >= i.hc / 2 - 1e-6 && bar.y + r <= top + 1e-6
  return inSlab
}

/** Overlap test between a bar (circle) and the embedded steel I-section. */
export function barClashesSteel(i: Inputs, bar: { x: number; y: number; db: number }): boolean {
  const r = bar.db / 2
  const hh = i.h / 2
  const hb = i.bf / 2
  const webHalf = i.tw / 2

  // flanges
  for (const sign of [1, -1]) {
    const yTop = sign * hh
    const yBottom = sign * hh - sign * i.tf
    const yLo = Math.min(yTop, yBottom)
    const yHi = Math.max(yTop, yBottom)
    if (circleRect(bar.x, bar.y, r, -hb, hb, yLo, yHi)) return true
  }
  // web
  return circleRect(bar.x, bar.y, r, -webHalf, webHalf, -hh + i.tf, hh - i.tf)
}

function circleRect(cx: number, cy: number, r: number, x0: number, x1: number, y0: number, y1: number): boolean {
  const nx = Math.min(Math.max(cx, x0), x1)
  const ny = Math.min(Math.max(cy, y0), y1)
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r - 1e-9
}

/** Smallest centre-to-centre distance between any two bars, mm (Infinity if < 2 bars). */
export function minBarSpacing(instances: BarInstance[]): number {
  let min = Infinity
  for (let a = 0; a < instances.length; a++) {
    for (let b = a + 1; b < instances.length; b++) {
      const d = Math.hypot(instances[a].x - instances[b].x, instances[a].y - instances[b].y)
      if (d > 1e-9) min = Math.min(min, d)
    }
  }
  return min
}

/** Bars whose relevant coordinate lies inside the 2hn band, with their contribution. */
export function barsInBand(
  instances: BarInstance[],
  axis: Axis,
  hn: number,
): { area: number; zprn: number; indices: number } {
  let area = 0
  let zprn = 0
  let indices = 0
  for (const bar of instances) {
    const coord = axis === 'z' ? Math.abs(bar.y) : Math.abs(bar.x)
    if (coord <= hn + 1e-9) {
      area += bar.area
      zprn += bar.area * coord
      indices += 1
    }
  }
  return { area, zprn, indices }
}
