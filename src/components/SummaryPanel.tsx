import type { Inputs, Results } from '../lib/types'
import { fmt } from '../lib/format'
import { compareToReference } from '../lib/reference'
import { CrossSection } from './CrossSection'
import { MemberDiagram } from './MemberDiagram'
import { InteractionChart } from './InteractionChart'
import { Badge, Card, KeyValue, Stat, cx } from './ui'

export function SummaryPanel({ inputs, results }: { inputs: Inputs; results: Results }) {
  const rows = compareToReference(results)
  const dc = results.dc.total

  const utilisation = [
    { label: 'P / (χz Pd)  — axial, major axis', value: results.axes.z.utilisation, limit: 1 },
    { label: 'P / (χy Pd)  — axial, minor axis', value: results.axes.y.utilisation, limit: 1 },
    { label: 'Vy / Vd,y  — shear', value: results.axes.y.vRatio, limit: 0.6, note: 'limit 0.6' },
    { label: 'Vz / Vd,z  — shear', value: results.axes.z.vRatio, limit: 0.6, note: 'limit 0.6' },
    { label: 'My / (μdd,y Md,y)  — minor-axis D/C', value: results.dc.ratioY, limit: results.dc.alphaMmY },
    { label: 'Mz / (μdd,z Md,z)  — major-axis D/C', value: results.dc.ratioZ, limit: results.dc.alphaMmZ },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <div
          className={cx(
            'rounded-lg border px-3 py-2.5',
            dc <= 1
              ? 'border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10'
              : 'border-rose-500/30 bg-rose-50 dark:bg-rose-500/10',
          )}
        >
          <div className="text-[11px] font-medium tracking-wide text-ink-500 uppercase dark:text-ink-400">
            Demand / capacity
          </div>
          <div className={cx('tabular mt-1 text-2xl leading-none font-semibold', dc <= 1 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300')}>
            {fmt(dc, 3)}
          </div>
          <div className="mt-1 text-[11px] text-ink-500 dark:text-ink-400">
            {dc <= 1 ? '≤ 1.0 — section adequate' : '> 1.0 — section not adequate'}
          </div>
        </div>
        <Stat label="Pd — axial resistance" value={results.member.Pd} unit="kN" decimals={0} />
        <Stat label="χz / χy" value={results.global.chiZ} decimals={3} hint={`χy = ${fmt(results.global.chiY, 3)}`} />
        <Stat label="Md,z — moment resistance" value={results.axes.z.Md} unit="kN-m" decimals={1} />
        <Stat label="Md,y — moment resistance" value={results.axes.y.Md} unit="kN-m" decimals={1} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card
          title="Verification summary"
          subtitle="Capacities, utilisations and the comparison with the independent results of the benchmark."
          actions={<Badge status={rows.every((r) => r.pass) ? 'ok' : 'warn'}>{rows.every((r) => r.pass) ? 'Benchmark match' : 'See validation'}</Badge>}
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-1 text-[11px] font-semibold tracking-wider text-ink-500 uppercase dark:text-ink-400">
                Utilisation ratios
              </h3>
              {utilisation.map((u) => (
                <UtilRow key={u.label} {...u} />
              ))}
            </div>
            <div>
              <h3 className="mb-1 text-[11px] font-semibold tracking-wider text-ink-500 uppercase dark:text-ink-400">
                Key results
              </h3>
              <KeyValue label="Axial force at mid-height P" value={results.required.P} unit="kN" decimals={0} />
              <KeyValue label="Mz at mid-height" value={results.required.MzMid} unit="kN-m" decimals={1} />
              <KeyValue label="My at mid-height" value={results.required.MyMid} unit="kN-m" decimals={1} />
              <KeyValue label="Mz (second order)" value={results.axes.z.M2nd} unit="kN-m" decimals={1} />
              <KeyValue label="My (second order)" value={results.axes.y.M2nd} unit="kN-m" decimals={1} />
              <KeyValue label="P′d,C,z — point C, major axis" value={results.axes.z.PdC} unit="kN" decimals={1} />
              <KeyValue label="P′d,C,y — point C, minor axis" value={results.axes.y.PdC} unit="kN" decimals={1} />
              <KeyValue label="Mmax,z — point D, major axis" value={results.axes.z.Mmax} unit="kN-m" decimals={1} />
              <KeyValue label="Mmax,y — point D, minor axis" value={results.axes.y.Mmax} unit="kN-m" decimals={1} />
              <KeyValue label="Vd,y / Vd,z" value={results.axes.y.Vd} unit={`kN / ${fmt(results.axes.z.Vd, 0)} kN`} decimals={0} />
              <KeyValue label="λz / λy" value={results.member.lambdaZ} decimals={3} hint={`λy = ${fmt(results.member.lambdaY, 3)}`} />
              <KeyValue label="δ = As fy /(Pd γm0)" value={results.member.delta} decimals={3} />
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Cross-section" subtitle="Concrete encasement, embedded I-section and reinforcement.">
            <CrossSection inputs={inputs} className="mx-auto h-[300px] w-full" />
          </Card>
          <Card title="Member" subtitle="Simply supported with pinned ends.">
            <MemberDiagram inputs={inputs} results={results} className="mx-auto h-[240px] w-full" />
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card
          title="Interaction about the z-axis (major axis)"
          subtitle="Design point versus the simplified interaction curve."
        >
          <InteractionChart results={results} axis="z" className="mx-auto h-[380px] w-full" />
        </Card>
        <Card
          title="Interaction about the y-axis (minor axis)"
          subtitle="The z-axis curve is drawn in grey for comparison."
        >
          <InteractionChart results={results} axis="y" showOther className="mx-auto h-[380px] w-full" />
        </Card>
      </div>
    </div>
  )
}

function UtilRow({
  label,
  value,
  limit,
  note,
}: {
  label: string
  value: number
  limit: number
  note?: string
}) {
  const ratio = value / limit
  const tone = ratio > 1 ? 'rose' : ratio > 0.85 ? 'amber' : 'emerald'
  const bar = {
    rose: 'bg-rose-500',
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
  }[tone]

  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-ink-600 dark:text-ink-300">{label}</span>
        <span className="tabular text-xs font-medium text-ink-900 dark:text-ink-50">
          {fmt(value, 3)}
          {note ? <span className="ml-1 text-[10px] font-normal text-ink-400">{note}</span> : null}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-800">
        <div className={cx('h-full rounded-full transition-all', bar)} style={{ width: `${Math.min(100, Math.max(2, ratio * 100))}%` }} />
      </div>
    </div>
  )
}
