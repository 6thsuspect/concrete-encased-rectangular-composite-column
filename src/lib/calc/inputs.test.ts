/**
 * Tests of the user-input subsystem: grade libraries, the reinforcement
 * position table, the concrete outline, input normalisation and validation.
 */
import { describe, expect, it } from 'vitest'
import { computeAll } from './index'
import {
  DEFAULT_INPUTS,
  PRESETS,
  applyConcreteGrade,
  applyRebarGrade,
  applySteelGrade,
  cloneInputs,
  inputProblems,
  newBarRow,
  normalizeInputs,
} from './defaults'
import {
  BAR_DIAMETERS,
  CONCRETE_GRADES,
  CUSTOM_GRADE,
  REBAR_GRADES,
  STEEL_GRADES,
  ecmOf,
  findConcrete,
  findRebar,
  findSteel,
} from './grades'
import {
  barArea,
  barClashesSteel,
  barInsideConcrete,
  barInstances,
  barsInBand,
  barsSummary,
  circleArea,
  circleInertia,
  circlePlasticModulus,
  circleStripArea,
  circleStripDerivative,
  circleStripPlasticModulus,
  concreteGeometry,
  minBarSpacing,
  steelCornerRadius,
} from './geometry'
import type { BarRow, Inputs } from '../types'
import { decodeInputs, encodeInputs } from '../share'
import { designRing } from '../design'
import { inputsFromJson, inputsToJson } from '../inputIO'

const ref = computeAll(DEFAULT_INPUTS)

const withBars = (bars: BarRow[]): Inputs => ({ ...cloneInputs(DEFAULT_INPUTS), bars })

describe('grade libraries', () => {
  it('computes the concrete modulus as 5000 √fck', () => {
    expect(ecmOf(20)).toBe(22361)
    expect(ecmOf(30)).toBe(27386)
    expect(ecmOf(40)).toBe(31623)
    expect(ecmOf(0)).toBe(0)
  })

  it('lists the standard grades with consistent characteristic values', () => {
    expect(CONCRETE_GRADES.map((g) => g.id)).toContain('M30')
    for (const g of CONCRETE_GRADES) {
      expect(g.fck).toBeGreaterThan(0)
      expect(g.gammaC).toBe(1.5)
      expect(g.Ecm).toBe(ecmOf(g.fck))
    }
    for (const g of REBAR_GRADES) {
      expect(g.fyk).toBeGreaterThan(0)
      expect(g.Es).toBe(200000)
      expect(g.gammaS).toBe(1.15)
    }
    for (const g of STEEL_GRADES) {
      expect(g.fu).toBeGreaterThan(g.fy)
      expect(g.gammaS).toBe(1.1)
      expect(g.E).toBeGreaterThan(100000)
    }
    expect(BAR_DIAMETERS).toEqual([...BAR_DIAMETERS].sort((a, b) => a - b))
    expect(BAR_DIAMETERS).toContain(12)
  })

  it('auto-fills the values of a selected grade', () => {
    const m40 = applyConcreteGrade(DEFAULT_INPUTS, 'M40')
    expect(m40).toMatchObject({ concreteGrade: 'M40', fck: 40, gammaC: 1.5, Ecm: 31623 })
    // the reference grade reproduces the benchmark Ecm
    expect(applyConcreteGrade(DEFAULT_INPUTS, 'M30')).toMatchObject({ fck: 30, Ecm: 27386 })

    expect(applyRebarGrade(DEFAULT_INPUTS, 'Fe500')).toMatchObject({ rebarGrade: 'Fe500', fyk: 500 })
    expect(applySteelGrade(DEFAULT_INPUTS, 'E250')).toMatchObject({ steelGrade: 'E250', fy: 250, fu: 410 })
    expect(applySteelGrade(DEFAULT_INPUTS, 'Fe345')).toMatchObject({ fy: 345, fu: 490, Es: 210000 })
  })

  it('falls back to a custom grade for unknown ids', () => {
    expect(applyConcreteGrade(DEFAULT_INPUTS, 'M999').concreteGrade).toBe(CUSTOM_GRADE)
    expect(applyRebarGrade(DEFAULT_INPUTS, 'nope').rebarGrade).toBe(CUSTOM_GRADE)
    expect(applySteelGrade(DEFAULT_INPUTS, 'nope').steelGrade).toBe(CUSTOM_GRADE)
    expect(findConcrete('M30')?.fck).toBe(30)
    expect(findRebar('Fe415')?.fyk).toBe(415)
    expect(findSteel('Fe345')?.E).toBe(210000)
    expect(findConcrete('nope')).toBeUndefined()
  })
})

describe('reinforcement position table', () => {
  it('spreads a corner row to four bars and a point row to n bars', () => {
    const corner = barInstances([
      { id: 'a', label: 'B1', db: 12, count: 4, layer: '1', cover: 41, x: 159, y: 159, spread: 'corner' },
    ])
    expect(corner).toHaveLength(4)
    expect(corner.map((b) => [b.x, b.y])).toEqual(
      expect.arrayContaining([
        [159, 159],
        [-159, 159],
        [159, -159],
        [-159, -159],
      ]),
    )
    const point = barInstances([
      { id: 'a', label: 'B1', db: 16, count: 3, layer: '2', cover: 40, x: 0, y: 0, spread: 'point' },
    ])
    expect(point).toHaveLength(3)
    expect(point.every((b) => b.x === 0 && b.y === 0)).toBe(true)
  })

  it('aggregates Ast, second moments and plastic moduli of the table', () => {
    const rows: BarRow[] = [
      { id: 'a', label: 'B1', db: 20, count: 4, layer: '1', cover: 40, x: 150, y: 150, spread: 'corner' },
      { id: 'b', label: 'B2', db: 12, count: 2, layer: '2', cover: 40, x: 0, y: 150, spread: 'point' },
    ]
    const s = barsSummary(rows)
    const a20 = barArea(20)
    const a12 = barArea(12)
    expect(s.Ast).toBeCloseTo(4 * a20 + 2 * a12, 6)
    expect(s.count).toBe(6)
    expect(s.dbMax).toBe(20)
    expect(s.IstZ).toBeCloseTo(4 * ((Math.PI * 20 ** 4) / 64 + a20 * 150 ** 2) + 2 * ((Math.PI * 12 ** 4) / 64 + a12 * 150 ** 2), 6)
    expect(s.ZprZ).toBeCloseTo(4 * a20 * 150 + 2 * a12 * 150, 6)
    expect(s.IstY).toBeCloseTo(4 * ((Math.PI * 20 ** 4) / 64 + a20 * 150 ** 2) + 2 * ((Math.PI * 12 ** 4) / 64), 6)
    expect(s.ZprY).toBeCloseTo(4 * a20 * 150, 6)
  })

  it('reproduces the reinforcement properties of the benchmark', () => {
    expect(ref.bars.Ast).toBeCloseTo(452.389, 3)
    expect(ref.bars.IstZ).toBeCloseTo(11440926.46, 1)
    expect(ref.bars.ZprZ).toBeCloseTo(71929.905, 3)
    expect(ref.rebar.count).toBe(4)
    expect(ref.rebar.dbMax).toBe(12)
  })

  it('checks bar positions against the concrete outline and the steel section', () => {
    expect(barInsideConcrete(DEFAULT_INPUTS, { x: 159, y: 159, db: 12 })).toBe(true)
    expect(barInsideConcrete(DEFAULT_INPUTS, { x: 199, y: 0, db: 12 })).toBe(false)
    expect(barInsideConcrete(DEFAULT_INPUTS, { x: 0, y: 0, db: 12 })).toBe(true) // inside, but on the web
    expect(barClashesSteel(DEFAULT_INPUTS, { x: 159, y: 159, db: 12 })).toBe(false)
    expect(barClashesSteel(DEFAULT_INPUTS, { x: 0, y: 100, db: 12 })).toBe(true)
    expect(minBarSpacing(barInstances(DEFAULT_INPUTS.bars))).toBeCloseTo(318, 6)
  })

  it('finds the bars inside the 2 hn band', () => {
    const bars = barInstances([
      { id: 'a', label: 'B1', db: 12, count: 4, layer: '1', cover: 41, x: 159, y: 159, spread: 'corner' },
      { id: 'b', label: 'B2', db: 12, count: 2, layer: '2', cover: 41, x: 0, y: 60, spread: 'point' },
    ])
    const band = barsInBand(bars, 'z', 78.5)
    expect(band.indices).toBe(2)
    expect(band.area).toBeCloseTo(2 * barArea(12), 6)
    expect(band.zprn).toBeCloseTo(2 * barArea(12) * 60, 6)
    expect(barsInBand(bars, 'z', 10).indices).toBe(0)
    expect(barsInBand(bars, 'y', 500).indices).toBe(6)
  })

  it('feeds the reinforcement of each axis into the effective stiffness', () => {
    // an asymmetric table: the bars are far from the y-axis but close to the z-axis
    const res = computeAll(
      withBars([{ id: 'a', label: 'B1', db: 20, count: 2, layer: '1', cover: 40, x: 120, y: 40, spread: 'point' }]),
    )
    expect(res.bars.IstY).not.toBeCloseTo(res.bars.IstZ, 3)
    expect(res.member.EIeZ).toBeCloseTo(
      (DEFAULT_INPUTS.Es * res.steel.IsZ + 0.6 * DEFAULT_INPUTS.Ecm * res.concrete.IcZ + DEFAULT_INPUTS.Est * res.bars.IstZ) /
        1e9,
      6,
    )
    expect(res.member.EIeY).toBeCloseTo(
      (DEFAULT_INPUTS.Es * res.steel.IsY + 0.6 * DEFAULT_INPUTS.Ecm * res.concrete.IcY + DEFAULT_INPUTS.Est * res.bars.IstY) /
        1e9,
      6,
    )
  })

  it('changes the section properties when the table changes', () => {
    const wide = computeAll(
      withBars([
        { id: 'a', label: 'B1', db: 16, count: 4, layer: '1', cover: 41, x: 159, y: 159, spread: 'corner' },
        { id: 'b', label: 'B2', db: 16, count: 4, layer: '2', cover: 41, x: 0, y: 159, spread: 'point' },
      ]),
    )
    expect(wide.rebar.Ast).toBeCloseTo(1608.5, 1)
    expect(wide.bars.IstZ).toBeGreaterThan(ref.bars.IstZ)
    expect(wide.dc.total).not.toBeCloseTo(ref.dc.total, 3)
  })
})

describe('concrete outline', () => {
  it('keeps the benchmark area, second moments and plastic moduli', () => {
    expect(ref.concrete.Ac).toBeCloseTo(148323.31, 1)
    expect(ref.concrete.IcZ).toBeCloseTo(1981215997.9, 0)
    expect(ref.concrete.ZpcZ).toBeCloseTo(14719836.79, 1)
    expect(ref.concrete.Aslab).toBe(0)
  })

  it('adds a slab to the area and to the plastic modulus about z', () => {
    const slabbed: Inputs = {
      ...cloneInputs(DEFAULT_INPUTS),
      sectionType: 'rect-slab',
      slabWidth: 1000,
      slabThickness: 150,
    }
    const g = concreteGeometry(
      slabbed,
      { As: ref.steel.As, IsZ: ref.steel.IsZ, IsY: ref.steel.IsY, ZpsZ: ref.steel.ZpsZ, ZpsY: ref.steel.ZpsY },
      ref.bars,
    )
    const Aslab = 1000 * 150
    const d = 200 + 75
    expect(g.Ac).toBeCloseTo(ref.concrete.Ac + Aslab, 6)
    expect(g.IcZ).toBeCloseTo(ref.concrete.IcZ + (1000 * 150 ** 3) / 12 + Aslab * d ** 2, 4)
    expect(g.IcY).toBeCloseTo(ref.concrete.IcY + (150 * 1000 ** 3) / 12, 4)
    expect(g.ZpcZ).toBeCloseTo(ref.concrete.ZpcZ + Aslab * d, 4)
    expect(g.ZpcY).toBeCloseTo(ref.concrete.ZpcY + (150 * 1000 ** 2) / 4, 4)
    expect(g.slabOffsetY).toBeCloseTo(d, 6)
  })

  it('runs the slab configuration through the whole engine', () => {
    const res = computeAll({
      ...cloneInputs(DEFAULT_INPUTS),
      sectionType: 'rect-slab',
      slabWidth: 1000,
      slabThickness: 150,
    })
    expect(Number.isFinite(res.dc.total)).toBe(true)
    expect(res.concrete.Aslab).toBe(150000)
    // the slab adds concrete, which raises the moment resistance and lowers the D/C ratio
    expect(res.dc.total).toBeLessThan(ref.dc.total)
    expect(res.axes.z.Mmax).toBeGreaterThan(ref.axes.z.Mmax)
    expect(res.groups[0].steps.some((s) => s.note?.includes('slab'))).toBe(true)
  })

  it('is unchanged when the slab thickness is zero', () => {
    const res = computeAll({
      ...cloneInputs(DEFAULT_INPUTS),
      sectionType: 'rect-slab',
      slabWidth: 1000,
      slabThickness: 0,
    })
    expect(res.concrete.Ac).toBeCloseTo(ref.concrete.Ac, 6)
    expect(res.dc.total).toBeCloseTo(ref.dc.total, 3)
  })
})

describe('compression-zone reinforcement model', () => {
  it('uses two corner bars in the reference model', () => {
    expect(ref.axes.z.astc).toBeCloseTo(2 * barArea(12), 6)
    expect(ref.axes.y.astc).toBeCloseTo(2 * barArea(12), 6)
    expect(ref.axes.z.zprn).toBe(0)
  })

  it('takes the bars inside 2 hn from the position table in the position model', () => {
    const inputs: Inputs = {
      ...cloneInputs(DEFAULT_INPUTS),
      bars: [
        ...DEFAULT_INPUTS.bars,
        { id: 'b', label: 'B2', db: 12, count: 4, layer: '2', cover: 41, x: 0, y: 0, spread: 'point' },
      ],
      astcModel: 'positions',
    }
    const res = computeAll(inputs)
    // four extra bars sit on the centroid, i.e. inside every 2 hn band,
    // while the corner bars stay outside it
    expect(res.axes.z.astc).toBeCloseTo(4 * barArea(12), 4)
    expect(res.axes.y.astc).toBeCloseTo(4 * barArea(12), 4)
    // their lever arm is zero, so Zprn stays zero
    expect(res.axes.z.zprn).toBe(0)
    // the assumed compression-zone area differs from the reference assumption
    expect(res.axes.z.astc).not.toBeCloseTo(ref.axes.z.astc, 4)
    expect(Number.isFinite(res.dc.total)).toBe(true)
  })

  it('assumes no compression-zone reinforcement when the corner bars are outside the band', () => {
    const res = computeAll({ ...cloneInputs(DEFAULT_INPUTS), astcModel: 'positions' })
    // the ⌀12 corner bars are 159 mm away from both axes, well outside 2 hn
    expect(res.axes.z.astc).toBe(0)
    expect(res.axes.y.astc).toBe(0)
    expect(res.axes.z.zprn).toBe(0)
    expect(res.axes.z.hn).toBeGreaterThan(ref.axes.z.hn)
    // the reference model — two corner bars in the compression zone — is what
    // reproduces the benchmark
    expect(ref.axes.z.astc).toBeCloseTo(2 * barArea(12), 6)
  })

  it('collects the plastic modulus of bars inside the band', () => {
    const res = computeAll(
      withBars([
        { id: 'a', label: 'B1', db: 12, count: 4, layer: '1', cover: 41, x: 159, y: 159, spread: 'corner' },
        { id: 'b', label: 'B2', db: 12, count: 2, layer: '2', cover: 41, x: 0, y: 60, spread: 'point' },
      ]),
    )
    const positions = computeAll({
      ...withBars([
        { id: 'a', label: 'B1', db: 12, count: 4, layer: '1', cover: 41, x: 159, y: 159, spread: 'corner' },
        { id: 'b', label: 'B2', db: 12, count: 2, layer: '2', cover: 41, x: 0, y: 60, spread: 'point' },
      ]),
      astcModel: 'positions',
    })
    expect(positions.axes.z.zprn).toBeCloseTo(2 * barArea(12) * 60, 4)
    expect(positions.axes.z.astc).toBeCloseTo(2 * barArea(12), 4)
    // the reference model ignores those bars entirely
    expect(res.axes.z.zprn).toBe(0)
    expect(res.axes.z.astc).toBeCloseTo(2 * barArea(12), 4)
    expect(positions.axes.z.Md).not.toBeCloseTo(res.axes.z.Md, 3)
  })
})

/* ------------------------------------------------------------------ */
/* Circular encasement                                                 */
/* ------------------------------------------------------------------ */

/** Numerical integration of the circular strip |y| ≤ hn (trapezoid rule). */
function numericStrip(D: number, hn: number, steps = 200000) {
  const r = D / 2
  const x = Math.min(Math.max(hn, 0), r)
  const dy = x / steps
  let area = 0
  let firstMoment = 0
  for (let k = 0; k <= steps; k++) {
    const y = k * dy
    const w = 2 * Math.sqrt(Math.max(r * r - y * y, 0))
    const wgt = k === 0 || k === steps ? 0.5 : 1
    area += wgt * w * dy
    firstMoment += wgt * y * w * dy
  }
  return { area: 2 * area, firstMoment: 2 * firstMoment }
}

const circle: Inputs = {
  ...cloneInputs(DEFAULT_INPUTS),
  sectionType: 'circular',
  diameter: 600,
  cover: 50,
  bars: [{ id: 'ring-1', label: 'B1', db: 25, count: 12, layer: '1', cover: 50, x: 250, y: 0, spread: 'ring' }],
  astcModel: 'positions',
}

describe('circular outline', () => {
  it('reproduces the closed forms of a circle by numeric integration', () => {
    const D = 600
    const R = D / 2
    expect(circleArea(D)).toBeCloseTo(Math.PI * R * R, 6)
    expect(circleInertia(D)).toBeCloseTo((Math.PI * D ** 4) / 64, 6)
    expect(circlePlasticModulus(D)).toBeCloseTo((4 * R ** 3) / 3, 6)

    for (const hn of [10, 37.57, 120, 250, 300, 400]) {
      const num = numericStrip(D, hn)
      expect(circleStripArea(D, hn)).toBeCloseTo(num.area, 1)
      expect(circleStripPlasticModulus(D, hn)).toBeCloseTo(num.firstMoment, 0)
    }
    expect(circleStripArea(D, R)).toBeCloseTo(circleArea(D), 4)
    expect(circleStripPlasticModulus(D, R)).toBeCloseTo(circlePlasticModulus(D), 4)
    expect(circleStripArea(D, 0)).toBe(0)
    // the derivative is the total width of the strip at hn: 2·2√(R² − hn²)
    expect(circleStripDerivative(D, 100)).toBeCloseTo(4 * Math.sqrt(R * R - 100 * 100), 9)
    expect(circleStripDerivative(D, R + 50)).toBe(0)
  })

  it('distributes the peripheral bars evenly on the ring', () => {
    const bars = barInstances(circle.bars)
    expect(bars).toHaveLength(12)
    for (const b of bars) expect(Math.hypot(b.x, b.y)).toBeCloseTo(250, 6)
    // twelve bars at 30° starting from +z
    const near = (x: number, y: number) => bars.some((b) => Math.abs(b.x - x) < 1e-6 && Math.abs(b.y - y) < 1e-6)
    expect(near(250, 0)).toBe(true)
    expect(near(0, 250)).toBe(true)
    expect(near(-250, 0)).toBe(true)
    // the ring closes: the spacing along the ring is 2πρ/n
    expect(minBarSpacing(bars)).toBeCloseTo(2 * 250 * Math.sin(Math.PI / 12), 6)

    // a start angle rotates the whole cage
    const rotated = barInstances([{ ...circle.bars[0], y: 90 }])
    expect(rotated[0].x).toBeCloseTo(0, 6)
    expect(rotated[0].y).toBeCloseTo(250, 6)
  })

  it('derives the concrete properties of the circle', () => {
    const r = computeAll(circle)
    const steel = computeAll(DEFAULT_INPUTS).steel
    const bars = barsSummary(circle.bars)
    expect(r.concrete.Ac).toBeCloseTo(circleArea(600) - steel.As - bars.Ast, 6)
    expect(r.concrete.IcZ).toBeCloseTo(circleInertia(600) - steel.IsZ - bars.IstZ, 6)
    expect(r.concrete.IcY).toBeCloseTo(circleInertia(600) - steel.IsY - bars.IstY, 6)
    expect(r.concrete.ZpcZ).toBeCloseTo(circlePlasticModulus(600) - steel.ZpsZ - bars.ZprZ, 6)
    expect(r.concrete.ZpcY).toBeCloseTo(circlePlasticModulus(600) - steel.ZpsY - bars.ZprY, 6)
    expect(r.concrete.Aslab).toBe(0)
    expect(r.concrete.diameter).toBe(600)
    // Zpr,z of an even cage: Σ A ρ |sin φ| = A ρ Σ|sin| over the twelve angles
    const sumSin = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].reduce(
      (a, deg) => a + Math.abs(Math.sin((deg * Math.PI) / 180)),
      0,
    )
    expect(r.bars.ZprZ).toBeCloseTo(bars.Ast / 12 * 250 * sumSin, 3)
  })

  it('solves the neutral axis of the circular compression block', () => {
    const r = computeAll(circle)
    const z = r.axes.z
    const y = r.axes.y
    expect(z.hn).toBeGreaterThan(0)
    expect(z.hn).toBeLessThan(300)
    expect(z.hnAdopted).toBeCloseTo(z.hn, 9) // no rounding for a circle
    // the equilibrium equation holds at the solved depth
    const fc = (DEFAULT_INPUTS.alphaC * DEFAULT_INPUTS.fck) / DEFAULT_INPUTS.gammaC
    const num = 0.8 * r.concrete.Ac * fc - z.astc * ((2 * DEFAULT_INPUTS.fyk) / DEFAULT_INPUTS.gammaK - 0.8 * fc)
    const den =
      3.2 * fc * circleStripDerivative(600, z.hnAdopted) +
      2 * DEFAULT_INPUTS.tw * ((2 * DEFAULT_INPUTS.fy) / DEFAULT_INPUTS.gammaM0 - 0.8 * fc)
    expect(z.hnAdopted * den).toBeCloseTo(num, 2)
    // the block is the circular strip, the plastic modulus its first moment
    expect(z.astc).toBeCloseTo(barsInBand(r.bars.instances, 'z', z.hnAdopted).area, 6)
    expect(z.zpcn).toBeCloseTo(circleStripPlasticModulus(600, z.hnAdopted) - z.zpsn - z.zprn, 6)
    expect(z.PdC).toBeGreaterThan(0)
    expect(z.Mmax).toBeGreaterThan(z.Md)
    // the minor axis has the same concrete block but a different steel term
    expect(y.hnAdopted).not.toBeCloseTo(z.hnAdopted, 3)
    expect(Number.isFinite(r.dc.total)).toBe(true)
  })

  it('increases the resistance when the peripheral steel increases', () => {
    const lean = computeAll({ ...circle, bars: [{ ...circle.bars[0], db: 16, count: 8 }] })
    const rich = computeAll({ ...circle, bars: [{ ...circle.bars[0], db: 32, count: 16 }] })
    expect(rich.bars.Ast).toBeGreaterThan(lean.bars.Ast)
    expect(rich.axes.z.Mmax).toBeGreaterThan(lean.axes.z.Mmax)
    expect(rich.axes.z.Md).toBeGreaterThan(lean.axes.z.Md)
    expect(rich.dc.ratioZ).toBeLessThan(lean.dc.ratioZ)
    expect(rich.dc.ratioY).toBeLessThan(lean.dc.ratioY)
    expect(rich.dc.total).toBeLessThan(lean.dc.total)
  })

  it('adds the circular detailing checks to the section group', () => {
    const r = computeAll(circle)
    const ids = r.groups.flatMap((g) => g.steps.map((s) => s.id))
    for (const id of ['circ-bars', 'circ-db', 'circ-ratio', 'circ-pitch']) expect(ids).toContain(id)
    const barsStep = r.groups.flatMap((g) => g.steps).find((s) => s.id === 'circ-bars')
    expect(barsStep?.status).toBe('ok') // 12 bars ≥ 6
    const ratio = r.groups.flatMap((g) => g.steps).find((s) => s.id === 'circ-ratio')
    expect(ratio?.value).toBeCloseTo((r.bars.Ast / circleArea(600)) * 100, 6)
    expect(ratio?.status).toBe('ok') // 2.08 % between 0.8 % and 6 %
    const pitch = r.groups.flatMap((g) => g.steps).find((s) => s.id === 'circ-pitch')
    expect(pitch?.value).toBeCloseTo((2 * Math.PI * 250) / 12, 6) // 130.9 mm

    const four = computeAll({ ...circle, bars: [{ ...circle.bars[0], count: 8 }] })
    expect(four.groups.flatMap((g) => g.steps).find((s) => s.id === 'circ-bars')?.status).toBe('ok')
    const sixBar = computeAll({ ...circle, bars: [{ ...circle.bars[0], count: 6, db: 25, x: 250 }] })
    expect(sixBar.groups.flatMap((g) => g.steps).find((s) => s.id === 'circ-bars')?.status).toBe('ok')
    expect(sixBar.groups.flatMap((g) => g.steps).find((s) => s.id === 'circ-pitch')?.status).toBe('ok')
    const wide = computeAll({ ...circle, bars: [{ ...circle.bars[0], count: 6, x: 288 }] })
    expect(wide.groups.flatMap((g) => g.steps).find((s) => s.id === 'circ-pitch')?.status).toBe('warn')
  })

  it('validates the circular inputs', () => {
    const msgs = (i: Inputs) => inputProblems(i).map((p) => p.message).join(' | ')
    expect(inputProblems(circle)).toEqual([])
    expect(msgs({ ...circle, diameter: 300 })).toMatch(/does not fit inside the circle/)
    expect(msgs({ ...circle, cover: 320 })).toMatch(/cover must be smaller than the radius/)
    expect(msgs({ ...circle, bars: [{ ...circle.bars[0], count: 4 }] })).toMatch(/at least 6 bars/)
    expect(msgs({ ...circle, bars: [{ ...circle.bars[0], x: 295 }] })).toMatch(/places the bars outside/)
    expect(msgs({ ...circle, bars: [{ ...circle.bars[0], cover: 10 }] })).toMatch(/implies a cover of 50 mm/)
    expect(msgs({ ...circle, bars: [{ ...circle.bars[0], count: 6, x: 288 }] })).toMatch(/pitch of the peripheral bars is 302/)
    expect(msgs({ ...circle, bars: [{ ...circle.bars[0], count: 24, x: 280 }] })).toMatch(/pitch of the peripheral bars is 73/)
    expect(
      msgs({ ...DEFAULT_INPUTS, bars: [{ ...DEFAULT_INPUTS.bars[0], spread: 'ring', x: 150 }] }),
    ).toMatch(/only meaningful for a circular section/)
    expect(msgs({ ...circle, bars: [] })).toMatch(/At least one reinforcement row/)
    expect(steelCornerRadius(circle)).toBeCloseTo(Math.hypot(128, 130), 6)
    expect(steelCornerRadius(circle)).toBeLessThan(300)
  })

  it('converts ring rows through a save / load cycle', () => {
    const back = inputsFromJson(inputsToJson(circle))
    expect(back?.bars[0]).toEqual(circle.bars[0])
    expect(back?.diameter).toBe(600)
    expect(computeAll(back as Inputs).dc.total).toBeCloseTo(computeAll(circle).dc.total, 6)
    expect(decodeInputs(encodeInputs(circle))?.bars[0].spread).toBe('ring')
  })
})

describe('design of the peripheral reinforcement', () => {
  it('finds the required steel of the circular section', () => {
    const design = designRing(circle, 1.0)
    expect(design).not.toBeNull()
    const d = design as NonNullable<typeof design>
    expect(d.rho).toBeCloseTo(250, 6)
    expect(d.ag).toBeCloseTo(circleArea(600), 6)
    expect(d.minAst).toBeCloseTo(0.008 * d.ag, 6)
    expect(d.maxAst).toBeCloseTo(0.06 * d.ag, 6)
    // the reference cage is already adequate, so no extra steel is required
    expect(d.satisfied).toBe(true)
    expect(d.requiredAst).toBeLessThan(d.minAst)
    expect(d.candidates.length).toBeGreaterThan(5)
    const recommended = d.candidates.find((c) => c.recommended)
    expect(recommended).toBeDefined()
    expect(recommended?.ok).toBe(true)
    expect(recommended?.dc).toBeLessThanOrEqual(1)
    expect(recommended?.n).toBeGreaterThanOrEqual(6)
    expect(recommended?.ratio).toBeGreaterThanOrEqual(0.8)
  })

  it('designs heavier loads and respects the 6 % ceiling', () => {
    // a load level the ⌀600 reference cage cannot take but a 6 % cage can
    const heavy: Inputs = { ...cloneInputs(circle), PD: 3000, PL: 1400, Mz: 800, My: 150 }
    expect(computeAll(heavy).dc.total).toBeGreaterThan(1)
    const design = designRing(heavy, 1.0) as NonNullable<ReturnType<typeof designRing>>
    expect(design.satisfied).toBe(false)
    expect(design.feasible).toBe(true)
    expect(design.requiredAst).toBeGreaterThan(design.minAst)
    expect(design.requiredAst).toBeLessThan(design.maxAst)

    const recommended = design.candidates.find((c) => c.recommended)
    expect(recommended).toBeDefined()
    expect(recommended?.ok).toBe(true)
    expect(recommended?.dc).toBeLessThanOrEqual(1)
    expect(recommended?.ast).toBeGreaterThanOrEqual(design.requiredAst)
    expect(recommended?.ast).toBeLessThanOrEqual(design.maxAst + 1e-6)

    // applying the recommended row really does satisfy the target
    const applied = computeAll({
      ...heavy,
      bars: [{ ...circle.bars[0], db: recommended?.db ?? 25, count: recommended?.n ?? 12 }],
    })
    expect(applied.dc.total).toBeLessThanOrEqual(1)

    // an extreme load cannot be reached even with the 6 % maximum
    const extreme: Inputs = { ...cloneInputs(circle), PD: 6000, PL: 3000, Mz: 1800, My: 300 }
    const hopeless = designRing(extreme, 1.0) as NonNullable<ReturnType<typeof designRing>>
    expect(hopeless.satisfied).toBe(false)
    expect(hopeless.feasible).toBe(false)
    expect(Number.isNaN(hopeless.requiredAst)).toBe(true)
    expect(hopeless.candidates.every((c) => !c.recommended)).toBe(true)
  })

  it('returns null for a rectangular section or without a ring row', () => {
    expect(designRing(DEFAULT_INPUTS, 1)).toBeNull()
    expect(designRing({ ...circle, bars: [{ ...DEFAULT_INPUTS.bars[0] }] }, 1)).toBeNull()
  })
})

describe('input normalisation and validation', () => {
  it('round-trips the default input set unchanged', () => {
    expect(normalizeInputs(DEFAULT_INPUTS)).toEqual(DEFAULT_INPUTS)
    expect(normalizeInputs(cloneInputs(DEFAULT_INPUTS))).toEqual(DEFAULT_INPUTS)
  })

  it('fills missing fields from the defaults and keeps known values', () => {
    const partial = normalizeInputs({ fck: 35, bc: 350, db: 16, n: 8, e: 150 })
    expect(partial.fck).toBe(35)
    expect(partial.bc).toBe(350)
    expect(partial.bars).toEqual(DEFAULT_INPUTS.bars)
    expect(partial.sectionType).toBe('rect')
    expect(normalizeInputs(null)).toEqual(DEFAULT_INPUTS)
  })

  it('sanitises a malformed bar table', () => {
    const i = normalizeInputs({
      bars: [
        { label: 'X', db: 20, count: 8, spread: 'corner', x: 1, y: 2 },
        { db: 'oops', count: 0, spread: 'point' },
      ],
    })
    expect(i.bars).toHaveLength(2)
    expect(i.bars[0]).toMatchObject({ label: 'X', db: 20, count: 8, spread: 'corner' })
    expect(i.bars[1].db).toBe(12)
    expect(i.bars[1].count).toBe(1)
    expect(i.bars[1].spread).toBe('point')
  })

  it('accepts a new row built by the table helper', () => {
    const row = newBarRow('bar-2', 1)
    expect(row).toMatchObject({ id: 'bar-2', label: 'B2', db: 12, count: 4, spread: 'corner' })
    expect(barInstances([row])).toHaveLength(4)
  })

  it('reports no problem for the reference input set', () => {
    expect(inputProblems(DEFAULT_INPUTS)).toEqual([])
  })

  it('flags inconsistent geometry, materials and reinforcement', () => {
    const msgs = (i: Inputs) => inputProblems(i).map((p) => p.message).join(' | ')
    expect(msgs({ ...cloneInputs(DEFAULT_INPUTS), hc: 200 })).toMatch(/cannot exceed the concrete depth/)
    expect(msgs({ ...cloneInputs(DEFAULT_INPUTS), cover: 250 })).toMatch(/cover must be smaller/)
    expect(msgs({ ...cloneInputs(DEFAULT_INPUTS), fu: 100 })).toMatch(/must not be smaller/)
    expect(msgs({ ...cloneInputs(DEFAULT_INPUTS), bars: [] })).toMatch(/At least one reinforcement row/)
    expect(msgs({ ...cloneInputs(DEFAULT_INPUTS), psi: 2 })).toMatch(/conventionally between/)
    expect(
      msgs({
        ...cloneInputs(DEFAULT_INPUTS),
        bars: [{ ...DEFAULT_INPUTS.bars[0], count: 6 }],
      }),
    ).toMatch(/multiples of four/)
    expect(
      msgs({
        ...cloneInputs(DEFAULT_INPUTS),
        bars: [{ ...DEFAULT_INPUTS.bars[0], x: 300 }],
      }),
    ).toMatch(/outside the concrete outline/)
    expect(inputProblems({ ...cloneInputs(DEFAULT_INPUTS), bc: 0 })[0].level).toBe('error')
  })

  it('accepts every preset without a blocking error', () => {
    for (const preset of PRESETS) {
      const i = cloneInputs({ ...DEFAULT_INPUTS, ...preset.patch, bars: preset.patch.bars ?? DEFAULT_INPUTS.bars })
      const errors = inputProblems(i).filter((p) => p.level === 'error')
      expect(errors.map((e) => `${preset.id}: ${e.message}`)).toEqual([])
    }
  })
})

describe('save / load / share of the input set', () => {
  it('writes and reads the JSON envelope', () => {
    const json = inputsToJson(DEFAULT_INPUTS)
    const parsed = JSON.parse(json) as { format: string; version: number; inputs: Inputs }
    expect(parsed.format).toBe('is11384-inputs')
    expect(parsed.version).toBe(1)
    expect(parsed.inputs.bars).toHaveLength(1)

    const back = inputsFromJson(json)
    expect(back).toEqual(DEFAULT_INPUTS)
  })

  it('also accepts a bare input object and rejects junk', () => {
    expect(inputsFromJson(JSON.stringify({ fck: 45 }))?.fck).toBe(45)
    expect(inputsFromJson('not json at all')).toBeNull()
    expect(inputsFromJson('{ "format": "is11384-inputs" }')).toEqual(DEFAULT_INPUTS)
  })

  it('keeps a custom bar table through a save / load cycle', () => {
    const custom: Inputs = {
      ...cloneInputs(DEFAULT_INPUTS),
      sectionType: 'rect-slab',
      slabWidth: 900,
      slabThickness: 120,
      units: { length: 'm', stress: 'MPa' },
      bars: [
        { id: 'a', label: 'Top', db: 20, count: 4, layer: '1', cover: 45, x: 150, y: 155, spread: 'corner' },
        { id: 'b', label: 'Mid', db: 16, count: 2, layer: '2', cover: 45, x: 0, y: 40, spread: 'point' },
      ],
      astcModel: 'positions',
    }
    const back = inputsFromJson(inputsToJson(custom))
    expect(back?.bars).toEqual(custom.bars)
    expect(back?.units).toEqual({ length: 'm', stress: 'MPa' })
    expect(back?.sectionType).toBe('rect-slab')
    expect(computeAll(back as Inputs).rebar.count).toBe(6)
  })

  it('survives a share-link round trip', () => {
    const token = encodeInputs(DEFAULT_INPUTS)
    expect(decodeInputs(token)).toEqual(DEFAULT_INPUTS)
    expect(decodeInputs('!!!not-base64!!!')).toBeNull()
  })
})
