/**
 * Types for the IS 11384:2022 verification of a concrete-encased
 * rectangular composite column (CSI CCD Example 001).
 *
 * Units used throughout the engine (and the UI):
 *   lengths              mm            (member lengths also entered in mm)
 *   areas / inertias     mm^2 / mm^4 / mm^3
 *   stresses / moduli    N/mm^2
 *   forces               kN
 *   moments              kN-m
 *   distributed stiffness kN-m^2  ((EI)e,z, (EI)e,y)
 */

export interface Inputs {
  /* ---------------- materials ---------------- */
  /** Steel I-section modulus of elasticity, N/mm^2 */
  Es: number
  /** Steel I-section yield strength, N/mm^2 */
  fy: number
  /** Partial factor for structural steel */
  gammaM0: number
  /** Concrete secant modulus, N/mm^2 */
  Ecm: number
  /** Concrete characteristic cylinder strength, N/mm^2 */
  fck: number
  /** Partial factor for concrete */
  gammaC: number
  /** Concrete stress-block coefficient (0.85 in the reference) */
  alphaC: number
  /** Coefficient alpha_cc of the concrete design strength */
  alphaCC: number
  /** Efficiency/utilisation factor eta */
  eta: number
  /** Reinforcement modulus of elasticity, N/mm^2 */
  Est: number
  /** Reinforcement characteristic yield strength, N/mm^2 */
  fyk: number
  /** Partial factor for reinforcement */
  gammaK: number

  /* ---------------- member ---------------- */
  /** Effective length factor about the y-axis */
  Ky: number
  /** Effective length factor about the z-axis */
  Kz: number
  /** Unbraced length about the y-axis, mm */
  Ly: number
  /** Unbraced length about the z-axis, mm */
  Lz: number
  /** Buckling-curve imperfection factor, z-axis (curve b → 0.34) */
  alphaImpZ: number
  /** Buckling-curve imperfection factor, y-axis (curve c → 0.49) */
  alphaImpY: number
  /** Ratio psi = M1/M2 of the first-order moment diagram */
  psi: number

  /* ---------------- loadings ---------------- */
  /** Dead axial load, kN */
  PD: number
  /** Live axial load, kN */
  PL: number
  /** Live bending moment about the z-axis (major axis), kN-m */
  Mz: number
  /** Live bending moment about the y-axis (minor axis), kN-m */
  My: number

  /* ---------------- cross-section ---------------- */
  /** Concrete width (z direction), mm */
  bc: number
  /** Concrete depth (y direction), mm */
  hc: number
  /** Overall depth of the embedded steel I-section (y direction), mm */
  h: number
  /** Flange width of the embedded steel I-section (z direction), mm */
  bf: number
  /** Flange thickness, mm */
  tf: number
  /** Web thickness, mm */
  tw: number
  /** Reinforcement bar diameter, mm */
  db: number
  /** Number of bars */
  n: number
  /** Bar eccentricity from the centroid, both axes, mm */
  e: number

  /* ---------------- advanced overrides ---------------- */
  /** Adopted neutral-axis depth about z (mm); null → use the closed form */
  hnZOverride: number | null
  /** Adopted neutral-axis depth about y (mm); null → use the closed form */
  hnYOverride: number | null
}

export type Axis = 'z' | 'y'

export interface Point {
  /** moment, kN-m */
  m: number
  /** axial load, kN */
  p: number
}

/* ------------------------------------------------------------------ */
/* Calculation steps (rendered in the UI and in the printed report)    */
/* ------------------------------------------------------------------ */

export type StepStatus = 'ok' | 'warn' | 'fail' | 'info'

export interface Step {
  id: string
  /** Engineering symbol, e.g. "(EI)e,z" */
  symbol: string
  /** Short description, e.g. "effective flexural stiffness" */
  label: string
  /** Symbolic expression, e.g. "Es Is,z + 0.6 Ecm Ic,z + Est Ist,z" */
  formula: string
  /** Expression with the numbers substituted in */
  substitution: string
  value: number
  unit: string
  decimals: number
  /** Source reference, e.g. "workbook 4.z-Buckling!E7" */
  ref?: string
  /** Governing criterion text, warnings, remarks */
  note?: string
  status?: StepStatus
  /** false → the value is informational (no engineering check attached) */
  check?: boolean
}

export interface StepGroup {
  id: string
  title: string
  subtitle?: string
  source?: string
  steps: Step[]
  notes?: string[]
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

export interface AxisResult {
  axis: Axis
  /** calculated neutral-axis depth, mm */
  hn: number
  /** adopted neutral-axis depth, mm (equals hn unless overridden) */
  hnAdopted: number
  hnOverridden: boolean
  /** reinforcement area assumed in the compression zone (2 bars) */
  astc: number
  /** plastic modulus of reinforcement within 2hn, mm^3 */
  zprn: number
  zpsn: number
  zpcn: number
  /** axial resistance at interaction point C, kN */
  PdC: number
  /** design moment resistance (point B/C), kN-m */
  Md: number
  /** maximum moment resistance (point D), kN-m */
  Mmax: number
  /** critical buckling load, kN */
  Pcr: number
  /** relative slenderness */
  lambda: number
  phi: number
  chi: number
  alphaImp: number
  /** P / (chi * Pd) */
  utilisation: number
  /** buckling curve label, e.g. "b" */
  curveName: string
  /** equivalent uniform moment factor */
  Cmm: number
  /** 1/(1 - P/Pcr) amplification */
  k: number
  kAdopted: number
  /** second-order design moment, kN-m */
  M2nd: number
  /** first-order moment at mid-height, kN-m */
  M1st: number
  /** shear area, mm^2 */
  Av: number
  /** shear resistance, kN */
  Vd: number
  /** shear demand / resistance */
  vRatio: number
  /** axial shear demand, kN */
  VEd: number
  /** concrete part of the axial resistance ratio, kN */
  Pc: number
  chiC: number
  chiD: number
  muDD: number
  /** M / (muDD * Md) */
  dcMoment: number
  /** interaction curve (smoothed, through A-C-D-B) */
  curve: Point[]
  /** simplified bilinear curve (A-C-B) */
  bilinear: Point[]
}

export interface Results {
  inputs: Inputs
  /* required strengths at mid-height */
  required: {
    P: number
    MzMid: number
    MyMid: number
    Vy: number
    Vz: number
  }
  /* section properties */
  steel: {
    As: number
    IsZ: number
    IsY: number
    ZpsZ: number
    ZpsY: number
  }
  rebar: {
    Astb: number
    Ast: number
    IstI: number
    IstZ: number
    ZprZ: number
  }
  concrete: {
    Ac: number
    IcZ: number
    IcY: number
    ZpcZ: number
    ZpcY: number
  }
  /* member / simplified method */
  member: {
    EIeZ: number
    EIeY: number
    PcrZ: number
    PcrY: number
    Pn: number
    Pd: number
    delta: number
    lambdaZ: number
    lambdaY: number
    applicability: { ok: boolean; reasons: string[] }
  }
  axes: Record<Axis, AxisResult>
  global: {
    phiZ: number
    phiY: number
    chiZ: number
    chiY: number
    psi: number
    Cmm: number
  }
  dc: {
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
  }
  /** interaction key points per axis */
  keyPoints: Record<Axis, { A: Point; B: Point; C: Point; D: Point }>
  groups: StepGroup[]
}


