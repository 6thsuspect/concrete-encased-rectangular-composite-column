import type { Results } from './types'

export interface ReferenceRow {
  id: string
  label: string
  /** value printed in the CSI "Independent" column of the verification report */
  reference: number
  /** value reported by the accompanying workbook summary */
  workbook: number
  unit: string
  decimals: number
  /** absolute tolerance used by the validation panel */
  tolerance: number
  get: (r: Results) => number
  note?: string
}

/**
 * Independent results of the CSI verification report
 * ("IS 11384:2022 CCD Example 001", page 2) together with the values reported
 * by the accompanying workbook summary (sheet 1).
 */
export const REFERENCE_ROWS: ReferenceRow[] = [
  {
    id: 'Pd',
    label: 'Pd',
    reference: 5701,
    workbook: 5701,
    unit: 'kN',
    decimals: 0,
    tolerance: 1,
    get: (r) => r.member.Pd,
  },
  {
    id: 'PdCz',
    label: "P'd,C,z",
    reference: 1837,
    workbook: 1835,
    unit: 'kN',
    decimals: 0,
    tolerance: 4,
    get: (r) => r.axes.z.PdC,
    note: 'the report prints 1836.7 kN for hn,z = 78.6 mm; the workbook adopts hn,z = 78.5 mm (as truncated here) and reports 1835 kN',
  },
  {
    id: 'PdCy',
    label: "P'd,C,y",
    reference: 3859,
    workbook: 3884,
    unit: 'kN',
    decimals: 0,
    tolerance: 30,
    get: (r) => r.axes.y.PdC,
    note: 'the published y-axis equations omit the αc factor of the z-axis equations; reproducing them verbatim gives 3883.8 kN (workbook 3884 kN), while the report prints 3858.6 kN for hn,y = 94.4 mm',
  },
  {
    id: 'chiZ',
    label: 'χz',
    reference: 0.76,
    workbook: 0.76,
    unit: '—',
    decimals: 2,
    tolerance: 0.006,
    get: (r) => r.global.chiZ,
  },
  {
    id: 'chiY',
    label: 'χy',
    reference: 0.62,
    workbook: 0.62,
    unit: '—',
    decimals: 2,
    tolerance: 0.006,
    get: (r) => r.global.chiY,
  },
  {
    id: 'MmaxZ',
    label: 'Mmax,z',
    reference: 505,
    workbook: 505,
    unit: 'kN-m',
    decimals: 0,
    tolerance: 1,
    get: (r) => r.axes.z.Mmax,
  },
  {
    id: 'MdZ',
    label: 'Md,z',
    reference: 468,
    workbook: 468,
    unit: 'kN-m',
    decimals: 0,
    tolerance: 2,
    get: (r) => r.axes.z.Md,
  },
  {
    id: 'MmaxY',
    label: 'Mmax,y',
    reference: 310,
    workbook: 310,
    unit: 'kN-m',
    decimals: 0,
    tolerance: 1,
    get: (r) => r.axes.y.Mmax,
  },
  {
    id: 'MdY',
    label: 'Md,y',
    reference: 189,
    workbook: 187,
    unit: 'kN-m',
    decimals: 0,
    tolerance: 3,
    get: (r) => r.axes.y.Md,
    note: 'the report rounds the y-axis values to one decimal (189.2 kN-m) while the workbook summary shows 187 kN',
  },
  {
    id: 'VdY',
    label: 'Vd,y',
    reference: 544,
    workbook: 544,
    unit: 'kN',
    decimals: 0,
    tolerance: 1,
    get: (r) => r.axes.y.Vd,
  },
  {
    id: 'VdZ',
    label: 'Vd,z',
    reference: 1764,
    workbook: 1764,
    unit: 'kN',
    decimals: 0,
    tolerance: 1,
    get: (r) => r.axes.z.Vd,
  },
  {
    id: 'dc',
    label: 'D/C',
    reference: 1.377,
    workbook: 1.381,
    unit: '—',
    decimals: 3,
    tolerance: 0.008,
    get: (r) => r.dc.total,
    note: 'combined axial force and biaxial bending',
  },
]

export interface ComparisonRow extends ReferenceRow {
  value: number
  delta: number
  /** relative difference, % */
  deltaPercent: number
  pass: boolean
}

export function compareToReference(r: Results): ComparisonRow[] {
  return REFERENCE_ROWS.map((row) => {
    const value = row.get(r)
    const delta = value - row.reference
    return {
      ...row,
      value,
      delta,
      deltaPercent: row.reference === 0 ? 0 : (delta / row.reference) * 100,
      pass: Math.abs(delta) <= row.tolerance,
    }
  })
}
