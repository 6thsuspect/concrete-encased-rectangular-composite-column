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

/* ------------------------------------------------------------------ */
/* Circular outline                                                    */
/* ------------------------------------------------------------------ */

/** Gross area of a circle, mm². */
export const circleArea = (d: number): number => (Math.PI * d ** 2) / 4

/** Second moment of area of a circle, mm⁴. */
export const circleInertia = (d: number): number => (Math.PI * d ** 4) / 64

/** Plastic section modulus of a circle, mm³ (4R³/3 = D³/6). */
export const circlePlasticModulus = (d: number): number => d ** 3 / 6

/** Area of the circular strip |y| ≤ hn, mm² (the compression block of a circle). */
export function circleStripArea(d: number, hn: number): number {
  const r = d / 2
  const x = Math.min(Math.max(hn, 0), r)
  return 2 * (x * Math.sqrt(Math.max(r * r - x * x, 0)) + r * r * Math.asin(x / r))
}

/** d(area)/d(hn) of the strip above, mm. */
export function circleStripDerivative(d: number, hn: number): number {
  const r = d / 2
  const x = Math.min(Math.max(hn, 0), r)
  return 4 * Math.sqrt(Math.max(r * r - x * x, 0))
}

/**
 * Plastic modulus of the concrete part of the circular strip |y| ≤ hn, mm³:
 * (4/3)[R³ − (R² − hn²)^1.5]; it reaches the full plastic modulus D³/6 at hn = R.
 */
export function circleStripPlasticModulus(d: number, hn: number): number {
  const r = d / 2
  const x = Math.min(Math.max(hn, 0), r)
  return (4 / 3) * (r ** 3 - Math.max(r * r - x * x, 0) ** 1.5)
}

/** Distance from the centroid to the outermost corner of the embedded I-section, mm. */
export const steelCornerRadius = (i: Inputs): number => Math.hypot(i.bf / 2, i.h / 2)

/* ------------------------------------------------------------------ */
/* Reinforcement                                                       */
/* ------------------------------------------------------------------ */

/**
 * Resolve the reinforcement table into individual bar positions.
 *
 * `corner` spreads four bars to (±X, ±Y); `point` stacks `count` bars at (X, Y);
 * `ring` distributes `count` bars evenly on a circle of radius `X` centred on
 * the section centroid, starting at the angle `Y` (degrees, measured from the
 * +z axis towards +y).
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
    } else if (row.spread === 'ring') {
      const start = (row.y * Math.PI) / 180
      for (let k = 0; k < Math.max(1, count); k++) {
        const angle = start + (2 * Math.PI * k) / Math.max(1, count)
        out.push({
          rowId: row.id,
          label: row.label,
          layer: row.layer,
          db: row.db,
          area,
          x: row.x * Math.cos(angle),
          y: row.x * Math.sin(angle),
        })
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

/** One-line description of a reinforcement table row (report / label). */
export function describeBarRow(row: BarRow): string {
  const arrangement = row.spread === 'corner' ? '4 corners' : `${row.count} nos.`
  if (row.spread === 'ring') {
    return `${row.label}: ${row.count} × ⌀${row.db} mm on a ring of ⌀${2 * row.x} mm (start ${row.y}°) — layer ${row.layer}, cover ${row.cover} mm (${arrangement})`
  }
  return `${row.label}: ${row.count} × ⌀${row.db} mm ${row.spread === 'corner' ? `at (±${row.x}, ±${row.y})` : `at (${row.x}, ${row.y})`} mm — layer ${row.layer}, cover ${row.cover} mm (${arrangement})`
}

/* ------------------------------------------------------------------ */
/* Section properties                                                  */
/* ------------------------------------------------------------------ */

/**
 * Concrete outline properties about the reference axes.
 *
 * Rectangular encasement (optionally with a slab): the reference axes are the
 * centroidal axes of the encasement and the slab does not shift them (a
 * documented assumption of the slab extension).
 *
 * Circular encasement: the axes are the diameters; Ic is the same about both
 * axes and so is the plastic modulus D³/6.
 */
export function concreteGeometry(
  i: Inputs,
  steel: { As: number; IsZ: number; IsY: number; ZpsZ: number; ZpsY: number },
  bars: BarsSummary,
): ConcreteGeometry {
  if (i.sectionType === 'circular') {
    const d = Math.max(i.diameter, 0)
    const Ac = circleArea(d) - steel.As - bars.Ast
    const Ic = circleInertia(d) - steel.IsZ - bars.IstZ
    const IcY = circleInertia(d) - steel.IsY - bars.IstY
    const Zpc = circlePlasticModulus(d) - steel.ZpsZ - bars.ZprZ
    const ZpcY = circlePlasticModulus(d) - steel.ZpsY - bars.ZprY
    return {
      kind: 'circular',
      diameter: d,
      bc: d,
      hc: d,
      slabWidth: 0,
      slabThickness: 0,
      slabOffsetY: 0,
      Ac,
      IcZ: Ic,
      IcY,
      ZpcZ: Zpc,
      ZpcY,
    }
  }

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

  return {
    kind: i.sectionType,
    diameter: 0,
    bc: i.bc,
    hc: i.hc,
    slabWidth: bs,
    slabThickness: ts,
    slabOffsetY,
    Ac,
    IcZ,
    IcY,
    ZpcZ,
    ZpcY,
  }
}

/* ------------------------------------------------------------------ */
/* Detailing checks                                                    */
/* ------------------------------------------------------------------ */

/** Is the bar centre inside the concrete outline, with the bar radius respected? */
export function barInsideConcrete(i: Inputs, bar: { x: number; y: number; db: number }): boolean {
  const r = bar.db / 2
  if (i.sectionType === 'circular') {
    const R = i.diameter / 2
    return Math.hypot(bar.x, bar.y) + r <= R + 1e-6
  }
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
