import type { Axis, AxisResult, Inputs, Point, StepGroup } from '../types'
import { fmt } from '../format'
import type { SectionProps } from './section'
import type { MemberResult } from './member'

const n = fmt

export interface AxisCalc extends AxisResult {
  group: StepGroup
}

/** Excel CEILING(): round away from zero to the nearest multiple of `step`. */
export function ceilTo(value: number, step: number): number {
  return Math.ceil(value / step) * step
}

/**
 * Monotone cubic (Fritsch–Carlson) interpolation of the sample values `y`
 * over unit-spaced nodes: guarantees that a monotone sequence stays monotone
 * (no overshoot into negative axial forces).
 */
function monotoneTangents(y: number[]): number[] {
  const n = y.length
  const d: number[] = []
  for (let i = 0; i < n - 1; i++) d.push(y[i + 1] - y[i])
  const m: number[] = new Array(n)
  m[0] = d[0]
  m[n - 1] = d[n - 2]
  for (let i = 1; i < n - 1; i++) m[i] = (d[i - 1] + d[i]) / 2
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
      continue
    }
    const a = m[i] / d[i]
    const b = m[i + 1] / d[i]
    const s = a * a + b * b
    if (s > 9) {
      const tau = 3 / Math.sqrt(s)
      m[i] = tau * a * d[i]
      m[i + 1] = tau * b * d[i]
    }
  }
  return m
}

/**
 * Interaction diagram of the simplified method: smooth monotone interpolation
 * through the key points A → B → C → D (the reference figure plots the same
 * four points, see the note on the point labels).
 */
export function interactionCurve(A: Point, B: Point, C: Point, D: Point, per = 36): Point[] {
  const pts: Point[] = [A, B, C, D]
  const tm = monotoneTangents(pts.map((p) => p.m))
  const tp = monotoneTangents(pts.map((p) => p.p))
  const out: Point[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const y1 = pts[i]
    const y2 = pts[i + 1]
    const m1 = tm[i]
    const m2 = tm[i + 1]
    const q1 = tp[i]
    const q2 = tp[i + 1]
    for (let j = 0; j < per; j++) {
      const t = j / per
      const t2 = t * t
      const t3 = t2 * t
      const h00 = 2 * t3 - 3 * t2 + 1
      const h10 = t3 - 2 * t2 + t
      const h01 = -2 * t3 + 3 * t2
      const h11 = t3 - t2
      out.push({
        m: h00 * y1.m + h10 * m1 + h01 * y2.m + h11 * m2,
        p: Math.max(0, h00 * y1.p + h10 * q1 + h01 * y2.p + h11 * q2),
      })
    }
  }
  out.push({ m: D.m, p: D.p })
  return out
}

/** Simplified bilinear curve A → B → (B, P = 0). */
export function bilinearCurve(A: Point, B: Point, per = 48): Point[] {
  const out: Point[] = []
  for (let i = 0; i <= per; i++) {
    const t = i / per
    out.push({ m: A.m + (B.m - A.m) * t, p: A.p + (B.p - A.p) * t })
  }
  for (let i = 1; i <= per / 2; i++) {
    const t = i / (per / 2)
    out.push({ m: B.m, p: B.p * (1 - t) })
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Per-axis interaction point C                                        */
/* ------------------------------------------------------------------ */

export function axisCalc(i: Inputs, s: SectionProps, mem: MemberResult, axis: Axis): AxisCalc {
  const isZ = axis === 'z'
  const symbolAxis = isZ ? 'z' : 'y'
  const Astc = 2 * s.Astb

  /* Effective concrete stress-block strength used by the reference.
     The z-axis expressions carry αc; the published y-axis expressions do not
     (an asymmetry of the benchmark which is reproduced here verbatim). */
  const fc = isZ ? (i.alphaC * i.fck) / i.gammaC : i.fck / i.gammaC

  const fyDesign = i.fy / i.gammaM0
  const fykDesign = i.fyk / i.gammaK

  let hnRaw: number
  let numTxt: string
  let denTxt: string
  let symbol: string

  if (isZ) {
    const num = 0.8 * s.Ac * fc - Astc * (2 * fykDesign - 0.8 * fc)
    const den = 1.6 * i.bc * fc + 2 * i.tw * (2 * fyDesign - 0.8 * fc)
    hnRaw = num / den
    symbol =
      '[0.8 Ac αc fck/γc − Astc (2 fyk/γk − 0.8 αc fck/γc)] / [1.6 bc αc fck/γc + 2 tw (2 fy/γm0 − 0.8 αc fck/γc)]'
    numTxt = `(0.8 × ${n(s.Ac, 2)} × ${n(i.alphaC, 2)} × ${n(i.fck, 0)} / ${n(i.gammaC, 2)} − ${n(Astc, 2)} × (2 × ${n(i.fyk, 0)} / ${n(i.gammaK, 2)} − 0.8 × ${n(i.alphaC, 2)} × ${n(i.fck, 0)} / ${n(i.gammaC, 2)}))`
    denTxt = `(1.6 × ${n(i.bc, 0)} × ${n(i.alphaC, 2)} × ${n(i.fck, 0)} / ${n(i.gammaC, 2)} + 2 × ${n(i.tw, 2)} × (2 × ${n(i.fy, 0)} / ${n(i.gammaM0, 2)} − 0.8 × ${n(i.alphaC, 2)} × ${n(i.fck, 0)} / ${n(i.gammaC, 2)}))`
  } else {
    const num =
      0.8 * s.Ac * fc -
      Astc * (2 * fykDesign - 0.8 * fc) -
      i.tw * (2 * i.tf - i.h) * (2 * fyDesign - 0.8 * fc)
    const den = 1.6 * i.hc * fc + 4 * i.tw * (2 * fyDesign - 0.8 * fc)
    hnRaw = num / den
    symbol =
      '[0.8 Ac fck/γc − Astc (2 fyk/γk − 0.8 fck/γc) − tw (2 tf − h) (2 fy/γm0 − 0.8 fck/γc)] / [1.6 hc fck/γc + 4 tw (2 fy/γm0 − 0.8 fck/γc)]'
    numTxt = `(0.8 × ${n(s.Ac, 2)} × ${n(i.fck, 0)} / ${n(i.gammaC, 2)} − ${n(Astc, 2)} × (2 × ${n(i.fyk, 0)} / ${n(i.gammaK, 2)} − 0.8 × ${n(i.fck, 0)} / ${n(i.gammaC, 2)}) − ${n(i.tw, 2)} × (2 × ${n(i.tf, 2)} − ${n(i.h, 0)}) × (2 × ${n(i.fy, 0)} / ${n(i.gammaM0, 2)} − 0.8 × ${n(i.fck, 0)} / ${n(i.gammaC, 2)}))`
    denTxt = `(1.6 × ${n(i.hc, 0)} × ${n(i.fck, 0)} / ${n(i.gammaC, 2)} + 4 × ${n(i.tw, 2)} × (2 × ${n(i.fy, 0)} / ${n(i.gammaM0, 2)} − 0.8 × ${n(i.fck, 0)} / ${n(i.gammaC, 2)}))`
  }

  const override = isZ ? i.hnZOverride : i.hnYOverride
  const step = isZ ? 0.5 : 0.1
  const hnOverridden = override !== null && Number.isFinite(override)
  const hnAdopted = hnOverridden ? (override as number) : ceilTo(hnRaw, step)
  const hn = hnOverridden ? (override as number) : hnRaw

  /* plastic moduli of the parts within 2 hn of the neutral axis */
  const zprn = 0
  const zpsn = isZ ? i.tw * hnAdopted ** 2 : 2 * i.tf * hnAdopted ** 2 + ((i.h - 2 * i.tf) * i.tw ** 2) / 4
  const zpcn = (isZ ? i.bc : i.hc) * hnAdopted ** 2 - zpsn

  const zps = isZ ? s.ZpsZ : s.ZpsY
  const zpc = isZ ? s.ZpcZ : s.ZpcY

  /* axial resistance at interaction point C */
  const PdC = isZ
    ? (1.6 * hnAdopted * i.bc * i.alphaC * i.fck) / i.gammaC / 1000 +
      (4 * hnAdopted * i.tw * (fyDesign - (0.8 * i.fck) / i.gammaC)) / 1000
    : (1.6 * hnAdopted * i.hc * i.fck) / i.gammaC / 1000 +
      ((4 * hnAdopted * i.tf + i.tw * (i.h - 2 * i.tf)) * (fyDesign - (0.8 * i.fck) / i.gammaC)) / 1000

  const Md =
    ((zps - zpsn) * fyDesign + (s.ZprZ - zprn) * fykDesign + 0.4 * i.alphaC * (zpc - zpcn) * (i.fck / i.gammaC)) / 1e6
  const Mmax = (zps * fyDesign + s.ZprZ * fykDesign + 0.4 * i.alphaC * zpc * (i.fck / i.gammaC)) / 1e6

  /* neutral-axis assumption check */
  let naOk: boolean
  let naNote: string
  if (isZ) {
    const limit = i.h / 2 - i.tf
    naOk = hnAdopted <= limit
    naNote = `hn,z = ${n(hnAdopted, 1)} ${naOk ? '≤' : '>'} ${n(limit, 1)} = h/2 − tf → the assumption that the neutral axis lies in the web is ${naOk ? 'valid' : 'NOT valid'}`
  } else {
    const lo = i.tw / 2
    const hi = i.bf / 2
    naOk = hnAdopted > lo && hnAdopted < hi
    naNote = `tw/2 = ${n(lo, 2)} < hn,y = ${n(hnAdopted, 1)} < ${n(hi, 1)} = bf/2 → the assumption that the neutral axis lies in the web is ${naOk ? 'valid' : 'NOT valid'}`
  }

  /* key points of the interaction diagram */
  const A: Point = { m: 0, p: mem.Pd }
  const B: Point = { m: Md, p: PdC }
  const C: Point = { m: Mmax, p: PdC / 2 }
  const D: Point = { m: Md, p: 0 }
  const curve = interactionCurve(A, B, C, D)
  const bilinear = bilinearCurve(A, B)

  const group: StepGroup = {
    id: `interaction-${axis}`,
    title: `Interaction point C — buckling about the ${symbolAxis}-axis`,
    subtitle: isZ
      ? 'Neutral-axis depth, plastic moduli within 2hn and the axial/moment resistances of the simplified interaction curve (major axis).'
      : 'Neutral-axis depth, plastic moduli within 2hn and the axial/moment resistances of the simplified interaction curve (minor axis).',
    source: 'workbook sheet 4 "z-Buckling", rows 28–95',
    steps: [
      {
        id: `astc-${axis}`,
        symbol: 'Astc',
        label: 'reinforcement area within the compression zone',
        formula: 'Astc = 2 × Ast,b (two corner bars)',
        substitution: `= 2 × ${n(s.Astb, 2)}`,
        value: Astc,
        unit: 'mm²',
        decimals: 2,
        ref: `4.z-Buckling!E31`,
        check: false,
      },
      {
        id: `hn-${axis}`,
        symbol: `hn,${symbolAxis}`,
        label: 'neutral-axis depth from the equilibrium of the plastic stress blocks',
        formula: symbol,
        substitution: `= ${numTxt} / ${denTxt}`,
        value: hnRaw,
        unit: 'mm',
        decimals: 3,
        ref: `4.z-Buckling!E${isZ ? 33 : 77}`,
        check: false,
      },
      {
        id: `hnAdopted-${axis}`,
        symbol: `hn,${symbolAxis} (adopted)`,
        label: hnOverridden ? 'neutral-axis depth adopted (user override)' : `neutral-axis depth adopted (rounded up to ${step})`,
        formula: hnOverridden ? 'user override' : `⌈hn,${symbolAxis} / ${step}⌉ × ${step}`,
        substitution: hnOverridden ? `= ${n(hnAdopted, 3)}` : `= ⌈${n(hnRaw, 3)} / ${step}⌉ × ${step}`,
        value: hnAdopted,
        unit: 'mm',
        decimals: isZ ? 1 : 1,
        ref: `4.z-Buckling!E${isZ ? 34 : 78}`,
        status: naOk ? 'ok' : 'fail',
        note: naNote,
      },
      {
        id: `zprn-${axis}`,
        symbol: 'Zprn',
        label: 'plastic modulus of reinforcement within 2hn',
        formula: 'Σ Ast,i eᵢ (no bar layer inside the 2hn region)',
        substitution: '= 0',
        value: zprn,
        unit: 'mm³',
        decimals: 0,
        ref: `4.z-Buckling!E${isZ ? 37 : 82}`,
        check: false,
      },
      {
        id: `zpsn-${axis}`,
        symbol: 'Zpsn',
        label: 'plastic modulus of the steel within 2hn',
        formula: isZ ? 'tw hn,z²' : '2 tf hn,y² + (h − 2 tf) tw²/4',
        substitution: isZ
          ? `= ${n(i.tw, 2)} × ${n(hnAdopted, 1)}²`
          : `= 2 × ${n(i.tf, 2)} × ${n(hnAdopted, 1)}² + (${n(i.h, 0)} − 2 × ${n(i.tf, 2)}) × ${n(i.tw, 2)}² / 4`,
        value: zpsn,
        unit: 'mm³',
        decimals: 0,
        ref: `4.z-Buckling!E${isZ ? 39 : 84}`,
        check: false,
      },
      {
        id: `zpcn-${axis}`,
        symbol: 'Zpcn',
        label: 'plastic modulus of the concrete within 2hn',
        formula: `${isZ ? 'bc' : 'hc'} hn² − Zpsn`,
        substitution: `= ${n(isZ ? i.bc : i.hc, 0)} × ${n(hnAdopted, 1)}² − ${n(zpsn, 0)}`,
        value: zpcn,
        unit: 'mm³',
        decimals: 0,
        ref: `4.z-Buckling!E${isZ ? 41 : 86}`,
        check: false,
      },
      {
        id: `PdC-${axis}`,
        symbol: "P'd,C",
        label: 'axial resistance at interaction point C',
        formula: isZ
          ? "1.6 hn,z bc αc fck/γc + 4 hn,z tw (fy/γm0 − 0.8 fck/γc)"
          : "1.6 hn,y hc fck/γc + [4 hn,y tf + tw (h − 2 tf)] (fy/γm0 − 0.8 fck/γc)",
        substitution: isZ
          ? `= [1.6 × ${n(hnAdopted, 1)} × ${n(i.bc, 0)} × ${n(i.alphaC, 2)} × ${n(i.fck, 0)} / ${n(i.gammaC, 2)} + 4 × ${n(hnAdopted, 1)} × ${n(i.tw, 2)} × (${n(i.fy, 0)} / ${n(i.gammaM0, 2)} − 0.8 × ${n(i.fck, 0)} / ${n(i.gammaC, 2)})] / 1000`
          : `= [1.6 × ${n(hnAdopted, 1)} × ${n(i.hc, 0)} × ${n(i.fck, 0)} / ${n(i.gammaC, 2)} + (4 × ${n(hnAdopted, 1)} × ${n(i.tf, 2)} + ${n(i.tw, 2)} × (${n(i.h, 0)} − 2 × ${n(i.tf, 2)})) × (${n(i.fy, 0)} / ${n(i.gammaM0, 2)} − 0.8 × ${n(i.fck, 0)} / ${n(i.gammaC, 2)})] / 1000`,
        value: PdC,
        unit: 'kN',
        decimals: 2,
        ref: `4.z-Buckling!E${isZ ? 43 : 88}`,
        check: false,
      },
      {
        id: `Md-${axis}`,
        symbol: 'Md',
        label: 'design moment resistance (interaction points B/C)',
        formula: `(Zps,${symbolAxis} − Zpsn) fy/γm0 + (Zpr − Zprn) fyk/γk + 0.4 αc (Zpc,${symbolAxis} − Zpcn) fck/γc`,
        substitution: `= [(${n(zps, 1)} − ${n(zpsn, 0)}) × ${n(i.fy, 0)} / ${n(i.gammaM0, 2)} + (${n(s.ZprZ, 1)} − ${n(zprn, 0)}) × ${n(i.fyk, 0)} / ${n(i.gammaK, 2)} + 0.4 × ${n(i.alphaC, 2)} × (${n(zpc, 1)} − ${n(zpcn, 0)}) × ${n(i.fck, 0)} / ${n(i.gammaC, 2)}] / 10⁶`,
        value: Md,
        unit: 'kN-m',
        decimals: 3,
        ref: `4.z-Buckling!E${isZ ? 46 : 90}`,
        check: false,
      },
      {
        id: `Mmax-${axis}`,
        symbol: 'Mmax',
        label: 'maximum moment resistance (interaction point D)',
        formula: `Zps,${symbolAxis} fy/γm0 + Zpr fyk/γk + 0.4 αc Zpc,${symbolAxis} fck/γc`,
        substitution: `= [${n(zps, 1)} × ${n(i.fy, 0)} / ${n(i.gammaM0, 2)} + ${n(s.ZprZ, 1)} × ${n(i.fyk, 0)} / ${n(i.gammaK, 2)} + 0.4 × ${n(i.alphaC, 2)} × ${n(zpc, 1)} × ${n(i.fck, 0)} / ${n(i.gammaC, 2)}] / 10⁶`,
        value: Mmax,
        unit: 'kN-m',
        decimals: 3,
        ref: `4.z-Buckling!E${isZ ? 48 : 92}`,
        check: false,
      },
    ],
    notes: [
      naNote,
      'Key points of the interaction diagram: A (0, Pd) — pure compression; B (Md, P′d,C) and C (Mmax, P′d,C/2) — end points of the simplified bilinear curve; D (Md, 0) — pure bending.',
      ...(isZ
        ? []
        : [
            'Note: the published equations for buckling about the y-axis omit the αc factor that appears in the z-axis equations. The asymmetry is reproduced here so that the results match the benchmark.',
          ]),
    ],
  }

  return {
    axis,
    hn,
    hnAdopted,
    hnOverridden,
    astc: Astc,
    zprn,
    zpsn,
    zpcn,
    PdC,
    Md,
    Mmax,
    Pcr: isZ ? mem.PcrZ : mem.PcrY,
    lambda: isZ ? mem.lambdaZ : mem.lambdaY,
    phi: isZ ? mem.phiZ : mem.phiY,
    chi: isZ ? mem.chiZ : mem.chiY,
    alphaImp: isZ ? i.alphaImpZ : i.alphaImpY,
    utilisation: isZ ? mem.utilZ : mem.utilY,
    curveName: isZ ? 'b' : 'c',
    Cmm: mem.Cmm,
    k: isZ ? mem.kZ : mem.kY,
    kAdopted: isZ ? mem.kZAdopted : mem.kYAdopted,
    M2nd: isZ ? mem.MzSec : mem.MySec,
    M1st: isZ ? i.Mz : i.My,
    Av: 0,
    Vd: 0,
    vRatio: 0,
    VEd: 0,
    Pc: 0,
    chiC: 0,
    chiD: 0,
    muDD: 0,
    dcMoment: 0,
    curve,
    bilinear,
    group,
  }
}
