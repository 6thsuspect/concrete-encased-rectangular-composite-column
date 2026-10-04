import type { Inputs, StepGroup } from '../types'
import { fmt } from '../format'
import type { SectionProps } from './section'
import type { MemberResult } from './member'
import type { AxisCalc } from './interaction'

const n = fmt

export interface ShearResult {
  AvY: number
  AvZ: number
  VdY: number
  VdZ: number
  ratioY: number
  ratioZ: number
  group: StepGroup
}

export function shearResults(i: Inputs, s: SectionProps): ShearResult {
  const AvY = i.h * i.tw
  const AvZ = 2 * i.bf * i.tf
  const VdY = (AvY * i.fy) / Math.sqrt(3) / 1000
  const VdZ = (AvZ * i.fy) / Math.sqrt(3) / 1000
  const ratioY = s.Vy / VdY
  const ratioZ = s.Vz / VdZ

  const shearNote = (ratio: number) =>
    ratio < 0.6
      ? `V/Vd = ${n(ratio, 4)} < 0.6 → the effect of shear on the moment and axial resistances is ignored.`
      : `V/Vd = ${n(ratio, 4)} ≥ 0.6 → the interaction with shear must be considered explicitly (outside the scope of the simplified method used here).`

  const group: StepGroup = {
    id: 'shear',
    title: 'Shear design',
    subtitle: 'Plastic shear resistance of the embedded steel section in both principal directions.',
    source: 'workbook sheet 6 "Shear+DC", rows 1–17',
    steps: [
      {
        id: 'AvY',
        symbol: 'Av,y',
        label: 'shear area, y direction (steel web)',
        formula: 'Av,y = h tw',
        substitution: `= ${n(i.h, 0)} × ${n(i.tw, 2)}`,
        value: AvY,
        unit: 'mm²',
        decimals: 2,
        ref: '6.Shear+DC!D5',
        check: false,
      },
      {
        id: 'VdY',
        symbol: 'Vd,y',
        label: 'shear resistance, y direction',
        formula: 'Av,y fy / √3',
        substitution: `= ${n(AvY, 2)} × ${n(i.fy, 2)} / √3 / 1000`,
        value: VdY,
        unit: 'kN',
        decimals: 1,
        ref: '6.Shear+DC!D7',
      },
      {
        id: 'ratioY',
        symbol: 'Vy/Vd,y',
        label: 'shear utilisation, y direction',
        formula: 'Vy / Vd,y',
        substitution: `= ${n(s.Vy, 2)} / ${n(VdY, 1)}`,
        value: ratioY,
        unit: '—',
        decimals: 4,
        ref: '6.Shear+DC!D8',
        status: ratioY < 0.6 ? 'ok' : 'warn',
        note: shearNote(ratioY),
      },
      {
        id: 'AvZ',
        symbol: 'Av,z',
        label: 'shear area, z direction (steel flanges)',
        formula: 'Av,z = 2 bf tf',
        substitution: `= 2 × ${n(i.bf, 0)} × ${n(i.tf, 2)}`,
        value: AvZ,
        unit: 'mm²',
        decimals: 2,
        ref: '6.Shear+DC!D13',
        check: false,
      },
      {
        id: 'VdZ',
        symbol: 'Vd,z',
        label: 'shear resistance, z direction',
        formula: 'Av,z fy / √3',
        substitution: `= ${n(AvZ, 2)} × ${n(i.fy, 2)} / √3 / 1000`,
        value: VdZ,
        unit: 'kN',
        decimals: 1,
        ref: '6.Shear+DC!D15',
      },
      {
        id: 'ratioZ',
        symbol: 'Vz/Vd,z',
        label: 'shear utilisation, z direction',
        formula: 'Vz / Vd,z',
        substitution: `= ${n(s.Vz, 2)} / ${n(VdZ, 1)}`,
        value: ratioZ,
        unit: '—',
        decimals: 4,
        ref: '6.Shear+DC!D16',
        status: ratioZ < 0.6 ? 'ok' : 'warn',
        note: shearNote(ratioZ),
      },
    ],
    notes: [shearNote(ratioY), shearNote(ratioZ)],
  }

  return { AvY, AvZ, VdY, VdZ, ratioY, ratioZ, group }
}

/* ------------------------------------------------------------------ */
/* Demand / capacity                                                   */
/* ------------------------------------------------------------------ */

export interface DcResult {
  PcY: number
  PcZ: number
  chiCY: number
  chiCZ: number
  chiDY: number
  chiDZ: number
  muDDY: number
  muDDZ: number
  ratioY: number
  ratioZ: number
  total: number
  alphaMmY: number
  alphaMmZ: number
  group: StepGroup
}

export function dcResults(
  i: Inputs,
  s: SectionProps,
  mem: MemberResult,
  axes: Record<'z' | 'y', AxisCalc>,
): DcResult {
  const alphaMmY = 0.9
  const alphaMmZ = 0.9

  const PcY = (s.Ac * (i.alphaCC / i.gammaC) * i.eta * mem.lambdaY * i.fck) / 1000
  const PcZ = (s.Ac * (i.alphaCC / i.gammaC) * i.eta * mem.lambdaZ * i.fck) / 1000

  const chiCY = PcY / mem.Pd
  const chiCZ = PcZ / mem.Pd
  const chiDY = s.P / mem.Pd
  const chiDZ = s.P / mem.Pd

  const muDDY = 1 - ((1 - mem.chiY) * chiDY) / ((1 - chiCY) * mem.chiY)
  const muDDZ = 1 - ((1 - mem.chiZ) * chiDZ) / ((1 - chiCZ) * mem.chiZ)

  const ratioY = axes.y.M2nd / (muDDY * axes.y.Md)
  const ratioZ = axes.z.M2nd / (muDDZ * axes.z.Md)
  const total = ratioY + ratioZ

  const group: StepGroup = {
    id: 'dc',
    title: 'Demand / capacity ratio',
    subtitle:
      'Combined axial force and biaxial bending using the simplified interaction curve of the code; the larger of the two axis ratios is compared with αmm.',
    source: 'workbook sheet 6 "Shear+DC", rows 19–50',
    steps: [
      {
        id: 'PcY',
        symbol: 'Pc,y',
        label: 'axial resistance ratio term due to concrete, minor axis',
        formula: 'Ac (αcc/γc) η λy fck',
        substitution: `= ${n(s.Ac, 2)} × (${n(i.alphaCC, 2)} / ${n(i.gammaC, 2)}) × ${n(i.eta, 2)} × ${n(mem.lambdaY, 4)} × ${n(i.fck, 0)} / 1000`,
        value: PcY,
        unit: 'kN',
        decimals: 2,
        ref: '6.Shear+DC!D22',
        check: false,
      },
      {
        id: 'PcZ',
        symbol: 'Pc,z',
        label: 'axial resistance ratio term due to concrete, major axis',
        formula: 'Ac (αcc/γc) η λz fck',
        substitution: `= ${n(s.Ac, 2)} × (${n(i.alphaCC, 2)} / ${n(i.gammaC, 2)}) × ${n(i.eta, 2)} × ${n(mem.lambdaZ, 4)} × ${n(i.fck, 0)} / 1000`,
        value: PcZ,
        unit: 'kN',
        decimals: 2,
        ref: '6.Shear+DC!D24',
        check: false,
      },
      {
        id: 'chiCY',
        symbol: 'χc,y',
        label: 'axial resistance ratio, minor axis',
        formula: 'Pc,y / Pd,y',
        substitution: `= ${n(PcY, 2)} / ${n(mem.Pd, 2)}`,
        value: chiCY,
        unit: '—',
        decimals: 4,
        ref: '6.Shear+DC!D27',
        check: false,
      },
      {
        id: 'chiCZ',
        symbol: 'χc,z',
        label: 'axial resistance ratio, major axis',
        formula: 'Pc,z / Pd,z',
        substitution: `= ${n(PcZ, 2)} / ${n(mem.Pd, 2)}`,
        value: chiCZ,
        unit: '—',
        decimals: 4,
        ref: '6.Shear+DC!D29',
        check: false,
      },
      {
        id: 'chiDY',
        symbol: 'χd,y = χd,z',
        label: 'axial force utilisation',
        formula: 'P / Pd',
        substitution: `= ${n(s.P, 2)} / ${n(mem.Pd, 2)}`,
        value: chiDY,
        unit: '—',
        decimals: 4,
        ref: '6.Shear+DC!D31',
        status: chiDY < chiCY ? 'ok' : 'warn',
        note:
          chiDY < chiCY
            ? `χd,y = ${n(chiDY, 4)} < ${n(chiCY, 4)} = χc,y → the simplified linear interaction may be used.`
            : `χd,y = ${n(chiDY, 4)} ≥ ${n(chiCY, 4)} = χc,y → the design point lies in the curvilinear part of the interaction diagram.`,
      },
      {
        id: 'muDDY',
        symbol: 'μdd,y',
        label: 'moment resistance ratio from the simplified interaction curve, minor axis',
        formula: '1 − (1 − χy) χd,y / ((1 − χc,y) χy)',
        substitution: `= 1 − (1 − ${n(mem.chiY, 4)}) × ${n(chiDY, 4)} / ((1 − ${n(chiCY, 4)}) × ${n(mem.chiY, 4)})`,
        value: muDDY,
        unit: '—',
        decimals: 4,
        ref: '6.Shear+DC!D38',
        check: false,
      },
      {
        id: 'muDDZ',
        symbol: 'μdd,z',
        label: 'moment resistance ratio from the simplified interaction curve, major axis',
        formula: '1 − (1 − χz) χd,z / ((1 − χc,z) χz)',
        substitution: `= 1 − (1 − ${n(mem.chiZ, 4)}) × ${n(chiDZ, 4)} / ((1 − ${n(chiCZ, 4)}) × ${n(mem.chiZ, 4)})`,
        value: muDDZ,
        unit: '—',
        decimals: 4,
        ref: '6.Shear+DC!D43',
        check: false,
      },
      {
        id: 'ratioY',
        symbol: 'My/(μdd,y Md,y)',
        label: 'minor-axis demand/capacity ratio',
        formula: 'My / (μdd,y Md,y)',
        substitution: `= ${n(axes.y.M2nd, 3)} / (${n(muDDY, 4)} × ${n(axes.y.Md, 3)})`,
        value: ratioY,
        unit: '—',
        decimals: 4,
        ref: '6.Shear+DC!D45',
        status: ratioY < alphaMmY ? 'ok' : 'fail',
        note: `${n(ratioY, 4)} ${ratioY < alphaMmY ? '<' : '>'} ${alphaMmY} = αmm (minor axis)`,
      },
      {
        id: 'ratioZ',
        symbol: 'Mz/(μdd,z Md,z)',
        label: 'major-axis demand/capacity ratio',
        formula: 'Mz / (μdd,z Md,z)',
        substitution: `= ${n(axes.z.M2nd, 3)} / (${n(muDDZ, 4)} × ${n(axes.z.Md, 3)})`,
        value: ratioZ,
        unit: '—',
        decimals: 4,
        ref: '6.Shear+DC!D46',
        status: ratioZ < alphaMmZ ? 'ok' : 'fail',
        note: `${n(ratioZ, 4)} ${ratioZ < alphaMmZ ? '<' : '>'} ${alphaMmZ} = αmm (major axis)`,
      },
      {
        id: 'total',
        symbol: 'D/C',
        label: 'combined axial and biaxial bending demand/capacity ratio',
        formula: 'My/(μdd,y Md,y) + Mz/(μdd,z Md,z)',
        substitution: `= ${n(ratioY, 4)} + ${n(ratioZ, 4)}`,
        value: total,
        unit: '—',
        decimals: 3,
        ref: '6.Shear+DC!D48',
        status: total <= 1 ? 'ok' : 'fail',
        note: total <= 1 ? 'D/C ≤ 1.0 — the section is adequate.' : 'D/C > 1.0 — the section is NOT adequate; the design is governed by this value.',
      },
    ],
    notes: [
      `The D/C ratio of ${n(total, 3)} governs the design.`,
      'αmm = 0.9 is the moment-utilisation threshold quoted in the benchmark; the governing criterion of the method is the combined demand/capacity ratio.',
    ],
  }

  return {
    PcY,
    PcZ,
    chiCY,
    chiCZ,
    chiDY,
    chiDZ,
    muDDY,
    muDDZ,
    ratioY,
    ratioZ,
    total,
    alphaMmY,
    alphaMmZ,
    group,
  }
}
