import { describe, expect, it } from 'vitest'
import { computeAll } from './index'
import { DEFAULT_INPUTS, PRESETS } from './defaults'
import { compareToReference } from '../reference'

const r = computeAll(DEFAULT_INPUTS)

describe('reference example (CSI CCD Example 001)', () => {
  it('reproduces the required strengths at mid-height', () => {
    expect(r.required.P).toBeCloseTo(1800, 6)
    expect(r.required.MzMid).toBeCloseTo(190, 6)
    expect(r.required.MyMid).toBeCloseTo(25, 6)
    expect(r.required.Vy).toBeCloseTo(54.2857, 3)
    expect(r.required.Vz).toBeCloseTo(7.14286, 4)
  })

  it('reproduces the section properties', () => {
    expect(r.steel.As).toBeCloseTo(11224.3, 1)
    expect(r.steel.IsZ).toBeCloseTo(140676409, 0)
    expect(r.steel.IsY).toBeCloseTo(48396050, 0)
    expect(r.steel.ZpsZ).toBeCloseTo(1208233.3, 1)
    expect(r.steel.ZpsY).toBeCloseTo(573098.99, 1)
    expect(r.rebar.Ast).toBeCloseTo(452.389, 3)
    expect(r.rebar.IstZ).toBeCloseTo(11440926.46, 1)
    expect(r.rebar.ZprZ).toBeCloseTo(71929.905, 3)
    expect(r.concrete.Ac).toBeCloseTo(148323.31, 1)
    expect(r.concrete.IcZ).toBeCloseTo(1981215997.9, 0)
    expect(r.concrete.IcY).toBeCloseTo(2073496356.7, 0)
    expect(r.concrete.ZpcZ).toBeCloseTo(14719836.79, 1)
    expect(r.concrete.ZpcY).toBeCloseTo(15354971.11, 1)
  })

  it('reproduces the simplified-method quantities', () => {
    expect(r.member.EIeZ).toBeCloseTo(64384.78, 1)
    expect(r.member.EIeY).toBeCloseTo(46522.22, 1)
    expect(r.member.PcrZ).toBeCloseTo(12968.41, 1)
    expect(r.member.PcrY).toBeCloseTo(9370.53, 1)
    expect(r.member.Pn).toBeCloseTo(7085.92, 1)
    expect(r.member.Pd).toBeCloseTo(5700.80, 1)
    expect(r.member.delta).toBeCloseTo(0.61752, 4)
    expect(r.member.lambdaZ).toBeCloseTo(0.73919, 4)
    expect(r.member.lambdaY).toBeCloseTo(0.86959, 4)
    expect(r.member.applicability.ok).toBe(true)
  })

  it('reproduces the global buckling reduction factors', () => {
    expect(r.global.phiZ).toBeCloseTo(0.86486, 4)
    expect(r.global.chiZ).toBeCloseTo(0.76112, 4)
    expect(r.global.phiY).toBeCloseTo(1.04215, 4)
    expect(r.global.chiY).toBeCloseTo(0.61862, 4)
    expect(r.axes.z.utilisation).toBeCloseTo(0.41484, 4)
    expect(r.axes.y.utilisation).toBeCloseTo(0.51040, 4)
  })

  it('reproduces the interaction point C of the z-axis (major axis)', () => {
    expect(r.axes.z.hn).toBeCloseTo(78.1340, 3)
    expect(r.axes.z.hnAdopted).toBeCloseTo(78.5, 6)
    expect(r.axes.z.zpsn).toBeCloseTo(64703.625, 2)
    expect(r.axes.z.zpcn).toBeCloseTo(2400196.375, 2)
    expect(r.axes.z.PdC).toBeCloseTo(1835.387, 2)
    expect(r.axes.z.Md).toBeCloseTo(468.383, 2)
    expect(r.axes.z.Mmax).toBeCloseTo(504.998, 2)
  })

  it('reproduces the interaction point C of the y-axis (minor axis)', () => {
    expect(r.axes.y.hn).toBeCloseTo(95.1367, 3)
    expect(r.axes.y.hnAdopted).toBeCloseTo(95.2, 6)
    expect(r.axes.y.PdC).toBeCloseTo(3883.757, 1)
    expect(r.axes.y.Md).toBeCloseTo(187.340, 2)
    expect(r.axes.y.Mmax).toBeCloseTo(310.116, 2)
  })

  it('reproduces shear and the demand/capacity ratio', () => {
    expect(r.axes.y.Vd).toBeCloseTo(543.777, 2)
    expect(r.axes.z.Vd).toBeCloseTo(1764.309, 2)
    expect(r.dc.PcY).toBeCloseTo(2579.619, 2)
    expect(r.dc.PcZ).toBeCloseTo(2192.775, 2)
    expect(r.dc.muDDY).toBeCloseTo(0.6440, 3)
    expect(r.dc.muDDZ).toBeCloseTo(0.8390, 3)
    expect(r.dc.ratioY).toBeCloseTo(0.4146, 3)
    expect(r.dc.ratioZ).toBeCloseTo(0.9675, 3)
    expect(r.dc.total).toBeGreaterThan(1)
  })

  it('matches the published results within the reported tolerances', () => {
    const rows = compareToReference(r)
    const failing = rows.filter((row) => !row.pass)
    expect(failing.map((f) => `${f.label}: ${f.value.toFixed(4)} vs ${f.reference}`)).toEqual([])
    expect(rows.length).toBe(12)
  })

  it('rounds the demand/capacity ratio to the two published values', () => {
    // report 1.377, workbook 1.381
    expect(r.dc.total).toBeGreaterThan(1.375)
    expect(r.dc.total).toBeLessThan(1.383)
  })
})

describe('interaction diagrams', () => {
  it('passes through the key points A, C, D and B', () => {
    for (const axis of ['z', 'y'] as const) {
      const kp = r.keyPoints[axis]
      const curve = r.axes[axis].curve
      const near = (p: { m: number; p: number }) =>
        curve.some((q) => Math.abs(q.m - p.m) < 2 && Math.abs(q.p - p.p) < 20)
      expect(near(kp.A)).toBe(true)
      expect(near(kp.B)).toBe(true)
      expect(near(kp.C)).toBe(true)
      expect(near(kp.D)).toBe(true)
      expect(curve.length).toBeGreaterThan(100)
    }
  })

  it('decreases monotonically in axial force along the curve', () => {
    for (const axis of ['z', 'y'] as const) {
      const curve = r.axes[axis].curve
      for (let i = 1; i < curve.length; i++) {
        expect(curve[i].p).toBeLessThanOrEqual(curve[i - 1].p + 1e-6)
      }
    }
  })

  it('the bilinear curve ends at zero axial force', () => {
    const b = r.axes.z.bilinear
    expect(b[b.length - 1].p).toBeCloseTo(0, 6)
    expect(b[b.length - 1].m).toBeCloseTo(r.axes.z.Md, 6)
  })
})

describe('presets and overrides', () => {
  it('every preset runs and produces finite results', () => {
    for (const preset of PRESETS) {
      const res = computeAll({ ...DEFAULT_INPUTS, ...preset.patch })
      expect(Number.isFinite(res.dc.total)).toBe(true)
      expect(res.member.Pd).toBeGreaterThan(0)
      expect(Number.isFinite(res.member.lambdaY)).toBe(true)
      expect(res.groups.length).toBe(8)
    }
  })

  it('honours a neutral-axis override', () => {
    const res = computeAll({ ...DEFAULT_INPUTS, hnZOverride: 78.6 })
    expect(res.axes.z.hnAdopted).toBeCloseTo(78.6, 6)
    expect(res.axes.z.hnOverridden).toBe(true)
    // PDF-reported value for hn,z = 78.6 mm
    expect(res.axes.z.PdC).toBeCloseTo(1837.6, 0)
  })

  it('flags the applicability limits when the member becomes very slender', () => {
    const res = computeAll({ ...DEFAULT_INPUTS, Ly: 40000, Lz: 40000 })
    expect(res.member.applicability.ok).toBe(false)
    expect(res.member.lambdaZ).toBeGreaterThan(2)
  })
})
