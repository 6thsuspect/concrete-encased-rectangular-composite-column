import type { Inputs, StepGroup } from '../types'
import { fmt } from '../format'
import type { SectionProps } from './section'

const n = fmt

export interface MemberResult {
  EIeZ: number
  EIeY: number
  PcrZ: number
  PcrY: number
  Pn: number
  Pd: number
  delta: number
  lambdaZ: number
  lambdaY: number
  phiZ: number
  phiY: number
  chiZ: number
  chiY: number
  psi: number
  Cmm: number
  kZ: number
  kY: number
  kZAdopted: number
  kYAdopted: number
  MzSec: number
  MySec: number
  utilZ: number
  utilY: number
  applicability: { ok: boolean; reasons: string[] }
  memberGroup: StepGroup
  globalGroup: StepGroup
}

const CURVE_Z = { name: 'b', alpha: 0.34 }
const CURVE_Y = { name: 'c', alpha: 0.49 }

export function memberResults(i: Inputs, s: SectionProps): MemberResult {
  const P = s.P

  /* ---------------- effective flexural stiffness (simplified method) ---------------- */
  const EIeZ = (i.Es * s.IsZ + 0.6 * i.Ecm * s.IcZ + i.Est * s.IstZ) / 1e9 // kN-m^2
  const EIeY = (i.Es * s.IsY + 0.6 * i.Ecm * s.IcY + i.Est * s.IstZ) / 1e9

  const LzM = (i.Kz * i.Lz) / 1000
  const LyM = (i.Ky * i.Ly) / 1000
  const PcrZ = (Math.PI ** 2 * EIeZ) / LzM ** 2
  const PcrY = (Math.PI ** 2 * EIeY) / LyM ** 2

  /* ---------------- axial strength ---------------- */
  const Pn = (s.As * i.fy + s.Ast * i.fyk + 0.8 * s.Ac * i.alphaC * i.fck) / 1000
  const Pd = (s.As * i.fy) / i.gammaM0 / 1000 + (s.Ast * i.fyk) / i.gammaK / 1000 + (0.68 * s.Ac * i.fck) / i.gammaC / 1000
  const delta = (s.As * i.fy) / (Pd * 1000 * i.gammaM0)

  const lambdaZ = Math.sqrt(Pn / PcrZ)
  const lambdaY = Math.sqrt(Pn / PcrY)

  /* ---------------- applicability of the simplified method ---------------- */
  const reasons: string[] = []
  if (!(delta > 0.2 && delta < 0.9)) reasons.push(`δ = ${n(delta, 3)} is outside 0.2 < δ < 0.9`)
  if (!(lambdaZ < 2.0)) reasons.push(`λz = ${n(lambdaZ, 3)} is not < 2.0`)
  if (!(lambdaY < 2.0)) reasons.push(`λy = ${n(lambdaY, 3)} is not < 2.0`)
  const applicability = { ok: reasons.length === 0, reasons }

  /* ---------------- global buckling (sheet 5) ---------------- */
  const alphaImpZ = i.alphaImpZ
  const alphaImpY = i.alphaImpY
  const phiZ = 0.5 * (1 + alphaImpZ * (lambdaZ - 0.2) + lambdaZ ** 2)
  const phiY = 0.5 * (1 + alphaImpY * (lambdaY - 0.2) + lambdaY ** 2)
  const chiZ = 1 / (phiZ + Math.sqrt(phiZ ** 2 - lambdaZ ** 2))
  const chiY = 1 / (phiY + Math.sqrt(phiY ** 2 - lambdaY ** 2))
  const utilZ = P / (chiZ * Pd)
  const utilY = P / (chiY * Pd)

  /* ---------------- second-order moments ---------------- */
  const psi = i.psi
  const Cmm = Math.max(0.6 + 0.4 * psi, 0.4)
  const kZ = Cmm / (1 - P / PcrZ)
  const kY = Cmm / (1 - P / PcrY)
  const kZAdopted = kZ < 1 ? 1 : kZ
  const kYAdopted = kY < 1 ? 1 : kY
  const MzSec = kZAdopted * i.Mz
  const MySec = kYAdopted * i.My

  const cApplies = (lambda: number) =>
    lambda > 0.2
      ? `λ = ${n(lambda, 3)} > 0.2 → second-order effects must be considered`
      : `λ = ${n(lambda, 3)} ≤ 0.2 → second-order effects may be neglected`

  const memberGroup: StepGroup = {
    id: 'member',
    title: 'Simplified method — effective stiffness and axial resistance',
    subtitle:
      'Effective flexural stiffness, elastic critical force, axial resistances and the applicability checks of the simplified interaction-curve method.',
    source: 'workbook sheet 4 "z-Buckling"',
    steps: [
      {
        id: 'EIeZ',
        symbol: '(EI)e,z',
        label: 'effective flexural stiffness, major axis',
        formula: 'Es Is,z + 0.6 Ecm Ic,z + Est Ist,z',
        substitution: `= (${n(i.Es, 0)} × ${n(s.IsZ, 0)} + 0.6 × ${n(i.Ecm, 0)} × ${n(s.IcZ, 0)} + ${n(i.Est, 0)} × ${n(s.IstZ, 0)}) / 10⁹`,
        value: EIeZ,
        unit: 'kN-m²',
        decimals: 1,
        ref: '4.z-Buckling!E7',
        note: '0.6 Ecm per the simplified method of the code',
      },
      {
        id: 'EIeY',
        symbol: '(EI)e,y',
        label: 'effective flexural stiffness, minor axis',
        formula: 'Es Is,y + 0.6 Ecm Ic,y + Est Ist,y',
        substitution: `= (${n(i.Es, 0)} × ${n(s.IsY, 0)} + 0.6 × ${n(i.Ecm, 0)} × ${n(s.IcY, 0)} + ${n(i.Est, 0)} × ${n(s.IstZ, 0)}) / 10⁹`,
        value: EIeY,
        unit: 'kN-m²',
        decimals: 1,
        ref: '4.z-Buckling!E9',
      },
      {
        id: 'PcrZ',
        symbol: 'Pcr,z',
        label: 'elastic critical force, major axis',
        formula: 'π² (EI)e,z / (Kz Lz)²',
        substitution: `= π² × ${n(EIeZ, 1)} / (${n(i.Kz, 2)} × ${n(i.Lz / 1000, 3)})²`,
        value: PcrZ,
        unit: 'kN',
        decimals: 1,
        ref: '4.z-Buckling!E11',
        check: false,
      },
      {
        id: 'PcrY',
        symbol: 'Pcr,y',
        label: 'elastic critical force, minor axis',
        formula: 'π² (EI)e,y / (Ky Ly)²',
        substitution: `= π² × ${n(EIeY, 1)} / (${n(i.Ky, 2)} × ${n(i.Ly / 1000, 3)})²`,
        value: PcrY,
        unit: 'kN',
        decimals: 1,
        ref: '4.z-Buckling!E13',
        check: false,
      },
      {
        id: 'Pn',
        symbol: 'Pn',
        label: 'nominal axial compressive strength',
        formula: 'As fy + Ast fyk + 0.8 Ac αc fck',
        substitution: `= (${n(s.As, 1)} × ${n(i.fy, 0)} + ${n(s.Ast, 1)} × ${n(i.fyk, 0)} + 0.8 × ${n(s.Ac, 1)} × ${n(i.alphaC, 2)} × ${n(i.fck, 0)}) / 1000`,
        value: Pn,
        unit: 'kN',
        decimals: 1,
        ref: '4.z-Buckling!E15',
        check: false,
      },
      {
        id: 'Pd',
        symbol: 'Pd',
        label: 'design axial compressive strength',
        formula: 'As fy/γm0 + Ast fyk/γk + 0.68 Ac fck/γc',
        substitution: `= (${n(s.As, 1)} × ${n(i.fy, 0)} / ${n(i.gammaM0, 2)} + ${n(s.Ast, 1)} × ${n(i.fyk, 0)} / ${n(i.gammaK, 2)} + 0.68 × ${n(s.Ac, 1)} × ${n(i.fck, 0)} / ${n(i.gammaC, 2)}) / 1000`,
        value: Pd,
        unit: 'kN',
        decimals: 1,
        ref: '4.z-Buckling!E18',
        note: 'the coefficient 0.68 = 0.8 αc folds the concrete stress-block factor into the resistance',
      },
      {
        id: 'delta',
        symbol: 'δ',
        label: 'steel contribution ratio',
        formula: 'As fy / (Pd γm0)',
        substitution: `= ${n(s.As, 1)} × ${n(i.fy, 0)} / (${n(Pd, 1)} × 1000 × ${n(i.gammaM0, 2)})`,
        value: delta,
        unit: '—',
        decimals: 3,
        ref: '4.z-Buckling!E20',
        status: delta > 0.2 && delta < 0.9 ? 'ok' : 'fail',
        note:
          delta > 0.2 && delta < 0.9
            ? '0.2 < δ < 0.9 → the simplified method is applicable'
            : 'δ outside 0.2 … 0.9 — the simplified method is not applicable',
      },
      {
        id: 'lambdaZ',
        symbol: 'λz',
        label: 'relative slenderness, major axis',
        formula: '√(Pn / Pcr,z)',
        substitution: `= √(${n(Pn, 1)} / ${n(PcrZ, 1)})`,
        value: lambdaZ,
        unit: '—',
        decimals: 3,
        ref: '4.z-Buckling!E23',
        status: lambdaZ < 2 ? 'ok' : 'fail',
        note: lambdaZ < 2 ? 'λz < 2.0' : 'λz ≥ 2.0 — outside the range of applicability',
      },
      {
        id: 'lambdaY',
        symbol: 'λy',
        label: 'relative slenderness, minor axis',
        formula: '√(Pn / Pcr,y)',
        substitution: `= √(${n(Pn, 1)} / ${n(PcrY, 1)})`,
        value: lambdaY,
        unit: '—',
        decimals: 3,
        ref: '4.z-Buckling!E25',
        status: lambdaY < 2 ? 'ok' : 'fail',
        note: lambdaY < 2 ? 'λy < 2.0' : 'λy ≥ 2.0 — outside the range of applicability',
      },
    ],
    notes: applicability.ok
      ? [
          `δ = ${n(delta, 2)}, λz = ${n(lambdaZ, 2)}, λy = ${n(lambdaY, 2)} → the simplified method can be used.`,
        ]
      : ['The simplified method is outside its range of applicability for the current input set.'],
  }

  const globalGroup: StepGroup = {
    id: 'global',
    title: 'Global buckling and second-order moments',
    subtitle: 'Reduction factors from the buckling curves and the amplified design moments.',
    source: 'workbook sheet 5 "Global+2nd"',
    steps: [
      {
        id: 'curveZ',
        symbol: 'αz',
        label: `imperfection factor, buckling curve ${CURVE_Z.name} (z-axis)`,
        formula: 'recommended value of the code',
        substitution: `αz = ${n(alphaImpZ, 2)}`,
        value: alphaImpZ,
        unit: '—',
        decimals: 2,
        ref: '5.Global+2nd!D4',
        check: false,
      },
      {
        id: 'phiZ',
        symbol: 'Φz',
        label: 'buckling parameter, major axis',
        formula: '0.5 [1 + αz (λz − 0.2) + λz²]',
        substitution: `= 0.5 × [1 + ${n(alphaImpZ, 2)} × (${n(lambdaZ, 3)} − 0.2) + ${n(lambdaZ, 3)}²]`,
        value: phiZ,
        unit: '—',
        decimals: 4,
        ref: '5.Global+2nd!D6',
        check: false,
      },
      {
        id: 'chiZ',
        symbol: 'χz',
        label: 'axial reduction factor, major axis',
        formula: '1 / (Φz + √(Φz² − λz²))',
        substitution: `= 1 / (${n(phiZ, 4)} + √(${n(phiZ, 4)}² − ${n(lambdaZ, 3)}²))`,
        value: chiZ,
        unit: '—',
        decimals: 3,
        ref: '5.Global+2nd!D8',
        check: false,
      },
      {
        id: 'utilZ',
        symbol: 'P/(χz Pd)',
        label: 'axial utilisation ratio, major axis',
        formula: 'P / (χz Pd)',
        substitution: `= ${n(P, 1)} / (${n(chiZ, 3)} × ${n(Pd, 1)})`,
        value: utilZ,
        unit: '—',
        decimals: 3,
        ref: '5.Global+2nd!D9',
        status: utilZ <= 1 ? 'ok' : 'fail',
        note: utilZ <= 1 ? '≤ 1.0' : '> 1.0 — the axial capacity is exceeded',
      },
      {
        id: 'curveY',
        symbol: 'αy',
        label: `imperfection factor, buckling curve ${CURVE_Y.name} (y-axis)`,
        formula: 'recommended value of the code',
        substitution: `αy = ${n(alphaImpY, 2)}`,
        value: alphaImpY,
        unit: '—',
        decimals: 2,
        ref: '5.Global+2nd!D12',
        check: false,
      },
      {
        id: 'phiY',
        symbol: 'Φy',
        label: 'buckling parameter, minor axis',
        formula: '0.5 [1 + αy (λy − 0.2) + λy²]',
        substitution: `= 0.5 × [1 + ${n(alphaImpY, 2)} × (${n(lambdaY, 3)} − 0.2) + ${n(lambdaY, 3)}²]`,
        value: phiY,
        unit: '—',
        decimals: 4,
        ref: '5.Global+2nd!D14',
        check: false,
      },
      {
        id: 'chiY',
        symbol: 'χy',
        label: 'axial reduction factor, minor axis',
        formula: '1 / (Φy + √(Φy² − λy²))',
        substitution: `= 1 / (${n(phiY, 4)} + √(${n(phiY, 4)}² − ${n(lambdaY, 3)}²))`,
        value: chiY,
        unit: '—',
        decimals: 3,
        ref: '5.Global+2nd!D16',
        check: false,
      },
      {
        id: 'utilY',
        symbol: 'P/(χy Pd)',
        label: 'axial utilisation ratio, minor axis',
        formula: 'P / (χy Pd)',
        substitution: `= ${n(P, 1)} / (${n(chiY, 3)} × ${n(Pd, 1)})`,
        value: utilY,
        unit: '—',
        decimals: 3,
        ref: '5.Global+2nd!D17',
        status: utilY <= 1 ? 'ok' : 'fail',
        note: utilY <= 1 ? '≤ 1.0' : '> 1.0 — the axial capacity is exceeded',
      },
      {
        id: 'Cmm',
        symbol: 'Cmm',
        label: 'equivalent uniform moment factor',
        formula: '0.6 + 0.4 ψ',
        substitution: `= 0.6 + 0.4 × ${n(psi, 2)}`,
        value: Cmm,
        unit: '—',
        decimals: 3,
        ref: '5.Global+2nd!D26',
        note: `ψ = M1/M2 = ${n(psi, 2)} (linear first-order moment diagram)`,
        check: false,
      },
      {
        id: 'kZ',
        symbol: 'kz',
        label: 'moment amplification factor, major axis',
        formula: 'Cmm / (1 − P/Pcr,z)',
        substitution: `= ${n(Cmm, 3)} / (1 − ${n(P, 1)} / ${n(PcrZ, 1)})`,
        value: kZ,
        unit: '—',
        decimals: 3,
        ref: '5.Global+2nd!D28',
        status: kZ < 1 ? 'ok' : 'warn',
        note:
          kZ < 1
            ? `kz = ${n(kZ, 3)} < 1.0 → kz = 1.0 is adopted`
            : `kz = ${n(kZ, 3)} ≥ 1.0 → adopted`,
      },
      {
        id: 'MzSec',
        symbol: 'Mz',
        label: 'second-order design moment, major axis',
        formula: 'Mz = kz Mz,edge',
        substitution: `= ${n(kZAdopted, 3)} × ${n(i.Mz, 1)}`,
        value: MzSec,
        unit: 'kN-m',
        decimals: 1,
        ref: '5.Global+2nd!D31',
        check: false,
      },
      {
        id: 'kY',
        symbol: 'ky',
        label: 'moment amplification factor, minor axis',
        formula: 'Cmm / (1 − P/Pcr,y)',
        substitution: `= ${n(Cmm, 3)} / (1 − ${n(P, 1)} / ${n(PcrY, 1)})`,
        value: kY,
        unit: '—',
        decimals: 3,
        ref: '5.Global+2nd!D37',
        status: kY < 1 ? 'ok' : 'warn',
        note:
          kY < 1
            ? `ky = ${n(kY, 3)} < 1.0 → ky = 1.0 is adopted`
            : `ky = ${n(kY, 3)} ≥ 1.0 → adopted`,
      },
      {
        id: 'MySec',
        symbol: 'My',
        label: 'second-order design moment, minor axis',
        formula: 'My = ky My,edge',
        substitution: `= ${n(kYAdopted, 3)} × ${n(i.My, 1)}`,
        value: MySec,
        unit: 'kN-m',
        decimals: 1,
        ref: '5.Global+2nd!D40',
        check: false,
      },
    ],
    notes: [cApplies(lambdaZ), cApplies(lambdaY)],
  }

  return {
    EIeZ,
    EIeY,
    PcrZ,
    PcrY,
    Pn,
    Pd,
    delta,
    lambdaZ,
    lambdaY,
    phiZ,
    phiY,
    chiZ,
    chiY,
    psi,
    Cmm,
    kZ,
    kY,
    kZAdopted,
    kYAdopted,
    MzSec,
    MySec,
    utilZ,
    utilY,
    applicability,
    memberGroup,
    globalGroup,
  }
}
