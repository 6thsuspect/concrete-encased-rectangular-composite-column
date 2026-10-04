import type { BarRow, Inputs, UnitSettings } from '../types'
import { findConcrete, findRebar, findSteel } from './grades'

/** Default unit selection (the units of the reference example). */
export const DEFAULT_UNITS: UnitSettings = { length: 'mm', stress: 'N/mm²' }

/** Reinforcement of the reference example: 4 × ⌀12 corner bars at e = 159 mm. */
export const REFERENCE_BARS: BarRow[] = [
  { id: 'bar-1', label: 'B1', db: 12, count: 4, layer: '1', cover: 41, x: 159, y: 159, spread: 'corner' },
]

export const newBarRow = (id: string, index: number): BarRow => ({
  id,
  label: `B${index + 1}`,
  db: 12,
  count: 4,
  layer: `${index + 1}`,
  cover: 40,
  x: 150,
  y: 150,
  spread: 'corner',
})

/**
 * Inputs of the reference example (CSI Software Verification, ETABS,
 * "IS 11384:2022 CCD Example 001 — Concrete-encased rectangular composite column").
 */
export const DEFAULT_INPUTS: Inputs = {
  /* material grades */
  concreteGrade: 'M30',
  rebarGrade: 'Fe415',
  steelGrade: 'Fe345',

  /* materials */
  Es: 210000,
  fy: 345,
  fu: 490,
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

  /* units */
  units: { ...DEFAULT_UNITS },

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
  sectionType: 'rect',
  bc: 400,
  hc: 400,
  cover: 41,
  slabWidth: 1000,
  slabThickness: 150,
  h: 260,
  bf: 256,
  tf: 17.3,
  tw: 10.5,
  r: 0,

  /* reinforcement */
  bars: [{ ...REFERENCE_BARS[0] }],
  astcModel: 'reference',

  /* advanced */
  hnZOverride: null,
  hnYOverride: null,
}

/** Deep copy of an input set (the bar table is copied row by row). */
export function cloneInputs(i: Inputs): Inputs {
  return {
    ...i,
    units: { ...i.units },
    bars: i.bars.map((b) => ({ ...b })),
  }
}

/**
 * Rebuild a full input set from a possibly partial / stale object
 * (localStorage, a shared link or a loaded JSON file).
 */
export function normalizeInputs(raw: unknown): Inputs {
  const base = cloneInputs(DEFAULT_INPUTS)
  if (!raw || typeof raw !== 'object') return base
  const src = raw as Record<string, unknown>
  const out = base as unknown as Record<string, unknown>

  for (const key of Object.keys(base) as (keyof Inputs)[]) {
    if (key === 'bars' || key === 'units') continue
    const value = src[key]
    if (value === undefined || value === null) {
      // an explicitly null override must survive a round trip
      if ((key === 'hnZOverride' || key === 'hnYOverride') && value === null && key in src) out[key] = null
      continue
    }
    if (typeof value === typeof base[key] || (typeof base[key] === 'number' && typeof value === 'number')) {
      out[key] = value
    }
  }

  const units = src.units as Partial<UnitSettings> | undefined
  if (units && typeof units === 'object') {
    out.units = {
      length: units.length === 'm' ? 'm' : 'mm',
      stress: units.stress === 'MPa' ? 'MPa' : 'N/mm²',
    }
  }

  const bars = src.bars
  if (Array.isArray(bars) && bars.length > 0) {
    out.bars = bars.map((b, idx) => normalizeBar(b, idx))
  } else if (Array.isArray(bars)) {
    out.bars = []
  }
  return out as unknown as Inputs
}

function normalizeBar(raw: unknown, idx: number): BarRow {
  const b = (raw ?? {}) as Record<string, unknown>
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
  const spread = b.spread === 'point' ? 'point' : 'corner'
  const count = Math.max(b.spread === 'corner' ? 4 : 1, Math.round(num(b.count, spread === 'corner' ? 4 : 1)))
  return {
    id: typeof b.id === 'string' && b.id ? b.id : `bar-${idx + 1}`,
    label: typeof b.label === 'string' && b.label ? b.label : `B${idx + 1}`,
    db: num(b.db, 12),
    count,
    layer: typeof b.layer === 'string' && b.layer ? b.layer : `${idx + 1}`,
    cover: num(b.cover, 0),
    x: num(b.x, 150),
    y: num(b.y, 150),
    spread,
  }
}

/** Auto-fill the materials of a grade (any value stays editable afterwards). */
export function applyConcreteGrade(i: Inputs, id: string): Inputs {
  const grade = findConcrete(id)
  if (!grade) return { ...i, concreteGrade: 'custom' }
  return { ...i, concreteGrade: id, fck: grade.fck, gammaC: grade.gammaC, Ecm: grade.Ecm }
}

export function applyRebarGrade(i: Inputs, id: string): Inputs {
  const grade = findRebar(id)
  if (!grade) return { ...i, rebarGrade: 'custom' }
  return { ...i, rebarGrade: id, fyk: grade.fyk, Est: grade.Es, gammaK: grade.gammaS }
}

export function applySteelGrade(i: Inputs, id: string): Inputs {
  const grade = findSteel(id)
  if (!grade) return { ...i, steelGrade: 'custom' }
  return { ...i, steelGrade: id, fy: grade.fy, fu: grade.fu, Es: grade.E, gammaM0: grade.gammaS }
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
    patch: {
      concreteGrade: 'M30',
      rebarGrade: 'Fe415',
      steelGrade: 'Fe345',
      fck: 30,
      Ecm: 27386,
      gammaC: 1.5,
      fyk: 415,
      Est: 200000,
      gammaK: 1.15,
      fy: 345,
      fu: 490,
      Es: 210000,
      gammaM0: 1.1,
      sectionType: 'rect',
      bc: 400,
      hc: 400,
      cover: 41,
      h: 260,
      bf: 256,
      tf: 17.3,
      tw: 10.5,
      r: 0,
      bars: [{ ...REFERENCE_BARS[0] }],
      astcModel: 'reference',
    },
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
    description: 'Higher concrete grade (fck = 40 N/mm², Ecm = 5000 √fck = 31,623 N/mm²) with the same geometry.',
    patch: { concreteGrade: 'M40', fck: 40, Ecm: 31623, gammaC: 1.5 },
  },
  {
    id: 'cage8',
    name: 'Eight-bar cage, ⌀16',
    description: 'Two ⌀16 corner rows with an intermediate layer — 8 bars, Ast = 1,608 mm², compression-zone bars taken from the position table.',
    patch: {
      bars: [
        { id: 'bar-1', label: 'B1', db: 16, count: 4, layer: '1', cover: 41, x: 159, y: 159, spread: 'corner' },
        { id: 'bar-2', label: 'B2', db: 16, count: 4, layer: '2', cover: 41, x: 0, y: 159, spread: 'point' },
      ],
      astcModel: 'positions',
    },
  },
  {
    id: 'slab',
    name: 'Encasement with slab',
    description: 'The same column cast with a 1000 × 150 mm slab (an extension of the reference method).',
    patch: { sectionType: 'rect-slab', slabWidth: 1000, slabThickness: 150 },
  },
]

export interface InputProblem {
  level: 'error' | 'warn'
  message: string
}

/** Sanity checks on the input set (geometry only — engineering checks live in the steps). */
export function inputProblems(i: Inputs): InputProblem[] {
  const p: InputProblem[] = []
  const pos = (name: string, v: number) => {
    if (!Number.isFinite(v) || !(v > 0)) p.push({ level: 'error', message: `${name} must be greater than zero.` })
  }
  const finite = (name: string, v: number) => {
    if (!Number.isFinite(v)) p.push({ level: 'error', message: `${name} must be a number.` })
  }

  /* grades and materials */
  pos('bc', i.bc)
  pos('hc', i.hc)
  pos('h', i.h)
  pos('bf', i.bf)
  pos('tf', i.tf)
  pos('tw', i.tw)
  pos('Ly', i.Ly)
  pos('Lz', i.Lz)
  pos('fy', i.fy)
  finite('fu', i.fu)
  pos('fck', i.fck)
  pos('Es', i.Es)
  pos('Ecm', i.Ecm)
  pos('Est', i.Est)
  pos('fyk', i.fyk)

  if (i.fu > 0 && i.fu < i.fy)
    p.push({ level: 'error', message: `The ultimate strength fu (${i.fu} N/mm²) must not be smaller than the yield strength fy (${i.fy} N/mm²).` })
  if (i.r < 0) p.push({ level: 'error', message: 'The root radius r cannot be negative.' })
  if (i.r > 0 && 2 * i.r > Math.min(i.bf, i.h))
    p.push({ level: 'warn', message: 'The root radius r looks too large for the section — check h and bf.' })

  /* cover */
  if (i.cover < 0) p.push({ level: 'error', message: 'The cover cannot be negative.' })
  if (i.cover >= Math.min(i.bc, i.hc) / 2)
    p.push({ level: 'error', message: 'The cover must be smaller than half of the smallest concrete dimension.' })

  /* cross-section consistency */
  if (i.h > i.hc) p.push({ level: 'error', message: 'The steel section depth h cannot exceed the concrete depth hc.' })
  if (i.bf > i.bc)
    p.push({ level: 'error', message: 'The flange width bf cannot exceed the concrete width bc.' })
  if (2 * i.tf >= i.h)
    p.push({ level: 'error', message: 'The web depth (h − 2 tf) must remain positive.' })
  if (i.tw >= i.bf) p.push({ level: 'error', message: 'The web thickness tw must be smaller than bf.' })
  if (i.cover > 0 && 2 * (i.hc / 2 - i.cover) < 0)
    p.push({ level: 'warn', message: 'The cover leaves no room for reinforcement.' })

  /* section type */
  if (i.sectionType === 'rect-slab') {
    pos('slabWidth', i.slabWidth)
    pos('slabThickness', i.slabThickness)
    if (i.slabWidth < i.bc)
      p.push({ level: 'warn', message: 'The slab width is smaller than the encasement width — the outline is no longer a clean T.' })
    if (!(i.slabThickness > 0) || i.slabThickness > 5 * i.hc)
      p.push({ level: 'warn', message: 'The slab thickness looks unrealistic for the encasement depth.' })
  }

  /* reinforcement table */
  if (i.bars.length === 0) p.push({ level: 'error', message: 'At least one reinforcement row is required.' })
  const ids = new Set<string>()
  i.bars.forEach((bar, idx) => {
    const name = bar.label || `row ${idx + 1}`
    if (ids.has(bar.id)) p.push({ level: 'error', message: `Duplicate reinforcement row id "${bar.id}".` })
    ids.add(bar.id)
    if (!(bar.db > 0)) p.push({ level: 'error', message: `${name}: the bar diameter must be greater than zero.` })
    if (!(bar.count >= 1)) p.push({ level: 'error', message: `${name}: the number of bars must be at least 1.` })
    if (bar.spread === 'corner' && bar.count % 4 !== 0)
      p.push({ level: 'warn', message: `${name}: a corner arrangement uses multiples of four bars (${bar.count} given).` })
    if (bar.cover < 0) p.push({ level: 'error', message: `${name}: the cover cannot be negative.` })
    const half = i.sectionType === 'rect-slab' ? i.slabWidth / 2 : i.bc / 2
    const halfY = i.hc / 2 + (i.sectionType === 'rect-slab' ? i.slabThickness : 0)
    if (Math.abs(bar.x) + bar.db / 2 > half + 1e-6 || Math.abs(bar.y) + bar.db / 2 > halfY + 1e-6)
      p.push({ level: 'warn', message: `${name}: the bar at (${bar.x}, ${bar.y}) mm falls outside the concrete outline.` })
  })
  if (i.bars.length > 0 && i.bars.every((b) => b.spread === 'corner' && b.x === 0 && b.y === 0))
    p.push({ level: 'warn', message: 'All bars sit at the section centroid — the section has no flexural reinforcement.' })

  /* member and partial factors */
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
