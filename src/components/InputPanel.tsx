import type { Inputs, Results } from '../lib/types'
import { PRESETS, type Preset } from '../lib/calc/defaults'
import { NumberField, NullableNumberField } from './NumberField'
import { Fieldset } from './ui'

interface Props {
  inputs: Inputs
  results: Results
  setInput: <K extends keyof Inputs>(key: K, value: Inputs[K]) => void
  onPreset: (preset: Preset) => void
  onReset: () => void
  activePresetId: string | null
}

export function InputPanel({ inputs, results, setInput, onPreset, onReset, activePresetId }: Props) {
  const num = (key: keyof Inputs, opts: Partial<Parameters<typeof NumberField>[0]> = {}) => (
    <NumberField
      key={key}
      label={LABELS[key]?.label ?? String(key)}
      symbol={LABELS[key]?.symbol}
      unit={LABELS[key]?.unit}
      step={LABELS[key]?.step ?? 1}
      min={LABELS[key]?.min ?? 0}
      hint={LABELS[key]?.hint}
      value={inputs[key] as number}
      onChange={(v) => setInput(key, v as never)}
      {...opts}
    />
  )

  return (
    <div className="divide-y divide-ink-200/70 dark:divide-ink-800">
      <Fieldset title="Presets" hint="Start from the reference example or a variation of it.">
        <div className="col-span-full space-y-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onPreset(preset)}
              className={
                'w-full rounded-lg border px-3 py-2 text-left transition-colors ' +
                (activePresetId === preset.id
                  ? 'border-brand-500 bg-brand-50 dark:border-brand-500 dark:bg-brand-500/10'
                  : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50 dark:border-ink-700 dark:hover:border-ink-600 dark:hover:bg-ink-800/60')
              }
            >
              <div className="text-[13px] font-medium text-ink-900 dark:text-ink-50">{preset.name}</div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">{preset.description}</div>
            </button>
          ))}
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] font-medium text-brand-700 hover:underline dark:text-brand-300"
          >
            Reset to the reference example
          </button>
        </div>
      </Fieldset>

      <Fieldset title="Loadings" hint="Characteristic actions on the member; the design values at mid-height are half of the end moments.">
        {num('PD')}
        {num('PL')}
        {num('Mz')}
        {num('My')}
      </Fieldset>

      <Fieldset title="Cross-section" hint="Dimensions of the concrete encasement, the embedded I-section and the longitudinal reinforcement (mm).">
        {num('bc')}
        {num('hc')}
        {num('h')}
        {num('bf')}
        {num('tf')}
        {num('tw')}
        {num('db')}
        {num('n', { step: 1 })}
        {num('e')}
      </Fieldset>

      <Fieldset title="Materials" defaultOpen={false} hint="Characteristic strengths and partial safety factors.">
        {num('fy')}
        {num('Es')}
        {num('gammaM0')}
        {num('fck')}
        {num('Ecm')}
        {num('gammaC')}
        {num('fyk')}
        {num('Est')}
        {num('gammaK')}
        {num('alphaC')}
        {num('alphaCC')}
        {num('eta')}
      </Fieldset>

      <Fieldset
        title="Member & buckling"
        defaultOpen={false}
        hint="Effective length factors, buckling curves and the shape of the first-order moment diagram."
      >
        {num('Ky')}
        {num('Kz')}
        {num('Ly')}
        {num('Lz')}
        {num('alphaImpZ')}
        {num('alphaImpY')}
        {num('psi', { min: -1, max: 1, step: 0.1 })}
      </Fieldset>

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
        <div className="col-span-full rounded-lg bg-ink-50 px-3 py-2 text-[11px] leading-relaxed text-ink-500 dark:bg-ink-900/50 dark:text-ink-400">
          Reference values: hn,z = 78.5 mm (report: 78.6 mm) and hn,y = 95.2 mm (report: 94.4 mm). The
          influence of the rounding on the D/C ratio is small and is reported in the validation panel.
        </div>
      </Fieldset>
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
  h: { label: 'I-section depth', symbol: 'h', unit: 'mm', step: 5 },
  bf: { label: 'I-section flange width', symbol: 'bf', unit: 'mm', step: 5 },
  tf: { label: 'Flange thickness', symbol: 'tf', unit: 'mm', step: 0.1 },
  tw: { label: 'Web thickness', symbol: 'tw', unit: 'mm', step: 0.1 },
  db: { label: 'Bar diameter', symbol: 'db', unit: 'mm', step: 1 },
  n: { label: 'Number of bars', symbol: 'n', unit: 'nos.', step: 1 },
  e: { label: 'Bar eccentricity from centroid', symbol: 'e', unit: 'mm', step: 1 },

  Es: { label: 'Steel modulus', symbol: 'Es', unit: 'N/mm²', step: 1000 },
  fy: { label: 'Steel yield strength', symbol: 'fy', unit: 'N/mm²', step: 5 },
  gammaM0: { label: 'Partial factor, steel', symbol: 'γm0', unit: '—', step: 0.05, min: 0.1 },
  Ecm: { label: 'Concrete modulus', symbol: 'Ecm', unit: 'N/mm²', step: 100 },
  fck: { label: 'Concrete strength', symbol: 'fck', unit: 'N/mm²', step: 1 },
  gammaC: { label: 'Partial factor, concrete', symbol: 'γc', unit: '—', step: 0.05, min: 0.1 },
  alphaC: { label: 'Stress-block coefficient', symbol: 'αc', unit: '—', step: 0.05, min: 0.01 },
  alphaCC: { label: 'Design strength coefficient', symbol: 'αcc', unit: '—', step: 0.05, min: 0.01 },
  eta: { label: 'Efficiency factor', symbol: 'η', unit: '—', step: 0.05, min: 0.01 },
  Est: { label: 'Reinforcement modulus', symbol: 'Est', unit: 'N/mm²', step: 1000 },
  fyk: { label: 'Reinforcement yield strength', symbol: 'fyk', unit: 'N/mm²', step: 5 },
  gammaK: { label: 'Partial factor, reinforcement', symbol: 'γk', unit: '—', step: 0.05, min: 0.1 },

  Ky: { label: 'Effective length factor, y', symbol: 'Ky', unit: '—', step: 0.05, min: 0.05 },
  Kz: { label: 'Effective length factor, z', symbol: 'Kz', unit: '—', step: 0.05, min: 0.05 },
  Ly: { label: 'Unbraced length about y', symbol: 'Ly', unit: 'mm', step: 250 },
  Lz: { label: 'Unbraced length about z', symbol: 'Lz', unit: 'mm', step: 250 },
  alphaImpZ: { label: 'Imperfection factor, curve b (z)', symbol: 'αz', unit: '—', step: 0.01, min: 0.01 },
  alphaImpY: { label: 'Imperfection factor, curve c (y)', symbol: 'αy', unit: '—', step: 0.01, min: 0.01 },
  psi: { label: 'Moment ratio of the first-order diagram', symbol: 'ψ = M1/M2', unit: '—', step: 0.1, min: -1 },
}
