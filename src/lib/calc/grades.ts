/**
 * Material grade libraries (IS 456, IS 1786, IS 800 / IS 2062).
 *
 * Selecting a grade fills the characteristic values; every value can still be
 * edited afterwards, in which case the entry is reported as "customised".
 */

export const CUSTOM_GRADE = 'custom'

export interface ConcreteGrade {
  id: string
  name: string
  /** characteristic cylinder strength, N/mm² */
  fck: number
  /** partial factor for concrete */
  gammaC: number
  /** secant modulus of elasticity, N/mm² */
  Ecm: number
  note?: string
}

export interface RebarGrade {
  id: string
  name: string
  /** characteristic yield strength, N/mm² */
  fyk: number
  /** modulus of elasticity, N/mm² */
  Es: number
  /** partial factor for reinforcement */
  gammaS: number
  note?: string
}

export interface SteelGrade {
  id: string
  name: string
  /** yield strength, N/mm² */
  fy: number
  /** ultimate (tensile) strength, N/mm² */
  fu: number
  /** modulus of elasticity, N/mm² */
  E: number
  /** partial factor for structural steel */
  gammaS: number
  note?: string
}

/** Ecm = 5000 √fck (IS 456:2000, Table 1 → clause 6.2.3.1) */
export const ecmOf = (fck: number): number => Math.round(5000 * Math.sqrt(Math.max(fck, 0)))

const concrete = (id: string, fck: number, note?: string): ConcreteGrade => ({
  id,
  name: id,
  fck,
  gammaC: 1.5,
  Ecm: ecmOf(fck),
  note,
})

export const CONCRETE_GRADES: ConcreteGrade[] = [
  concrete('M20', 20),
  concrete('M25', 25),
  concrete('M30', 30, 'reference example'),
  concrete('M35', 35),
  concrete('M40', 40),
  concrete('M45', 45),
  concrete('M50', 50),
  concrete('M55', 55),
  concrete('M60', 60),
]

export const REBAR_GRADES: RebarGrade[] = [
  { id: 'Fe415', name: 'Fe415 (HYSD415)', fyk: 415, Es: 200000, gammaS: 1.15, note: 'reference example' },
  { id: 'Fe500', name: 'Fe500 (HYSD500)', fyk: 500, Es: 200000, gammaS: 1.15 },
  { id: 'Fe550', name: 'Fe550', fyk: 550, Es: 200000, gammaS: 1.15 },
  { id: 'Fe600', name: 'Fe600', fyk: 600, Es: 200000, gammaS: 1.15 },
]

export const STEEL_GRADES: SteelGrade[] = [
  {
    id: 'Fe345',
    name: 'Fe345 (reference example)',
    fy: 345,
    fu: 490,
    E: 210000,
    gammaS: 1.1,
    note: 'as used by the CSI verification example (E = 210,000 N/mm²)',
  },
  { id: 'E250', name: 'E250 (IS 2062)', fy: 250, fu: 410, E: 200000, gammaS: 1.1 },
  { id: 'E350', name: 'E350 (IS 2062)', fy: 350, fu: 490, E: 200000, gammaS: 1.1 },
  { id: 'E410', name: 'E410 (IS 2062)', fy: 410, fu: 540, E: 200000, gammaS: 1.1 },
  { id: 'E450', name: 'E450 (IS 2062)', fy: 450, fu: 570, E: 200000, gammaS: 1.1 },
  { id: 'E550', name: 'E550 (IS 2062)', fy: 550, fu: 660, E: 200000, gammaS: 1.1 },
]

export const findConcrete = (id: string) => CONCRETE_GRADES.find((g) => g.id === id)
export const findRebar = (id: string) => REBAR_GRADES.find((g) => g.id === id)
export const findSteel = (id: string) => STEEL_GRADES.find((g) => g.id === id)

/** Manufacturer-style bar diameters (IS 1786 preferred sizes). */
export const BAR_DIAMETERS = [8, 10, 12, 16, 20, 25, 28, 32, 36, 40]
