import type { Inputs, StepGroup } from '../types'
import { fmt } from '../format'

/** Geometric properties of the composite cross-section (sheet 3 of the workbook). */
export interface SectionProps {
  /* required strengths at mid-height */
  P: number
  MzMid: number
  MyMid: number
  Vy: number
  Vz: number
  /* embedded steel I-section */
  As: number
  IsZ: number
  IsY: number
  ZpsZ: number
  ZpsY: number
  /* reinforcement */
  Astb: number
  Ast: number
  IstI: number
  IstZ: number
  ZprZ: number
  /* concrete */
  Ac: number
  IcZ: number
  IcY: number
  ZpcZ: number
  ZpcY: number
}

const n = fmt

export function sectionProperties(i: Inputs): { props: SectionProps; group: StepGroup } {
  const {
    bc,
    hc,
    h,
    bf,
    tf,
    tw,
    db,
    n: nBars,
    e,
    PD,
    PL,
    Mz,
    My,
    Ly,
    Lz,
  } = i

  const P = PD + PL
  const MzMid = Mz / 2
  const MyMid = My / 2
  const LyM = Ly / 1000
  const LzM = Lz / 1000
  const Vy = Mz / LyM
  const Vz = My / LzM

  /* ---- embedded steel I-section ---- */
  const As = 2 * bf * tf + (h - 2 * tf) * tw
  const IsZ = (bf * h ** 3 - (bf - tw) * (h - 2 * tf) ** 3) / 12
  const IsY = (2 * tf * bf ** 3 + (h - 2 * tf) * tw ** 3) / 12
  const ZpsZ = (bf * h ** 2) / 4 - ((bf - tw) * (h - 2 * tf) ** 2) / 4
  const ZpsY = (tf * bf ** 2) / 2 + ((h - 2 * tf) * tw ** 2) / 4

  /* ---- reinforcement ---- */
  const Astb = (Math.PI * db ** 2) / 4
  const Ast = (nBars * Math.PI * db ** 2) / 4
  const IstI = (Math.PI * db ** 4) / 64
  const IstZ = nBars * IstI + nBars * Astb * e ** 2
  const ZprZ = nBars * Astb * e

  /* ---- concrete ---- */
  const Ac = bc * hc - As - Ast
  const IcZ = (bc * hc ** 3) / 12 - IsZ - IstZ
  const IcY = (hc * bc ** 3) / 12 - IsY - IstZ
  const ZpcZ = (bc * hc ** 2) / 4 - ZpsZ - ZprZ
  const ZpcY = (hc * bc ** 2) / 4 - ZpsY - ZprZ

  const group: StepGroup = {
    id: 'section',
    title: 'Section properties',
    subtitle: 'Required strengths at mid-height and the transformed section properties of the composite section.',
    source: 'workbook sheet 3 "Sect Props"',
    steps: [
      {
        id: 'P',
        symbol: 'P',
        label: 'design axial force at mid-height',
        formula: 'P = PD + PL',
        substitution: `= ${n(PD, 0)} + ${n(PL, 0)}`,
        value: P,
        unit: 'kN',
        decimals: 1,
        ref: '3.Sect Props!D4',
        check: false,
      },
      {
        id: 'Mz-mid',
        symbol: 'Mz',
        label: 'design moment, major axis (mid-height)',
        formula: 'Mz = Mz,bm / 2',
        substitution: `= ${n(Mz, 0)} / 2`,
        value: MzMid,
        unit: 'kN-m',
        decimals: 1,
        ref: '3.Sect Props!D5',
        check: false,
      },
      {
        id: 'My-mid',
        symbol: 'My',
        label: 'design moment, minor axis (mid-height)',
        formula: 'My = My,bm / 2',
        substitution: `= ${n(My, 0)} / 2`,
        value: MyMid,
        unit: 'kN-m',
        decimals: 1,
        ref: '3.Sect Props!D6',
        check: false,
      },
      {
        id: 'Vy',
        symbol: 'Vy',
        label: 'design shear force along y',
        formula: 'Vy = Mz / Lz',
        substitution: `= ${n(Mz, 0)} / ${n(LzM, 2)}`,
        value: Vy,
        unit: 'kN',
        decimals: 2,
        ref: '3.Sect Props!D8',
        check: false,
      },
      {
        id: 'Vz',
        symbol: 'Vz',
        label: 'design shear force along z',
        formula: 'Vz = My / Ly',
        substitution: `= ${n(My, 0)} / ${n(LyM, 2)}`,
        value: Vz,
        unit: 'kN',
        decimals: 2,
        ref: '3.Sect Props!D10',
        check: false,
      },
      {
        id: 'As',
        symbol: 'As',
        label: 'steel I-section area',
        formula: 'As = 2 bf tf + (h − 2 tf) tw',
        substitution: `= 2 × ${n(bf, 0)} × ${n(tf, 1)} + (${n(h, 0)} − 2 × ${n(tf, 1)}) × ${n(tw, 1)}`,
        value: As,
        unit: 'mm²',
        decimals: 1,
        ref: '3.Sect Props!D16',
      },
      {
        id: 'IsZ',
        symbol: 'Is,z',
        label: 'second moment of area of the steel, major axis',
        formula: 'Is,z = [bf h³ − (bf − tw)(h − 2 tf)³] / 12',
        substitution: `= [${n(bf, 0)} × ${n(h, 0)}³ − (${n(bf, 0)} − ${n(tw, 1)}) × (${n(h, 0)} − 2 × ${n(tf, 1)})³] / 12`,
        value: IsZ,
        unit: 'mm⁴',
        decimals: 0,
        ref: '3.Sect Props!D18',
      },
      {
        id: 'IsY',
        symbol: 'Is,y',
        label: 'second moment of area of the steel, minor axis',
        formula: 'Is,y = [2 tf bf³ + (h − 2 tf) tw³] / 12',
        substitution: `= [2 × ${n(tf, 1)} × ${n(bf, 0)}³ + (${n(h, 0)} − 2 × ${n(tf, 1)}) × ${n(tw, 1)}³] / 12`,
        value: IsY,
        unit: 'mm⁴',
        decimals: 0,
        ref: '3.Sect Props!D20',
      },
      {
        id: 'ZpsZ',
        symbol: 'Zps,z',
        label: 'plastic section modulus of the steel, major axis',
        formula: 'Zps,z = bf h²/4 − (bf − tw)(h − 2 tf)²/4',
        substitution: `= ${n(bf, 0)} × ${n(h, 0)}² / 4 − (${n(bf, 0)} − ${n(tw, 1)}) × (${n(h, 0)} − 2 × ${n(tf, 1)})² / 4`,
        value: ZpsZ,
        unit: 'mm³',
        decimals: 0,
        ref: '3.Sect Props!D22',
      },
      {
        id: 'ZpsY',
        symbol: 'Zps,y',
        label: 'plastic section modulus of the steel, minor axis',
        formula: 'Zps,y = tf bf²/2 + (h − 2 tf) tw²/4',
        substitution: `= ${n(tf, 1)} × ${n(bf, 0)}² / 2 + (${n(h, 0)} − 2 × ${n(tf, 1)}) × ${n(tw, 1)}² / 4`,
        value: ZpsY,
        unit: 'mm³',
        decimals: 0,
        ref: '3.Sect Props!D24',
      },
      {
        id: 'Astb',
        symbol: 'Ast,b',
        label: 'area of one reinforcing bar',
        formula: 'Ast,b = π db² / 4',
        substitution: `= π × ${n(db, 0)}² / 4`,
        value: Astb,
        unit: 'mm²',
        decimals: 2,
        ref: '3.Sect Props!D28',
      },
      {
        id: 'Ast',
        symbol: 'Ast',
        label: 'total reinforcement area',
        formula: 'Ast = n π db² / 4',
        substitution: `= ${n(nBars, 0)} × π × ${n(db, 0)}² / 4`,
        value: Ast,
        unit: 'mm²',
        decimals: 2,
        ref: '3.Sect Props!D30',
      },
      {
        id: 'IstI',
        symbol: 'Ist,i',
        label: 'second moment of area of one bar (own axis)',
        formula: 'Ist,i = π db⁴ / 64',
        substitution: `= π × ${n(db, 0)}⁴ / 64`,
        value: IstI,
        unit: 'mm⁴',
        decimals: 2,
        ref: '3.Sect Props!D32',
      },
      {
        id: 'IstZ',
        symbol: 'Ist,z = Ist,y',
        label: 'second moment of area of the reinforcement (parallel axis)',
        formula: 'Ist = Σ Ist,i + Σ Ast,i eᵢ²',
        substitution: `= ${n(nBars, 0)} × ${n(IstI, 1)} + ${n(nBars, 0)} × ${n(Astb, 1)} × ${n(e, 0)}²`,
        value: IstZ,
        unit: 'mm⁴',
        decimals: 0,
        ref: '3.Sect Props!D35',
        note: 'bars at ±e from the centroid in both axes',
      },
      {
        id: 'ZprZ',
        symbol: 'Zpr,z = Zpr,y',
        label: 'plastic section modulus of the reinforcement',
        formula: 'Zpr = Σ Ast,i eᵢ',
        substitution: `= ${n(nBars, 0)} × ${n(Astb, 1)} × ${n(e, 0)}`,
        value: ZprZ,
        unit: 'mm³',
        decimals: 1,
        ref: '3.Sect Props!D37',
      },
      {
        id: 'Ac',
        symbol: 'Ac',
        label: 'concrete area of the encasement',
        formula: 'Ac = bc hc − As − Ast',
        substitution: `= ${n(bc, 0)} × ${n(hc, 0)} − ${n(As, 1)} − ${n(Ast, 1)}`,
        value: Ac,
        unit: 'mm²',
        decimals: 1,
        ref: '3.Sect Props!D41',
      },
      {
        id: 'IcZ',
        symbol: 'Ic,z',
        label: 'second moment of area of the concrete, major axis',
        formula: 'Ic,z = bc hc³/12 − Is,z − Ist,z',
        substitution: `= ${n(bc, 0)} × ${n(hc, 0)}³ / 12 − ${n(IsZ, 0)} − ${n(IstZ, 0)}`,
        value: IcZ,
        unit: 'mm⁴',
        decimals: 0,
        ref: '3.Sect Props!D43',
      },
      {
        id: 'IcY',
        symbol: 'Ic,y',
        label: 'second moment of area of the concrete, minor axis',
        formula: 'Ic,y = hc bc³/12 − Is,y − Ist,y',
        substitution: `= ${n(hc, 0)} × ${n(bc, 0)}³ / 12 − ${n(IsY, 0)} − ${n(IstZ, 0)}`,
        value: IcY,
        unit: 'mm⁴',
        decimals: 0,
        ref: '3.Sect Props!D45',
      },
      {
        id: 'ZpcZ',
        symbol: 'Zpc,z',
        label: 'plastic section modulus of the concrete, major axis',
        formula: 'Zpc,z = bc hc²/4 − Zps,z − Zpr,z',
        substitution: `= ${n(bc, 0)} × ${n(hc, 0)}² / 4 − ${n(ZpsZ, 0)} − ${n(ZprZ, 0)}`,
        value: ZpcZ,
        unit: 'mm³',
        decimals: 0,
        ref: '3.Sect Props!D47',
      },
      {
        id: 'ZpcY',
        symbol: 'Zpc,y',
        label: 'plastic section modulus of the concrete, minor axis',
        formula: 'Zpc,y = hc bc²/4 − Zps,y − Zpr,y',
        substitution: `= ${n(hc, 0)} × ${n(bc, 0)}² / 4 − ${n(ZpsY, 0)} − ${n(ZprZ, 0)}`,
        value: ZpcY,
        unit: 'mm³',
        decimals: 0,
        ref: '3.Sect Props!D49',
      },
    ],
    notes: [
      'The concrete properties are obtained by subtracting the steel and reinforcement contributions from the gross concrete outline (no transformed-section modular ratio is applied, following the workbook).',
    ],
  }

  return {
    props: {
      P,
      MzMid,
      MyMid,
      Vy,
      Vz,
      As,
      IsZ,
      IsY,
      ZpsZ,
      ZpsY,
      Astb,
      Ast,
      IstI,
      IstZ,
      ZprZ,
      Ac,
      IcZ,
      IcY,
      ZpcZ,
      ZpcY,
    },
    group,
  }
}
