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
  concreteGeometry,
  minBarSpacing,
} from './geometry'
import type { BarRow, Inputs } from '../types'
import { decodeInputs, encodeInputs } from '../share'
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
