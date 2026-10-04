import { useMemo, useState } from 'react'
import type { BarRow, Inputs, Results, SectionType } from '../lib/types'
import { DEFAULT_INPUTS, PRESETS, REFERENCE_RING, newRowFor, type InputProblem, type Preset } from '../lib/calc/defaults'
import { designRing } from '../lib/design'
import {
  CONCRETE_GRADES,
  CUSTOM_GRADE,
  REBAR_GRADES,
  STEEL_GRADES,
  ecmOf,
  findConcrete,
  findRebar,
  findSteel,
} from '../lib/calc/grades'
import { barInstances, steelCornerRadius } from '../lib/calc/geometry'
import { fmt } from '../lib/format'
import { NumberField, NullableNumberField } from './NumberField'
import { BarTable } from './BarTable'
import { CrossSection } from './CrossSection'
import { Badge, Button, Fieldset, cx } from './ui'

interface Props {
  inputs: Inputs
  results: Results
  problems: InputProblem[]
  setInput: <K extends keyof Inputs>(key: K, value: Inputs[K]) => void
  patchInputs: (patch: Partial<Inputs>) => void
  onPreset: (preset: Preset) => void
  onReset: () => void
  activePresetId: string | null
  onSaveInputs: () => void
  onLoadInputs: () => void
  onExportReport: () => void
  onExportJson: () => void
  onExportCsv: () => void
  onPrint: () => void
}

export function InputPanel({
  inputs,
  results,
  problems,
  setInput,
  patchInputs,
  onPreset,
  onReset,
  activePresetId,
  onSaveInputs,
  onLoadInputs,
  onExportReport,
  onExportJson,
  onExportCsv,
  onPrint,
}: Props) {
  const errors = problems.filter((p) => p.level === 'error')
  const warnings = problems.filter((p) => p.level === 'warn')
  const stress = inputs.units.stress
  const metres = inputs.units.length === 'm'

  const num = (key: keyof Inputs, opts: Partial<Parameters<typeof NumberField>[0]> = {}) => (
    <NumberField
      key={key}
      label={LABELS[key]?.label ?? String(key)}
      symbol={LABELS[key]?.symbol}
      unit={LABELS[key]?.unit === 'N/mm²' ? stress : (LABELS[key]?.unit ?? undefined)}
      step={LABELS[key]?.step ?? 1}
      min={LABELS[key]?.min ?? 0}
      hint={LABELS[key]?.hint}
      value={inputs[key] as number}
      onChange={(v) => setInput(key, v as never)}
      {...opts}
    />
  )

  /* ---------------- grade selection with auto-fill ---------------- */
  const setConcrete = (patch: Partial<Pick<Inputs, 'fck' | 'gammaC' | 'Ecm'>>) => {
    const merged = { ...inputs, ...patch }
    const grade = findConcrete(inputs.concreteGrade)
    const keep = grade && grade.fck === merged.fck && grade.gammaC === merged.gammaC && grade.Ecm === merged.Ecm
    patchInputs({ ...patch, concreteGrade: keep ? inputs.concreteGrade : CUSTOM_GRADE })
  }
  const setRebar = (patch: Partial<Pick<Inputs, 'fyk' | 'Est' | 'gammaK'>>) => {
    const merged = { ...inputs, ...patch }
    const grade = findRebar(inputs.rebarGrade)
    const keep = grade && grade.fyk === merged.fyk && grade.Es === merged.Est && grade.gammaS === merged.gammaK
    patchInputs({ ...patch, rebarGrade: keep ? inputs.rebarGrade : CUSTOM_GRADE })
  }
  const setSteel = (patch: Partial<Pick<Inputs, 'fy' | 'fu' | 'Es' | 'gammaM0'>>) => {
    const merged = { ...inputs, ...patch }
    const grade = findSteel(inputs.steelGrade)
    const keep =
      grade &&
      grade.fy === merged.fy &&
      grade.fu === merged.fu &&
      grade.E === merged.Es &&
      grade.gammaS === merged.gammaM0
    patchInputs({ ...patch, steelGrade: keep ? inputs.steelGrade : CUSTOM_GRADE })
  }
  const setGrade = (key: 'concreteGrade' | 'rebarGrade' | 'steelGrade', id: string) => {
    if (id === CUSTOM_GRADE) {
      patchInputs({ [key]: CUSTOM_GRADE } as Partial<Inputs>)
      return
    }
    if (key === 'concreteGrade') {
      const g = findConcrete(id)
      if (g) patchInputs({ concreteGrade: id, fck: g.fck, gammaC: g.gammaC, Ecm: g.Ecm })
    } else if (key === 'rebarGrade') {
      const g = findRebar(id)
      if (g) patchInputs({ rebarGrade: id, fyk: g.fyk, Est: g.Es, gammaK: g.gammaS })
    } else {
      const g = findSteel(id)
      if (g) patchInputs({ steelGrade: id, fy: g.fy, fu: g.fu, Es: g.E, gammaM0: g.gammaS })
    }
  }

  const concreteGrade = findConcrete(inputs.concreteGrade)
  const rebarGrade = findRebar(inputs.rebarGrade)
  const steelGrade = findSteel(inputs.steelGrade)
  const concreteCustom = inputs.concreteGrade === CUSTOM_GRADE
  const rebarCustom = inputs.rebarGrade === CUSTOM_GRADE
  const steelCustom = inputs.steelGrade === CUSTOM_GRADE

  const setLength = (key: 'Ly' | 'Lz', shown: number) => setInput(key, metres ? shown * 1000 : shown)

  const instances = barInstances(inputs.bars)
  const circular = inputs.sectionType === 'circular'
  const R = inputs.diameter / 2

  /** Switch the encasement family, converting the ring/corner rows as needed. */
  const switchSectionType = (next: SectionType) => {
    if (next === inputs.sectionType) return
    if (next === 'circular') {
      const rho = Math.max(inputs.diameter / 2 - inputs.cover, 0)
      let converted = false
      const bars = inputs.bars.map((b) => {
        if (converted || b.spread === 'ring') return b
        converted = true
        const count = Math.max(6, Math.round(b.count / 2) * 2)
        return { ...b, spread: 'ring' as const, count, cover: inputs.cover, x: rho, y: 0 }
      })
      patchInputs({ sectionType: next, bars })
    } else {
      const bars = inputs.bars.map((b) =>
        b.spread === 'ring'
          ? {
              ...b,
              spread: 'corner' as const,
              count: Math.max(4, Math.round(b.count / 4) * 4),
              cover: inputs.cover,
              x: Math.max(inputs.bc / 2 - inputs.cover, 0),
              y: Math.max(inputs.hc / 2 - inputs.cover, 0),
            }
          : b,
      )
      patchInputs({ sectionType: next, bars })
    }
  }

  return (
    <div className="divide-y divide-ink-200/70 dark:divide-ink-800">
      {/* ------------------------------------------------ validation */}
      <Fieldset
        title={`Validation${errors.length || warnings.length ? ` — ${errors.length} error(s), ${warnings.length} warning(s)` : ''}`}
        defaultOpen={errors.length > 0 || warnings.length > 0}
        hint="Every input is checked before the calculation: ranges, geometry consistency and the reinforcement table."
      >
        <div className="col-span-full space-y-1.5">
          {errors.length === 0 && warnings.length === 0 && (
            <p className="flex items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-300">
              <Badge status="ok">ok</Badge> All inputs are valid.
            </p>
          )}
          {errors.map((p, i) => (
            <p key={`e${i}`} className="flex items-start gap-2 text-[11px] leading-relaxed text-rose-700 dark:text-rose-300">
              <Badge status="fail">error</Badge>
              <span>{p.message}</span>
            </p>
          ))}
          {warnings.map((p, i) => (
            <p key={`w${i}`} className="flex items-start gap-2 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
              <Badge status="warn">warn</Badge>
              <span>{p.message}</span>
            </p>
          ))}
        </div>
      </Fieldset>

      {/* ------------------------------------------------ units */}
      <Fieldset
        title="Units"
        defaultOpen={false}
        hint="The engine always works in mm / N / N·mm internally. The length selection drives how member lengths are entered; MPa and N/mm² are the same quantity, so the stress selection only relabels the fields."
      >
        <label className="block">
          <span className="text-[11px] font-medium text-ink-600 dark:text-ink-300">Member length unit</span>
          <select
            value={inputs.units.length}
            onChange={(e) => patchInputs({ units: { ...inputs.units, length: e.target.value as 'mm' | 'm' } })}
            aria-label="Member length unit"
            className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-900 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-50"
          >
            <option value="mm">mm (millimetres)</option>
            <option value="m">m (metres)</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] font-medium text-ink-600 dark:text-ink-300">Stress unit</span>
          <select
            value={inputs.units.stress}
            onChange={(e) => patchInputs({ units: { ...inputs.units, stress: e.target.value as 'N/mm²' | 'MPa' } })}
            aria-label="Stress unit"
            className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-900 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-50"
          >
            <option value="N/mm²">N/mm²</option>
            <option value="MPa">MPa (identical to N/mm²)</option>
          </select>
        </label>
        <p className="col-span-full text-[11px] text-ink-500 dark:text-ink-400">
          Forces are entered in kN and moments in kN-m throughout.
        </p>
      </Fieldset>

      {/* ------------------------------------------------ loading */}
      <Fieldset
        title="Loadings"
        hint="Characteristic actions on the member; the design values at mid-height are half of the end moments."
      >
        {num('PD')}
        {num('PL')}
        {num('Mz')}
        {num('My')}
      </Fieldset>

      {/* ------------------------------------------------ materials */}
      <Fieldset
        title="Materials"
        hint="Pick a standard grade to auto-fill the characteristic values, or type your own numbers — the row is then reported as customised."
      >
        <div className="col-span-full space-y-3">
          {/* concrete */}
          <div className="rounded-lg border border-ink-200/80 p-2.5 dark:border-ink-800">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold tracking-wide text-ink-600 uppercase dark:text-ink-300">
                Concrete
              </span>
              {concreteCustom && <Badge status="warn">customised</Badge>}
            </div>
            <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-[11px] font-medium text-ink-600 dark:text-ink-300">Grade</span>
                <select
                  value={concreteCustom ? CUSTOM_GRADE : inputs.concreteGrade}
                  aria-label="Concrete grade"
                  onChange={(e) => setGrade('concreteGrade', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-900 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-50"
                >
                  {CONCRETE_GRADES.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                      {g.note ? ` — ${g.note}` : ''}
                    </option>
                  ))}
                  <option value={CUSTOM_GRADE}>Custom / user-defined</option>
                </select>
              </label>
              <NumberField
                label="Characteristic cylinder strength"
                symbol="fck"
                unit={stress}
                step={1}
                min={1}
                value={inputs.fck}
                onChange={(v) => setConcrete({ fck: v })}
                hint="Ecm = 5000 √fck per IS 456"
              />
              <NumberField
                label="Partial factor, concrete"
                symbol="γc"
                step={0.05}
                min={0.1}
                value={inputs.gammaC}
                onChange={(v) => setConcrete({ gammaC: v })}
              />
              <NumberField
                label="Secant modulus of elasticity"
                symbol="Ecm"
                unit={stress}
                step={100}
                min={1}
                value={inputs.Ecm}
                onChange={(v) => setConcrete({ Ecm: v })}
              />
              <div className="self-end text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
                5000 √fck = {fmt(ecmOf(inputs.fck), 0)} {stress}
                {concreteGrade && (
                  <>
                    <br />
                    standard {concreteGrade.name}: fck {fmt(concreteGrade.fck, 0)} · γc{' '}
                    {fmt(concreteGrade.gammaC, 2)} · Ecm {fmt(concreteGrade.Ecm, 0)}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* reinforcement */}
          <div className="rounded-lg border border-ink-200/80 p-2.5 dark:border-ink-800">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold tracking-wide text-ink-600 uppercase dark:text-ink-300">
                Reinforcement
              </span>
              {rebarCustom && <Badge status="warn">customised</Badge>}
            </div>
            <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-[11px] font-medium text-ink-600 dark:text-ink-300">Grade</span>
                <select
                  value={rebarCustom ? CUSTOM_GRADE : inputs.rebarGrade}
                  aria-label="Reinforcement grade"
                  onChange={(e) => setGrade('rebarGrade', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-900 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-50"
                >
                  {REBAR_GRADES.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                      {g.note ? ` — ${g.note}` : ''}
                    </option>
                  ))}
                  <option value={CUSTOM_GRADE}>Custom / user-defined</option>
                </select>
              </label>
              <NumberField
                label="Characteristic yield strength"
                symbol="fyk"
                unit={stress}
                step={5}
                min={1}
                value={inputs.fyk}
                onChange={(v) => setRebar({ fyk: v })}
              />
              <NumberField
                label="Partial factor, reinforcement"
                symbol="γs"
                step={0.05}
                min={0.1}
                value={inputs.gammaK}
                onChange={(v) => setRebar({ gammaK: v })}
              />
              <NumberField
                label="Modulus of elasticity"
                symbol="Es"
                unit={stress}
                step={1000}
                min={1}
                value={inputs.Est}
                onChange={(v) => setRebar({ Est: v })}
              />
              {rebarGrade && (
                <div className="self-end text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
                  standard {rebarGrade.name}: fyk {fmt(rebarGrade.fyk, 0)} · Es {fmt(rebarGrade.Es, 0)} · γs{' '}
                  {fmt(rebarGrade.gammaS, 2)}
                </div>
              )}
            </div>
          </div>

          {/* structural steel */}
          <div className="rounded-lg border border-ink-200/80 p-2.5 dark:border-ink-800">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold tracking-wide text-ink-600 uppercase dark:text-ink-300">
                Structural steel
              </span>
              {steelCustom && <Badge status="warn">customised</Badge>}
            </div>
            <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-[11px] font-medium text-ink-600 dark:text-ink-300">Grade</span>
                <select
                  value={steelCustom ? CUSTOM_GRADE : inputs.steelGrade}
                  aria-label="Structural steel grade"
                  onChange={(e) => setGrade('steelGrade', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-900 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-50"
                >
                  {STEEL_GRADES.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                      {g.note ? ` — ${g.note}` : ''}
                    </option>
                  ))}
                  <option value={CUSTOM_GRADE}>Custom / user-defined</option>
                </select>
              </label>
              <NumberField
                label="Yield strength"
                symbol="fy"
                unit={stress}
                step={5}
                min={1}
                value={inputs.fy}
                onChange={(v) => setSteel({ fy: v })}
                hint="Used by the simplified method"
              />
              <NumberField
                label="Ultimate strength"
                symbol="fu"
                unit={stress}
                step={5}
                min={1}
                value={inputs.fu}
                onChange={(v) => setSteel({ fu: v })}
                hint="Reported for traceability; the simplified method does not use fu"
              />
              <NumberField
                label="Modulus of elasticity"
                symbol="E"
                unit={stress}
                step={1000}
                min={1}
                value={inputs.Es}
                onChange={(v) => setSteel({ Es: v })}
                hint={steelGrade?.note}
              />
              <NumberField
                label="Partial factor, steel"
                symbol="γm0"
                step={0.05}
                min={0.1}
                value={inputs.gammaM0}
                onChange={(v) => setSteel({ gammaM0: v })}
              />
            </div>
            {steelGrade?.note && <p className="mt-2 text-[11px] text-ink-500 dark:text-ink-400">{steelGrade.note}</p>}
          </div>
        </div>
      </Fieldset>

      {/* ------------------------------------------------ cross-section */}
      <Fieldset
        title="Concrete section & steel I-section"
        hint="Dimensions in mm. The cover is measured from the concrete face to the centre of the bar."
      >
        <div className="col-span-full space-y-2">
          <span className="text-[11px] font-medium text-ink-600 dark:text-ink-300">Section type</span>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['rect', 'Rectangular encasement'],
                ['rect-slab', 'Encasement + slab'],
                ['circular', 'Circular encasement'],
              ] as [SectionType, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => switchSectionType(value)}
                className={cx(
                  'rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                  inputs.sectionType === value
                    ? 'border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-500 dark:bg-brand-500/10 dark:text-brand-100'
                    : 'border-ink-200 text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800/60',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {circular ? num('diameter') : num('bc')}
        {!circular && num('hc')}
        {num('cover')}
        <div className="col-span-full -mt-1">
          <button
            type="button"
            onClick={() =>
              patchInputs({
                bars: inputs.bars.map((b) =>
                  circular
                    ? b.spread === 'ring'
                      ? { ...b, cover: inputs.cover, x: Math.max(inputs.diameter / 2 - inputs.cover, 0) }
                      : b
                    : { ...b, cover: inputs.cover },
                ),
              })
            }
            className="text-[11px] font-medium text-brand-700 hover:underline dark:text-brand-300"
          >
            {circular ? 'Apply this cover to the ring rows' : 'Apply this cover to every bar row'}
          </button>
        </div>
        {inputs.sectionType === 'rect-slab' && num('slabWidth')}
        {inputs.sectionType === 'rect-slab' && num('slabThickness')}
        {circular && (
          <p className="col-span-full text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
            ⌀{fmt(inputs.diameter, 0)} mm circular encasement; R = {fmt(R, 1)} mm. The outermost corner of the
            embedded I-section is {fmt(steelCornerRadius(inputs), 1)} mm from the centroid and must stay below R.
          </p>
        )}

        <div className="col-span-full mt-1 border-t border-dashed border-ink-200/70 pt-2.5 dark:border-ink-800">
          <span className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase dark:text-ink-400">
            Embedded I-section
          </span>
        </div>
        {num('h')}
        {num('bf')}
        {num('tw')}
        {num('tf')}
        {num('r')}
      </Fieldset>

      {/* ------------------------------------------------ reinforcement */}
      <Fieldset
        title="Reinforcement"
        hint="One row per bar group. Corner rows place four bars at (±X, ±Y); point rows stack n bars at a single position."
      >
        <div className="col-span-full mb-2 overflow-hidden rounded-lg border border-ink-200/80 bg-ink-50/60 dark:border-ink-800 dark:bg-ink-900/40">
          <CrossSection inputs={inputs} preview className="mx-auto h-[190px] w-full" />
        </div>

        <BarTable
          inputs={inputs}
          onUpdate={(id, patch) => patchInputs({ bars: inputs.bars.map((b) => (b.id === id ? { ...b, ...patch } : b)) })}
          onAdd={() => {
            const used = new Set(inputs.bars.map((b) => b.id))
            let n = inputs.bars.length + 1
            let id = `bar-${n}`
            while (used.has(id)) id = `bar-${++n}`
            const row: BarRow = newRowFor(inputs, id)
            patchInputs({ bars: [...inputs.bars, row] })
          }}
          onRemove={(id) => patchInputs({ bars: inputs.bars.filter((b) => b.id !== id) })}
          onReset={() =>
            patchInputs(
              circular
                ? {
                    bars: REFERENCE_RING.map((b) => ({ ...b, x: Math.max(inputs.diameter / 2 - inputs.cover, 0), cover: inputs.cover })),
                    astcModel: 'positions' as const,
                  }
                : {
                    bars: DEFAULT_INPUTS.bars.map((b) => ({ ...b, cover: inputs.cover })),
                    astcModel: DEFAULT_INPUTS.astcModel,
                  },
            )
          }
        />

        <label className="col-span-full mt-1 block">
          <span className="text-[11px] font-medium text-ink-600 dark:text-ink-300">
            Reinforcement inside the compression zone
          </span>
          <select
            value={circular ? 'positions' : inputs.astcModel}
            aria-label="Compression-zone reinforcement model"
            disabled={circular}
            onChange={(e) => setInput('astcModel', e.target.value as Inputs['astcModel'])}
            className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-900 disabled:opacity-60 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-50"
          >
            <option value="reference">Two corner bars — Astc = 2 × Ast,b (reference method)</option>
            <option value="positions">From the bar table — all bars within 2 hn</option>
          </select>
          {circular && (
            <span className="mt-1 block text-[11px] text-ink-500 dark:text-ink-400">
              A peripheral cage is always evaluated bar by bar inside the 2hn band.
            </span>
          )}
        </label>
        <p className="col-span-full text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
          {instances.length} bar{instances.length === 1 ? '' : 's'} defined. The reference method assumes two corner
          bars in the compression zone; the position-based option evaluates every bar of the table against the
          neutral-axis depth instead.
        </p>

        {circular && <DesignPanel inputs={inputs} onApply={(row) => patchInputs({ bars: [...inputs.bars.filter((b) => b.spread !== 'ring'), row] })} />}
      </Fieldset>

      {/* ------------------------------------------------ member */}
      <Fieldset
        title="Member & buckling"
        defaultOpen={false}
        hint="Effective length factors, buckling curves and the shape of the first-order moment diagram."
      >
        {num('Ky')}
        {num('Kz')}
        <NumberField
          label="Unbraced length about y"
          symbol="Ly"
          unit={inputs.units.length}
          step={metres ? 0.25 : 250}
          min={0}
          value={metres ? inputs.Ly / 1000 : inputs.Ly}
          onChange={(v) => setLength('Ly', v)}
        />
        <NumberField
          label="Unbraced length about z"
          symbol="Lz"
          unit={inputs.units.length}
          step={metres ? 0.25 : 250}
          min={0}
          value={metres ? inputs.Lz / 1000 : inputs.Lz}
          onChange={(v) => setLength('Lz', v)}
        />
        <p className="col-span-full text-[11px] text-ink-500 dark:text-ink-400">
          Equivalent to {fmt(inputs.Lz / 1000, 2)} m about z and {fmt(inputs.Ly / 1000, 2)} m about y.
        </p>
        {num('alphaImpZ')}
        {num('alphaImpY')}
        {num('psi', { min: -1, max: 1, step: 0.1 })}
      </Fieldset>

      {/* ------------------------------------------------ advanced */}
      <Fieldset
        title="Advanced"
        defaultOpen={false}
        hint="Neutral-axis depth adopted for the interaction point C. Leave the overrides off to use the closed-form value rounded up exactly as the reference workbook does."
      >
        <NullableNumberField
          label="Override hn,z"
          value={inputs.hnZOverride}
          seed={results.axes.z.hn}
          unit="mm"
          step={0.1}
          onChange={(v) => setInput('hnZOverride', v)}
        />
        <NullableNumberField
          label="Override hn,y"
          value={inputs.hnYOverride}
          seed={results.axes.y.hn}
          unit="mm"
          step={0.1}
          onChange={(v) => setInput('hnYOverride', v)}
        />
        {num('alphaC')}
        {num('alphaCC')}
        {num('eta')}
        <div className="col-span-full rounded-lg bg-ink-50 px-3 py-2 text-[11px] leading-relaxed text-ink-500 dark:bg-ink-900/50 dark:text-ink-400">
          Reference values: hn,z = 78.5 mm (report: 78.6 mm) and hn,y = 95.2 mm (report: 94.4 mm). The influence of
          the rounding on the D/C ratio is small and is reported in the validation panel.
        </div>
      </Fieldset>

      {/* ------------------------------------------------ presets & files */}
      <Fieldset title="Presets & files" hint="Start from the reference example, then save, load or export the input set.">
        <div className="col-span-full space-y-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onPreset(preset)}
              className={cx(
                'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                activePresetId === preset.id
                  ? 'border-brand-500 bg-brand-50 dark:border-brand-500 dark:bg-brand-500/10'
                  : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50 dark:border-ink-700 dark:hover:border-ink-600 dark:hover:bg-ink-800/60',
              )}
            >
              <div className="text-[13px] font-medium text-ink-900 dark:text-ink-50">{preset.name}</div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
                {preset.description}
              </div>
            </button>
          ))}
        </div>

        <div className="col-span-full flex flex-wrap items-center gap-1.5 pt-1">
          <Button size="sm" variant="subtle" onClick={onSaveInputs}>
            Save
          </Button>
          <Button size="sm" variant="subtle" onClick={onLoadInputs}>
            Load
          </Button>
          <ExportMenu onExportReport={onExportReport} onExportJson={onExportJson} onExportCsv={onExportCsv} />
          <Button size="sm" variant="ghost" onClick={onPrint}>
            Print
          </Button>
          <Button size="sm" variant="ghost" onClick={onReset}>
            Reset all
          </Button>
        </div>
      </Fieldset>
    </div>
  )
}

/**
 * Design aid for the peripheral reinforcement of a circular section: the
 * required steel area for a target demand/capacity ratio plus one practical bar
 * arrangement per standard diameter, every one evaluated with the full engine.
 */
function DesignPanel({ inputs, onApply }: { inputs: Inputs; onApply: (row: BarRow) => void }) {
  const [target, setTarget] = useState(1.0)
  const design = useMemo(() => designRing(inputs, target), [inputs, target])
  const template = inputs.bars.find((b) => b.spread === 'ring')

  if (!design || !template) {
    return (
      <p className="col-span-full rounded-lg bg-ink-50 px-3 py-2 text-[11px] leading-relaxed text-ink-500 dark:bg-ink-900/50 dark:text-ink-400">
        Add a ring row to the table to design the peripheral reinforcement.
      </p>
    )
  }

  const cell = 'px-1.5 py-1 text-right tabular'
  return (
    <div className="col-span-full space-y-2 rounded-lg border border-ink-200/80 p-2.5 dark:border-ink-800">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold tracking-wide text-ink-600 uppercase dark:text-ink-300">
            Design of the peripheral reinforcement
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
            Ring ⌀{fmt(2 * design.rho, 0)} mm · gross area Ag = {fmt(design.ag, 0)} mm² · current D/C ={' '}
            {fmt(design.currentDc, 3)}. Required steel for the target:{' '}
            <span className="font-medium text-ink-700 dark:text-ink-200">
              {design.feasible ? `${fmt(design.requiredAst, 0)} mm²` : 'not reached within 6 % of Ag'}
            </span>
            {design.feasible && (
              <>
                {' '}(minimum {fmt(design.minAst, 0)} mm² = 0.8 % Ag
                {design.requiredAst < design.minAst ? ', governing' : ''})
              </>
            )}
            .
          </p>
        </div>
        <label className="block w-[104px]">
          <span className="text-[11px] font-medium text-ink-600 dark:text-ink-300">Target D/C</span>
          <input
            type="text"
            inputMode="decimal"
            aria-label="Design target D/C"
            value={String(target)}
            onChange={(e) => {
              const v = Number(e.target.value.replace(',', '.'))
              if (Number.isFinite(v) && v > 0) setTarget(v)
            }}
            className="tabular mt-1 w-full rounded-lg border border-ink-200 bg-white px-2 py-1 text-sm text-ink-900 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-50"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-ink-200/80 dark:border-ink-800">
        <table className="w-full min-w-[520px] border-collapse text-[11px]">
          <thead>
            <tr className="bg-ink-50 text-left text-ink-500 dark:bg-ink-800/60 dark:text-ink-400">
              <th className="px-1.5 py-1.5 font-semibold">⌀ mm</th>
              <th className="px-1.5 py-1.5 font-semibold">n</th>
              <th className={cx(cell, 'font-semibold')}>Ast mm²</th>
              <th className={cx(cell, 'font-semibold')}>Ast/Ag %</th>
              <th className={cx(cell, 'font-semibold')}>pitch mm</th>
              <th className={cx(cell, 'font-semibold')}>D/C</th>
              <th className="px-1.5 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {design.candidates.map((c) => (
              <tr
                key={c.db}
                className={cx(
                  'border-t border-ink-200/70 dark:border-ink-800',
                  c.recommended && 'bg-emerald-50/70 dark:bg-emerald-500/10',
                )}
              >
                <td className="px-1.5 py-1 font-medium text-ink-900 dark:text-ink-50">{fmt(c.db, 0)}</td>
                <td className="px-1.5 py-1">{fmt(c.n, 0)}</td>
                <td className={cell}>{fmt(c.ast, 0)}</td>
                <td className={cell}>{fmt(c.ratio, 2)}</td>
                <td className={cell}>{fmt(c.pitch, 0)}</td>
                <td className={cx(cell, c.dc <= target ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300')}>
                  {fmt(c.dc, 3)}
                </td>
                <td className="px-1.5 py-1 text-right">
                  <Button
                    size="sm"
                    variant={c.recommended ? 'primary' : 'ghost'}
                    title={`Use ${c.n} ⌀${c.db} bars`}
                    onClick={() =>
                      onApply({
                        ...template,
                        spread: 'ring',
                        db: c.db,
                        count: c.n,
                        cover: inputs.cover,
                        x: Math.max(design.rho, 0),
                        y: 0,
                      })
                    }
                  >
                    Use
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
        Each row is a full engine run of the cage with n bars of that diameter: the D/C ratio, the steel ratio and
        the pitch are the real values of that arrangement (recommended: lightest adequate row, {' '}
        IS 456:2000 detailing rules applied). Applying a row replaces the ring rows of the table.
      </p>
    </div>
  )
}

/** Export dropdown (native <details> so it works without extra JS). */
function ExportMenu({
  onExportReport,
  onExportJson,
  onExportCsv,
}: {
  onExportReport: () => void
  onExportJson: () => void
  onExportCsv: () => void
}) {
  const [open, setOpen] = useState(false)
  const item = 'block w-full px-3 py-1.5 text-left text-[11px] hover:bg-ink-50 dark:hover:bg-ink-800'
  return (
    <div className="relative">
      <Button size="sm" variant="subtle" onClick={() => setOpen((o) => !o)}>
        Export ▾
      </Button>
      {open && (
        <div
          className="absolute z-20 mt-1 w-44 overflow-hidden rounded-lg border border-ink-200 bg-white shadow-lg dark:border-ink-700 dark:bg-ink-900"
          onMouseLeave={() => setOpen(false)}
        >
          <button
            type="button"
            className={item}
            onClick={() => {
              setOpen(false)
              onExportReport()
            }}
          >
            Report (HTML)
          </button>
          <button
            type="button"
            className={item}
            onClick={() => {
              setOpen(false)
              onExportJson()
            }}
          >
            Results (JSON)
          </button>
          <button
            type="button"
            className={item}
            onClick={() => {
              setOpen(false)
              onExportCsv()
            }}
          >
            Calculation steps (CSV)
          </button>
        </div>
      )}
    </div>
  )
}

const LABELS: Record<
  string,
  { label: string; symbol?: string; unit?: string; step?: number; min?: number; hint?: string }
> = {
  PD: { label: 'Dead axial load', symbol: 'PD', unit: 'kN', step: 10 },
  PL: { label: 'Live axial load', symbol: 'PL', unit: 'kN', step: 10 },
  Mz: { label: 'Live moment about z (major axis)', symbol: 'Mz', unit: 'kN-m', step: 5 },
  My: { label: 'Live moment about y (minor axis)', symbol: 'My', unit: 'kN-m', step: 5 },

  bc: { label: 'Concrete width', symbol: 'bc', unit: 'mm', step: 5 },
  hc: { label: 'Concrete depth', symbol: 'hc', unit: 'mm', step: 5 },
  cover: { label: 'Nominal cover', symbol: 'c', unit: 'mm', step: 1 },
  diameter: { label: 'Outside diameter (circular)', symbol: 'D', unit: 'mm', step: 25 },
  slabWidth: { label: 'Slab width', symbol: 'bs', unit: 'mm', step: 50 },
  slabThickness: { label: 'Slab thickness', symbol: 'ts', unit: 'mm', step: 10 },
  h: { label: 'I-section depth', symbol: 'h', unit: 'mm', step: 5 },
  bf: { label: 'I-section flange width', symbol: 'bf', unit: 'mm', step: 5 },
  tf: { label: 'Flange thickness', symbol: 'tf', unit: 'mm', step: 0.1 },
  tw: { label: 'Web thickness', symbol: 'tw', unit: 'mm', step: 0.1 },
  r: { label: 'Root radius (drawing / detailing)', symbol: 'r', unit: 'mm', step: 1 },

  Es: { label: 'Steel modulus', symbol: 'E', unit: 'N/mm²', step: 1000 },
  fy: { label: 'Steel yield strength', symbol: 'fy', unit: 'N/mm²', step: 5 },
  gammaM0: { label: 'Partial factor, steel', symbol: 'γm0', unit: '—', step: 0.05, min: 0.1 },
  Ecm: { label: 'Concrete modulus', symbol: 'Ecm', unit: 'N/mm²', step: 100 },
  fck: { label: 'Concrete strength', symbol: 'fck', unit: 'N/mm²', step: 1 },
  gammaC: { label: 'Partial factor, concrete', symbol: 'γc', unit: '—', step: 0.05, min: 0.1 },
  alphaC: { label: 'Stress-block coefficient', symbol: 'αc', unit: '—', step: 0.05, min: 0.01 },
  alphaCC: { label: 'Design strength coefficient', symbol: 'αcc', unit: '—', step: 0.05, min: 0.01 },
  eta: { label: 'Efficiency factor', symbol: 'η', unit: '—', step: 0.05, min: 0.01 },
  Est: { label: 'Reinforcement modulus', symbol: 'Es', unit: 'N/mm²', step: 1000 },
  fyk: { label: 'Reinforcement yield strength', symbol: 'fyk', unit: 'N/mm²', step: 5 },
  gammaK: { label: 'Partial factor, reinforcement', symbol: 'γs', unit: '—', step: 0.05, min: 0.1 },

  Ky: { label: 'Effective length factor, y', symbol: 'Ky', unit: '—', step: 0.05, min: 0.05 },
  Kz: { label: 'Effective length factor, z', symbol: 'Kz', unit: '—', step: 0.05, min: 0.05 },
  alphaImpZ: { label: 'Imperfection factor, curve b (z)', symbol: 'αz', unit: '—', step: 0.01, min: 0.01 },
  alphaImpY: { label: 'Imperfection factor, curve c (y)', symbol: 'αy', unit: '—', step: 0.01, min: 0.01 },
  psi: { label: 'Moment ratio of the first-order diagram', symbol: 'ψ = M1/M2', unit: '—', step: 0.1, min: -1 },
}
