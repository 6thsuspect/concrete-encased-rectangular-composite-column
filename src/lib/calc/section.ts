import type { Inputs, StepGroup } from '../types'
import { fmt } from '../format'
import { barsSummary, circleArea, concreteGeometry, steelCornerRadius } from './geometry'
import { findConcrete, findRebar, findSteel } from './grades'
import type { BarsSummary, ConcreteGeometry } from '../types'

/** Geometric and material properties of the composite cross-section. */
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
  Ast: number
  IstZ: number
  IstY: number
  ZprZ: number
  ZprY: number
  /* concrete */
  Ac: number
  IcZ: number
  IcY: number
  ZpcZ: number
  ZpcY: number
  /* extras */
  bars: BarsSummary
  concrete: ConcreteGeometry
}

const n = fmt

export function sectionProperties(i: Inputs): {
  props: SectionProps
  dataGroup: StepGroup
  group: StepGroup
} {
  const { bc, hc, h, bf, tf, tw, PD, PL, Mz, My, Ly, Lz } = i

  const P = PD + PL
  const MzMid = Mz / 2
  const MyMid = My / 2
  const LyM = Ly / 1000
  const LzM = Lz / 1000
  const Vy = Mz / LyM
  const Vz = My / LzM

  /* ---- embedded steel I-section (root radius excluded, as in the reference) ---- */
  const As = 2 * bf * tf + (h - 2 * tf) * tw
  const IsZ = (bf * h ** 3 - (bf - tw) * (h - 2 * tf) ** 3) / 12
  const IsY = (2 * tf * bf ** 3 + (h - 2 * tf) * tw ** 3) / 12
  const ZpsZ = (bf * h ** 2) / 4 - ((bf - tw) * (h - 2 * tf) ** 2) / 4
  const ZpsY = (tf * bf ** 2) / 2 + ((h - 2 * tf) * tw ** 2) / 4

  /* ---- reinforcement from the position table ---- */
  const bars = barsSummary(i.bars)
  const Ast = bars.Ast
  const IstZ = bars.IstZ
  const IstY = bars.IstY
  const ZprZ = bars.ZprZ
  const ZprY = bars.ZprY

  /* ---- concrete outline (encasement, optionally with a slab) ---- */
  const concrete = concreteGeometry(i, { As, IsZ, IsY, ZpsZ, ZpsY }, bars)
  const { Ac, IcZ, IcY, ZpcZ, ZpcY } = concrete
  const Aslab = concrete.slabWidth * concrete.slabThickness

  /* ------------------------------------------------------------------ */
  /* design data (inputs, documented for the report)                     */
  /* ------------------------------------------------------------------ */
  const concreteGrade = findConcrete(i.concreteGrade)
  const rebarGrade = findRebar(i.rebarGrade)
  const steelGrade = findSteel(i.steelGrade)
  const secUnit = i.units.stress

  const dataGroup: StepGroup = {
    id: 'data',
    title: 'Design data',
    subtitle: 'Material grades, cross-section definition and the reinforcement position table used by the calculation.',
    source: 'user input',
    steps: [
      {
        id: 'concrete-grade',
        symbol: 'Concrete',
        label: concreteGrade ? `${concreteGrade.name}${i.concreteGrade === 'custom' ? '' : ' grade'}` : 'custom grade',
        formula: 'fck, γc, Ecm',
        substitution: `${n(i.fck, 0)} N/mm² · ${n(i.gammaC, 2)} · ${n(i.Ecm, 0)} ${secUnit}`,
        value: i.fck,
        unit: 'N/mm²',
        decimals: 0,
        check: false,
        note: concreteGrade
          ? `Ecm = 5000 √fck = ${n(concreteGrade.Ecm, 0)} N/mm²${i.Ecm !== concreteGrade.Ecm ? ` — overridden to ${n(i.Ecm, 0)}` : ''}`
          : 'custom values — not tied to a standard grade',
      },
      {
        id: 'rebar-grade',
        symbol: 'Reinforcement',
        label: rebarGrade ? rebarGrade.name : 'custom grade',
        formula: 'fyk, Es, γs',
        substitution: `${n(i.fyk, 0)} N/mm² · ${n(i.Est, 0)} ${secUnit} · ${n(i.gammaK, 2)}`,
        value: i.fyk,
        unit: 'N/mm²',
        decimals: 0,
        check: false,
      },
      {
        id: 'steel-grade',
        symbol: 'Structural steel',
        label: steelGrade ? steelGrade.name : 'custom grade',
        formula: 'fy, fu, E, γm0',
        substitution: `${n(i.fy, 0)} N/mm² · ${n(i.fu, 0)} N/mm² · ${n(i.Es, 0)} ${secUnit} · ${n(i.gammaM0, 2)}`,
        value: i.fy,
        unit: 'N/mm²',
        decimals: 0,
        check: false,
        note: 'fu is not used by the simplified method; it is reported for traceability and checked for consistency',
      },
      {
        id: 'section-type',
        symbol: 'Section type',
        label:
          i.sectionType === 'circular'
            ? `circular encasement ⌀${n(i.diameter, 0)} mm with a peripheral cage`
            : i.sectionType === 'rect-slab'
              ? `rectangular encasement with slab (${n(i.slabWidth, 0)} × ${n(i.slabThickness, 0)} mm)`
              : 'rectangular encasement',
        formula: 'concrete outline',
        substitution:
          i.sectionType === 'circular'
            ? `π D²/4 = π × ${n(i.diameter, 0)}² / 4`
            : i.sectionType === 'rect-slab'
              ? `bc × hc + bslab × tslab = ${n(bc, 0)} × ${n(hc, 0)} + ${n(i.slabWidth, 0)} × ${n(i.slabThickness, 0)}`
              : `bc × hc = ${n(bc, 0)} × ${n(hc, 0)}`,
        value: Ac,
        unit: 'mm²',
        decimals: 0,
        check: false,
        note:
          i.sectionType === 'circular'
            ? 'extension of the reference method: the compression block is the circular strip within ±hn, the plastic modulus of the outline is D³/6 and the bent axes are the diameters'
            : i.sectionType === 'rect-slab'
              ? 'extension of the reference method: the slab is added to the concrete area and to Ic / Zpc about the encasement axes'
              : 'the verified reference configuration',
      },
      {
        id: 'bar-schedule',
        symbol: 'Reinforcement',
        label: `${bars.count} bars in ${i.bars.length} row${i.bars.length === 1 ? '' : 's'}, largest ⌀${n(bars.dbMax, 0)} mm`,
        formula: 'Ast = Σ nb π db²/4',
        substitution:
          i.bars
            .map((row) => `${row.label}: ${n(row.count, 0)} × ⌀${n(row.db, 0)} @ (${n(row.x, 0)}, ${n(row.y, 0)}) mm`)
            .join('  ·  ') || 'no bars defined',
        value: Ast,
        unit: 'mm²',
        decimals: 1,
        check: false,
        note: `Ast/Ac = ${n((Ast / Math.max(Ac, 1e-9)) * 100, 3)} % of the concrete area (minimum 0.8 %)`,
      },
    ],
    notes: [
      'The root radius r of the rolled section is used for the drawing and for detailing checks only; the section properties ignore it, exactly as the reference method does.',
      i.sectionType === 'circular'
        ? 'Circular encasement (an extension of the reference method): the peripheral bars are evaluated individually inside the 2hn band, αc is applied about both diameters, and the neutral-axis depth is solved from the transcendental block equation (no rounding).'
        : i.sectionType === 'rect-slab'
        ? 'The slab is treated as additional concrete concentric in z and offset in y about the encasement centroid. The interaction-point-C equations of the reference method assume a rectangular outline, so slab results are an extension and should be verified independently.'
        : 'Encasement type: rectangular — this is the configuration verified against the benchmark.',
    ],
  }

  /* ------------------------------------------------------------------ */
  /* required strengths + section properties                             */
  /* ------------------------------------------------------------------ */
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
        formula: 'Mz = Mz,edge / 2',
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
        formula: 'My = My,edge / 2',
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
        id: 'Ast',
        symbol: 'Ast',
        label: `total reinforcement area (${bars.count} bars)`,
        formula: 'Ast = Σ nb π db²/4',
        substitution:
          i.bars
            .map((row) => `${n(row.count, 0)} × π × ${n(row.db, 0)}² / 4`)
            .join(' + ') || '= 0',
        value: Ast,
        unit: 'mm²',
        decimals: 2,
        ref: '3.Sect Props!D30',
        check: false,
      },
      {
        id: 'IstZ',
        symbol: 'Ist,z',
        label: 'second moment of the reinforcement about the major axis',
        formula: 'Ist,z = Σ (Isr,i + Ast,i yi²)',
        substitution: `= Σ (Isr,i + Ast,i yi²) = ${n(IstZ, 0)}`,
        value: IstZ,
        unit: 'mm⁴',
        decimals: 0,
        ref: '3.Sect Props!D35',
        check: false,
      },
      {
        id: 'IstY',
        symbol: 'Ist,y',
        label: 'second moment of the reinforcement about the minor axis',
        formula: 'Ist,y = Σ (Isr,i + Ast,i xi²)',
        substitution: `= ${n(IstY, 0)}`,
        value: IstY,
        unit: 'mm⁴',
        decimals: 0,
        check: false,
      },
      {
        id: 'ZprZ',
        symbol: 'Zpr,z',
        label: 'plastic section modulus of the reinforcement, major axis',
        formula: 'Zpr,z = Σ Ast,i |yi|',
        substitution: `= ${n(ZprZ, 1)}`,
        value: ZprZ,
        unit: 'mm³',
        decimals: 1,
        ref: '3.Sect Props!D37',
      },
      {
        id: 'ZprY',
        symbol: 'Zpr,y',
        label: 'plastic section modulus of the reinforcement, minor axis',
        formula: 'Zpr,y = Σ Ast,i |xi|',
        substitution: `= ${n(ZprY, 1)}`,
        value: ZprY,
        unit: 'mm³',
        decimals: 1,
      },
      {
        id: 'Ac',
        symbol: 'Ac',
        label: 'concrete area (encasement' + (Aslab > 0 ? ' + slab' : '') + ', less steel and bars)',
        formula:
          i.sectionType === 'circular'
            ? 'Ac = π D²/4 − As − Ast'
            : Aslab > 0
              ? 'Ac = bc hc + bs ts − As − Ast'
              : 'Ac = bc hc − As − Ast',
        substitution:
          i.sectionType === 'circular'
            ? `= π × ${n(i.diameter, 0)}² / 4 − ${n(As, 1)} − ${n(Ast, 1)}`
            : Aslab > 0
              ? `= ${n(bc, 0)} × ${n(hc, 0)} + ${n(concrete.slabWidth, 0)} × ${n(concrete.slabThickness, 0)} − ${n(As, 1)} − ${n(Ast, 1)}`
              : `= ${n(bc, 0)} × ${n(hc, 0)} − ${n(As, 1)} − ${n(Ast, 1)}`,
        value: Ac,
        unit: 'mm²',
        decimals: 1,
        ref: '3.Sect Props!D41',
        check: false,
      },
      {
        id: 'IcZ',
        symbol: 'Ic,z',
        label: 'second moment of area of the concrete, major axis',
        formula:
          i.sectionType === 'circular'
            ? 'Ic,z = π D⁴/64 − Is,z − Ist,z'
            : Aslab > 0
              ? 'Ic,z = bc hc³/12 + [bs ts³/12 + Aslab d²] − Is,z − Ist,z'
              : 'Ic,z = bc hc³/12 − Is,z − Ist,z',
        substitution: `= ${n(IcZ, 0)}`,
        value: IcZ,
        unit: 'mm⁴',
        decimals: 0,
        ref: '3.Sect Props!D43',
        check: false,
      },
      {
        id: 'IcY',
        symbol: 'Ic,y',
        label: 'second moment of area of the concrete, minor axis',
        formula:
          i.sectionType === 'circular'
            ? 'Ic,y = π D⁴/64 − Is,y − Ist,y'
            : Aslab > 0
              ? 'Ic,y = hc bc³/12 + ts bs³/12 − Is,y − Ist,y'
              : 'Ic,y = hc bc³/12 − Is,y − Ist,y',
        substitution: `= ${n(IcY, 0)}`,
        value: IcY,
        unit: 'mm⁴',
        decimals: 0,
        ref: '3.Sect Props!D45',
        check: false,
      },
      {
        id: 'ZpcZ',
        symbol: 'Zpc,z',
        label: 'plastic section modulus of the concrete, major axis',
        formula:
          i.sectionType === 'circular'
            ? 'Zpc,z = D³/6 − Zps,z − Zpr,z'
            : Aslab > 0
              ? 'Zpc,z = bc hc²/4 + Aslab d − Zps,z − Zpr,z'
              : 'Zpc,z = bc hc²/4 − Zps,z − Zpr,z',
        substitution: `= ${n(ZpcZ, 0)}`,
        value: ZpcZ,
        unit: 'mm³',
        decimals: 0,
        ref: '3.Sect Props!D47',
        check: false,
      },
      {
        id: 'ZpcY',
        symbol: 'Zpc,y',
        label: 'plastic section modulus of the concrete, minor axis',
        formula:
          i.sectionType === 'circular'
            ? 'Zpc,y = D³/6 − Zps,y − Zpr,y'
            : Aslab > 0
              ? 'Zpc,y = hc bc²/4 + ts bs²/4 − Zps,y − Zpr,y'
              : 'Zpc,y = hc bc²/4 − Zps,y − Zpr,y',
        substitution: `= ${n(ZpcY, 0)}`,
        value: ZpcY,
        unit: 'mm³',
        decimals: 0,
        ref: '3.Sect Props!D49',
      },
    ],
    notes: [
      'The concrete properties are obtained by subtracting the steel and reinforcement contributions from the concrete outline (no transformed-section modular ratio is applied, following the workbook).',
      'Reinforcement properties are evaluated from the bar position table, so any bar arrangement can be modelled directly.',
    ],
  }

  /* ---------------- circular peripheral cage: detailing checks --------------- */
  const Ag = circleArea(i.diameter)
  const ringRows = i.bars.filter((b) => b.spread === 'ring')
  const ringBars = ringRows.reduce((sum, r) => sum + Math.max(0, Math.round(r.count)), 0)
  const pitchRows = ringRows.filter((r) => r.x > 0 && r.count > 0)
  const minPitch = pitchRows.length
    ? Math.min(...pitchRows.map((r) => (2 * Math.PI * r.x) / Math.max(1, Math.round(r.count))))
    : 0
  const steelRatio = Ag > 0 ? (Ast / Ag) * 100 : 0
  const dbMin = bars.count > 0 ? Math.min(...i.bars.flatMap((r) => (r.count > 0 ? [r.db] : []))) : 0

  if (i.sectionType === 'circular') {
    group.steps.push(
      {
        id: 'circ-bars',
        symbol: 'n',
        label: 'number of longitudinal bars on the periphery',
        formula: 'Σ n (ring rows)',
        substitution: `= ${n(ringBars, 0)} bars in ${ringRows.length} ring${ringRows.length === 1 ? '' : 's'}`,
        value: ringBars,
        unit: 'nos.',
        decimals: 0,
        status: ringBars >= 6 ? 'ok' : 'fail',
        note:
          ringBars >= 6
            ? '≥ 6 bars — minimum for a circular column (IS 456:2000, cl. 26.5.3.1)'
            : 'a circular column needs at least 6 longitudinal bars (IS 456:2000, cl. 26.5.3.1)',
      },
      {
        id: 'circ-db',
        symbol: '⌀min',
        label: 'smallest longitudinal bar',
        formula: 'min (db)',
        substitution: `= ${n(dbMin, 0)} mm`,
        value: dbMin,
        unit: 'mm',
        decimals: 0,
        status: dbMin >= 12 ? 'ok' : 'fail',
        note: dbMin >= 12 ? '≥ 12 mm' : 'longitudinal bars shall be at least 12 mm (IS 456:2000, cl. 26.5.3.1(b))',
      },
      {
        id: 'circ-ratio',
        symbol: 'Ast/Ag',
        label: 'longitudinal reinforcement ratio',
        formula: 'Ast / (π D²/4)',
        substitution: `= ${n(Ast, 1)} / ${n(Ag, 0)}`,
        value: steelRatio,
        unit: '%',
        decimals: 3,
        status: steelRatio >= 0.8 && steelRatio <= 6 ? 'ok' : steelRatio < 0.8 ? 'fail' : 'warn',
        note:
          steelRatio >= 0.8 && steelRatio <= 6
            ? '0.8 % ≤ Ast/Ag ≤ 6 % (IS 456:2000, cl. 26.5.3.1)'
            : steelRatio < 0.8
              ? 'below the 0.8 % minimum of IS 456:2000, cl. 26.5.3.1(d)'
              : 'above the 6 % maximum of IS 456:2000, cl. 26.5.3.1',
      },
      {
        id: 'circ-pitch',
        symbol: 'p',
        label: 'pitch of the peripheral bars along the ring',
        formula: 'p = 2π rho / n',
        substitution: pitchRows.length
          ? pitchRows.map((r) => `2π × ${n(r.x, 0)} / ${n(Math.round(r.count), 0)}`).join('  ·  ')
          : 'no ring row defined',
        value: minPitch,
        unit: 'mm',
        decimals: 1,
        status: pitchRows.length && minPitch <= 300 && minPitch >= 75 ? 'ok' : 'warn',
        note:
          pitchRows.length && minPitch <= 300 && minPitch >= 75
            ? '75 mm ≤ pitch ≤ 300 mm (indicative detailing range for a peripheral cage)'
            : 'the pitch is outside the indicative 75 … 300 mm range — check the detailing',
      },
    )
  }
  if (i.sectionType === 'circular') {
    group.notes = group.notes ?? []
    group.notes.push(
      `Peripheral cage: ${ringBars} bars, ⌀${n(bars.dbMax, 0)} mm maximum, Ast/Ag = ${n(steelRatio, 3)} %. The encased I-section diagonal is ${n(steelCornerRadius(i), 1)} mm against R = ${n(i.diameter / 2, 1)} mm.`,
    )
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
      Ast,
      IstZ,
      IstY,
      ZprZ,
      ZprY,
      Ac,
      IcZ,
      IcY,
      ZpcZ,
      ZpcY,
      bars,
      concrete,
    },
    dataGroup,
    group,
  }
}
