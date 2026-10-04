/**
 * Types for the IS 11384:2022 verification of a concrete-encased
 * rectangular composite column (CSI CCD Example 001).
 *
 * Units used throughout the engine (and the UI):
 *   lengths              mm            (member lengths also entered in mm/m)
 *   areas / inertias     mm^2 / mm^4 / mm^3
 *   stresses / moduli    N/mm^2
 *   forces               kN
 *   moments              kN-m
 *   distributed stiffness kN-m^2  ((EI)e,z, (EI)e,y)
 */

/* ------------------------------------------------------------------ */
/* Cross-section description                                           */
/* ------------------------------------------------------------------ */

/** Encasement type: plain rectangular, optionally with an integral slab, or circular. */
export type SectionType = 'rect' | 'rect-slab' | 'circular'

/**
 * How the bars of one table row are arranged:
 *   `corner` → four bars at (±X, ±Y)
 *   `point`  → `count` bars at the single position (X, Y)
 *   `ring`   → `count` bars evenly distributed on a circle of radius X about the
 *              centroid, starting at the angle Y (degrees, +z towards +y)
 */
export type BarSpread = 'corner' | 'point' | 'ring'

/** One row of the reinforcement position table. */
export interface BarRow {
  /** stable identifier used by the UI and the exports */
  id: string
  /** user label, e.g. "B1" */
  label: string
  /** bar diameter, mm */
  db: number
  /** number of bars in this row (4 for a "corner" cage) */
  count: number
  /** layer / group tag, e.g. "1", "Top", "Face A" */
  layer: string
  /** effective cover: concrete face to bar centre, mm */
  cover: number
  /** bar centre (or corner offset) from the section centroid along z, mm */
  x: number
  /** bar centre (or corner offset) from the section centroid along y, mm */
  y: number
  /** arrangement of the row — see `BarSpread` */
  spread: BarSpread
}

/** Unit selection for the input/output presentation. */
export interface UnitSettings {
  /** unit used for the member lengths Ly / Lz */
  length: 'mm' | 'm'
  /** label used for all stresses and moduli (identical quantity) */
  stress: 'N/mm²' | 'MPa'
}

/** How the reinforcement area inside the 2hn band is determined. */
export type AstcModel = 'reference' | 'positions'

export interface Inputs {
  /* ---------------- material grades ---------------- */
  /** selected concrete grade id (or 'custom') */
  concreteGrade: string
  /** selected reinforcement grade id (or 'custom') */
  rebarGrade: string
  /** selected structural steel grade id (or 'custom') */
  steelGrade: string

  /* ---------------- materials (characteristic values) ---------------- */
  /** Concrete characteristic cylinder strength, N/mm² */
  fck: number
  /** Partial factor for concrete */
  gammaC: number
  /** Concrete secant modulus, N/mm² */
  Ecm: number
  /** Concrete stress-block coefficient (0.85 in the reference) */
  alphaC: number
  /** Coefficient alpha_cc of the concrete design strength */
  alphaCC: number
  /** Efficiency/utilisation factor eta */
  eta: number

  /** Reinforcement characteristic yield strength, N/mm² */
  fyk: number
  /** Reinforcement modulus of elasticity, N/mm² */
  Est: number
  /** Partial factor for reinforcement */
  gammaK: number

  /** Structural steel yield strength, N/mm² */
  fy: number
  /** Structural steel ultimate strength, N/mm² (not used by the simplified method) */
  fu: number
  /** Structural steel modulus of elasticity, N/mm² */
  Es: number
  /** Partial factor for structural steel */
  gammaM0: number

  /* ---------------- units ---------------- */
  units: UnitSettings

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

  /* ---------------- concrete section ---------------- */
  sectionType: SectionType
  /** Concrete width (z direction), mm */
  bc: number
  /** Concrete depth (y direction), mm */
  hc: number
  /** Clear/effective cover of the outermost reinforcement, mm */
  cover: number
  /** Slab width, mm (sectionType = 'rect-slab') */
  slabWidth: number
  /** Slab thickness, mm (sectionType = 'rect-slab') */
  slabThickness: number
  /** Outside diameter of the concrete encasement, mm (sectionType = 'circular') */
  diameter: number

  /* ---------------- embedded steel I-section ---------------- */
  /** Overall depth of the embedded steel I-section (y direction), mm */
  h: number
  /** Flange width of the embedded steel I-section (z direction), mm */
  bf: number
  /** Web thickness, mm */
  tw: number
  /** Flange thickness, mm */
  tf: number
  /** Root radius of the rolled section, mm (drawing / detailing only) */
  r: number

  /* ---------------- reinforcement ---------------- */
  /** bar position table */
  bars: BarRow[]
  /** how Astc (and Zprn) are derived */
  astcModel: AstcModel

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
  /** reinforcement area assumed in the compression zone / 2hn band */
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
  /** interaction curve (smoothed, through A-B-C-D) */
  curve: Point[]
  /** simplified bilinear curve (A-B-D) */
  bilinear: Point[]
}

/** One resolved bar of the reinforcement table (spread applied). */
export interface BarInstance {
  rowId: string
  label: string
  layer: string
  db: number
  /** area of a single bar, mm² */
  area: number
  /** position from the section centroid, mm */
  x: number
  y: number
  /** distance from the nearest concrete face, mm */
  cover?: number
}

export interface BarsSummary {
  instances: BarInstance[]
  /** total reinforcement area, mm² */
  Ast: number
  /** second moment of the reinforcement about the z and y axes, mm^4 */
  IstZ: number
  IstY: number
  /** plastic modulus of the reinforcement about the z and y axes, mm^3 */
  ZprZ: number
  ZprY: number
  /** diameter of the largest bar, mm */
  dbMax: number
  /** number of bars */
  count: number
}

export interface ConcreteGeometry {
  /** outline family the properties were derived for */
  kind: SectionType
  /** encasement diameter, mm (0 for a rectangular encasement) */
  diameter: number
  /** encasement width / depth, mm (both equal the diameter for a circle) */
  bc: number
  hc: number
  /** slab, mm (0 when the section has no slab) */
  slabWidth: number
  slabThickness: number
  /** concrete area including the slab, mm² */
  Ac: number
  /** second moments about the reference axes (encasement centroid), mm^4 */
  IcZ: number
  IcY: number
  /** plastic section moduli of the concrete outline about the reference axes, mm³ */
  ZpcZ: number
  ZpcY: number
  /** offset of the slab centroid above the reference axis, mm */
  slabOffsetY: number
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
    IstZ: number
    IstY: number
    ZprZ: number
    ZprY: number
    count: number
    dbMax: number
  }
  concrete: {
    /** encasement diameter, mm (0 for a rectangular encasement) */
    diameter: number
    Ac: number
    IcZ: number
    IcY: number
    ZpcZ: number
    ZpcY: number
    /** area added by the slab, mm² (0 for a plain rectangular encasement) */
    Aslab: number
  }
  bars: BarsSummary
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
