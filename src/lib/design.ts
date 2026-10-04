/**
 * Design of the peripheral reinforcement of a circular composite column.
 *
 * Given the current loads and section, the required longitudinal steel area is
 * found by bisection on the demand/capacity ratio (a monotone function of the
 * reinforcement area), and a set of practical bar arrangements — one per
 * standard bar diameter — is proposed. Every candidate is evaluated with the
 * full engine, so the reported D/C ratio is the real one of that arrangement.
 *
 * The section is checked, the reinforcement is designed: nothing here changes
 * the section itself.
 */
import type { BarRow, Inputs } from './types'
import { BAR_DIAMETERS } from './calc/grades'
import { barArea, circleArea } from './calc/geometry'
import { computeAll } from './calc'

export interface RingCandidate {
  db: number
  /** number of bars on the ring */
  n: number
  /** provided reinforcement area, mm² */
  ast: number
  /** Ast / Ag, % */
  ratio: number
  /** centre-to-centre pitch along the ring, mm */
  pitch: number
  /** resulting demand/capacity ratio */
  dc: number
  /** the arrangement meets the target and the detailing checks */
  ok: boolean
  /** true when the arrangement is the lightest one that is adequate */
  recommended: boolean
}

export interface RingDesign {
  /** target demand/capacity ratio */
  target: number
  /** radius of the ring, mm */
  rho: number
  /** gross concrete area, mm² */
  ag: number
  /** required steel area to reach the target, mm² */
  requiredAst: number
  /** whether the target is reached within the 6 % maximum */
  feasible: boolean
  /** true when the current arrangement already meets the target */
  satisfied: boolean
  /** minimum (0.8 %) and maximum (6 %) longitudinal steel of IS 456 cl. 26.5.3.1 */
  minAst: number
  maxAst: number
  /** current D/C ratio of the peripheral cage */
  currentDc: number
  candidates: RingCandidate[]
}

const COMFORT_MIN = 100
const COMFORT_MAX = 200
const MAX_FRACTION = 0.06
const MIN_FRACTION = 0.008
const MIN_BARS = 6

/** Evaluate the D/C ratio of a single-ring cage with the given bar area. */
function dcForRing(base: Inputs, template: BarRow, n: number, ast: number): number {
  const db = Math.sqrt((4 * ast) / (Math.PI * Math.max(n, 1)))
  const row: BarRow = { ...template, spread: 'ring', count: n, db }
  return computeAll({ ...base, bars: [row] }).dc.total
}

/**
 * Design of the peripheral cage of a circular section. Returns null when the
 * section is not circular or has no ring row to work from.
 */
export function designRing(inputs: Inputs, target = 1.0): RingDesign | null {
  if (inputs.sectionType !== 'circular') return null
  const template = inputs.bars.find((b) => b.spread === 'ring')
  if (!template) return null
  const rho = Math.abs(template.x) || Math.max(inputs.diameter / 2 - inputs.cover, 0)
  const ag = circleArea(inputs.diameter)
  const minAst = MIN_FRACTION * ag
  const maxAst = MAX_FRACTION * ag
  const nProbe = Math.max(MIN_BARS, Math.round(template.count) || MIN_BARS)
  const probeRow: BarRow = { ...template, spread: 'ring', x: rho, count: nProbe }

  const base: Inputs = { ...inputs, bars: [probeRow] }
  const currentDc = computeAll(inputs).dc.total

  /* required area: bisection on Ast, D/C decreases with more steel */
  const f = (ast: number) => dcForRing(base, probeRow, nProbe, ast) - target
  const lo = Math.max(minAst / 4, 1)
  let requiredAst = lo
  let feasible = true
  if (f(lo) > 0) {
    if (f(maxAst) > 0) {
      feasible = false
      requiredAst = maxAst
    } else {
      let a = lo
      let b = maxAst
      for (let k = 0; k < 40; k++) {
        const m = (a + b) / 2
        if (f(m) > 0) a = m
        else b = m
      }
      requiredAst = (a + b) / 2
    }
  }

  /* candidate arrangements, one per standard bar diameter */
  const needed = Math.max(requiredAst, minAst)
  const candidates: RingCandidate[] = BAR_DIAMETERS.map((db) => {
    const ab = barArea(db)
    let n = Math.max(MIN_BARS, Math.ceil(needed / ab))
    if (n % 2 !== 0) n += 1 // an even number keeps the cage symmetric
    const ast = n * ab
    const dc = dcForRing(base, probeRow, n, ast)
    const ratio = (ast / ag) * 100
    const pitch = (2 * Math.PI * rho) / n
    return {
      db,
      n,
      ast,
      ratio,
      pitch,
      dc,
      ok: dc <= target && ratio >= MIN_FRACTION * 100 && ratio <= MAX_FRACTION * 100 && pitch <= 300 && pitch >= 75,
      recommended: false,
    }
  })

  candidates.sort((a, b) => a.ast - b.ast || a.db - b.db)
  /* the lightest adequate arrangement; among those, a comfortable ring pitch
     (100 … 200 mm) is preferred over the bare minimum, since very tight pitches
     are hard to place and very wide ones are not efficient cages */
  const comfortable = candidates.find((c) => c.ok && c.pitch >= COMFORT_MIN && c.pitch <= COMFORT_MAX)
  const recommended = comfortable ?? candidates.find((c) => c.ok)
  if (recommended) recommended.recommended = true

  return {
    target,
    rho,
    ag,
    requiredAst: feasible ? requiredAst : NaN,
    feasible,
    satisfied: currentDc <= target,
    minAst,
    maxAst,
    currentDc,
    candidates,
  }
}
