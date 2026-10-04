import type { Axis, Inputs, Results } from '../types'
import { sectionProperties } from './section'
import { memberResults } from './member'
import { axisCalc } from './interaction'
import { shearResults, dcResults } from './shear'

export { DEFAULT_INPUTS, PRESETS, cloneInputs, inputProblems } from './defaults'
export { ceilTo, interactionCurve, bilinearCurve } from './interaction'

/**
 * Full IS 11384:2022 verification of the concrete-encased rectangular
 * composite column (CSI CCD Example 001).
 */
export function computeAll(i: Inputs): Results {
  const { props: s, group: sectionGroup } = sectionProperties(i)
  const mem = memberResults(i, s)

  const z = axisCalc(i, s, mem, 'z')
  const y = axisCalc(i, s, mem, 'y')
  const axes: Record<Axis, typeof z> = { z, y }

  const shear = shearResults(i, s)
  const dc = dcResults(i, s, mem, axes)

  for (const a of [z, y]) {
    a.Av = a.axis === 'z' ? shear.AvZ : shear.AvY
    a.Vd = a.axis === 'z' ? shear.VdZ : shear.VdY
    a.vRatio = a.axis === 'z' ? shear.ratioZ : shear.ratioY
    a.VEd = a.axis === 'z' ? s.Vz : s.Vy
    a.Pc = a.axis === 'z' ? dc.PcZ : dc.PcY
    a.chiC = a.axis === 'z' ? dc.chiCZ : dc.chiCY
    a.chiD = dc.chiDY
    a.muDD = a.axis === 'z' ? dc.muDDZ : dc.muDDY
    a.dcMoment = a.axis === 'z' ? dc.ratioZ : dc.ratioY
  }

  return {
    inputs: i,
    required: { P: s.P, MzMid: s.MzMid, MyMid: s.MyMid, Vy: s.Vy, Vz: s.Vz },
    steel: { As: s.As, IsZ: s.IsZ, IsY: s.IsY, ZpsZ: s.ZpsZ, ZpsY: s.ZpsY },
    rebar: { Astb: s.Astb, Ast: s.Ast, IstI: s.IstI, IstZ: s.IstZ, ZprZ: s.ZprZ },
    concrete: { Ac: s.Ac, IcZ: s.IcZ, IcY: s.IcY, ZpcZ: s.ZpcZ, ZpcY: s.ZpcY },
    member: {
      EIeZ: mem.EIeZ,
      EIeY: mem.EIeY,
      PcrZ: mem.PcrZ,
      PcrY: mem.PcrY,
      Pn: mem.Pn,
      Pd: mem.Pd,
      delta: mem.delta,
      lambdaZ: mem.lambdaZ,
      lambdaY: mem.lambdaY,
      applicability: mem.applicability,
    },
    axes,
    global: {
      phiZ: mem.phiZ,
      phiY: mem.phiY,
      chiZ: mem.chiZ,
      chiY: mem.chiY,
      psi: mem.psi,
      Cmm: mem.Cmm,
    },
    dc: {
      PcY: dc.PcY,
      PcZ: dc.PcZ,
      chiCY: dc.chiCY,
      chiCZ: dc.chiCZ,
      chiDY: dc.chiDY,
      chiDZ: dc.chiDZ,
      muDDY: dc.muDDY,
      muDDZ: dc.muDDZ,
      ratioY: dc.ratioY,
      ratioZ: dc.ratioZ,
      total: dc.total,
      alphaMmY: dc.alphaMmY,
      alphaMmZ: dc.alphaMmZ,
    },
    keyPoints: {
      z: {
        A: { m: 0, p: mem.Pd },
        B: { m: z.Md, p: z.PdC },
        C: { m: z.Mmax, p: z.PdC / 2 },
        D: { m: z.Md, p: 0 },
      },
      y: {
        A: { m: 0, p: mem.Pd },
        B: { m: y.Md, p: y.PdC },
        C: { m: y.Mmax, p: y.PdC / 2 },
        D: { m: y.Md, p: 0 },
      },
    },
    groups: [sectionGroup, mem.memberGroup, mem.globalGroup, z.group, y.group, shear.group, dc.group],
  }
}
