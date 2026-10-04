import type { Inputs } from '../types'

/**
 * Inputs of the reference example (CSI Software Verification, ETABS,
 * "IS 11384:2022 CCD Example 001 — Concrete-encased rectangular composite column").
 */
export const DEFAULT_INPUTS: Inputs = {
  /* materials */
  Es: 210000,
  fy: 345,
  gammaM0: 1.1,
  Ecm: 27386,
  fck: 30,
  gammaC: 1.5,
  alphaC: 0.85,
  alphaCC: 1.0,
  eta: 1.0,
  Est: 200000,
  fyk: 415,
  gammaK: 1.15,

  /* member */
  Ky: 1.0,
  Kz: 1.0,
  Ly: 7000,
  Lz: 7000,
  alphaImpZ: 0.34,
  alphaImpY: 0.49,
  psi: 0.0,

  /* loading */
  PD: 1200,
  PL: 600,
  Mz: 380,
  My: 50,

  /* cross-section */
  bc: 400,
  hc: 400,
  h: 260,
  bf: 256,
  tf: 17.3,
  tw: 10.5,
  db: 12,
  n: 4,
  e: 159,

  /* advanced */
  hnZOverride: null,
  hnYOverride: null,
}

export interface Preset {
  id: string
  name: string
  description: string
  patch: Partial<Inputs>
}

export const PRESETS: Preset[] = [
  {
    id: 'reference',
    name: 'CCD Example 001 (reference)',
    description: 'The benchmark case: 400 × 400 mm encasement with a 260 × 256 mm I-section, L = 7.0 m.',
    patch: {},
  },
  {
    id: 'slender',
    name: 'Slender member, L = 14 m',
    description: 'Same section over twice the length — the reduction factors and the second-order moments grow.',
    patch: { Ly: 14000, Lz: 14000 },
  },
  {
    id: 'heavy',
    name: 'Heavier loading',
    description: 'PD = 2,000 kN, PL = 900 kN with Mz = 450 kN-m — the demand/capacity ratio becomes governing.',
    patch: { PD: 2000, PL: 900, Mz: 450, My: 70 },
  },
  {
    id: 'm40',
    name: 'Concrete M40',
    description: 'Higher concrete grade (fck = 40 N/mm², Ecm = 35,220 N/mm²) with the same geometry.',
    patch: { fck: 40, Ecm: 35220 },
  },
]

export function cloneInputs(i: Inputs): Inputs {
  return { ...i }
}

export interface InputProblem {
  level: 'error' | 'warn'
  message: string
}

/** Sanity checks on the input set (geometry only — engineering checks live in the steps). */
export function inputProblems(i: Inputs): InputProblem[] {
  const p: InputProblem[] = []
  const pos = (name: string, v: number) => {
    if (!(v > 0)) p.push({ level: 'error', message: `${name} must be greater than zero.` })
  }

  pos('bc', i.bc)
  pos('hc', i.hc)
  pos('h', i.h)
  pos('bf', i.bf)
  pos('tf', i.tf)
  pos('tw', i.tw)
  pos('db', i.db)
  pos('n', i.n)
  pos('Ly', i.Ly)
  pos('Lz', i.Lz)
  pos('fy', i.fy)
  pos('fck', i.fck)
  pos('Es', i.Es)
  pos('Ecm', i.Ecm)
  pos('Est', i.Est)
  pos('fyk', i.fyk)

  if (i.h > i.hc) p.push({ level: 'error', message: 'The steel section depth h cannot exceed the concrete depth hc.' })
  if (i.bf > i.bc)
    p.push({ level: 'error', message: 'The flange width bf cannot exceed the concrete width bc.' })
  if (2 * i.tf >= i.h)
    p.push({ level: 'error', message: 'The web depth (h − 2 tf) must remain positive.' })
  if (i.tw >= i.bf) p.push({ level: 'error', message: 'The web thickness tw must be smaller than bf.' })
  if (i.e > 0 && Math.abs(i.e) * 2 >= Math.min(i.bc, i.hc))
    p.push({ level: 'warn', message: 'The bar eccentricity e places the reinforcement outside the concrete outline.' })
  if (i.Ky <= 0 || i.Kz <= 0) p.push({ level: 'error', message: 'The effective length factors Ky and Kz must be positive.' })
  if (i.gammaM0 <= 0 || i.gammaC <= 0 || i.gammaK <= 0)
    p.push({ level: 'error', message: 'Partial safety factors must be greater than zero.' })
  if (i.alphaC <= 0 || i.alphaC > 1.5) p.push({ level: 'warn', message: 'αc is unusually far from the typical 0.85.' })
  if (i.alphaCC <= 0 || i.alphaCC > 1.5)
    p.push({ level: 'warn', message: 'αcc is unusually far from the typical 1.0.' })
  if (i.eta <= 0) p.push({ level: 'error', message: 'η must be positive.' })
  if (i.psi > 1 || i.psi < -1) p.push({ level: 'warn', message: 'ψ = M1/M2 is conventionally between −1 and 1.' })
  if (i.PD + i.PL <= 0) p.push({ level: 'warn', message: 'The design axial force P is not positive.' })

  return p
}
