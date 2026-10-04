import type { Inputs, Results } from '../lib/types'
import { fmt } from '../lib/format'
import { compareToReference } from '../lib/reference'
import { CrossSection } from './CrossSection'
import { MemberDiagram } from './MemberDiagram'
import { InteractionChart } from './InteractionChart'
import { Badge } from './ui'

export interface ReportMeta {
  project: string
  element: string
  engineer: string
  reference: string
}

export const DEFAULT_META: ReportMeta = {
  project: 'IS 11384:2022 — concrete-encased composite column',
  element: 'CECC-01 · mid-height section',
  engineer: '',
  reference: 'CSI Software Verification, IS 11384:2022 CCD Example 001',
}

export function ReportView({
  inputs,
  results,
  meta,
}: {
  inputs: Inputs
  results: Results
  meta: ReportMeta
}) {
  const rows = compareToReference(results)
  const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <article className="mx-auto max-w-[880px] space-y-6 rounded-xl border border-ink-200 bg-white p-8 text-[12px] leading-relaxed text-ink-800 shadow-sm print:max-w-none print:border-0 print:p-0 print:shadow-none dark:border-ink-800 dark:bg-ink-900 dark:text-ink-100">
      <header className="print-page border-b border-ink-300 pb-4 dark:border-ink-700">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Design calculation report</h1>
            <p className="mt-1 text-ink-600 dark:text-ink-300">
              Concrete-encased rectangular composite column — compression, moment, shear and demand/capacity
              verification
            </p>
          </div>
          <Badge status={results.dc.total <= 1 ? 'ok' : 'fail'}>
            {results.dc.total <= 1 ? 'Section adequate' : 'Section NOT adequate'}
          </Badge>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
          <Meta label="Project" value={meta.project} />
          <Meta label="Element" value={meta.element} />
          <Meta label="Designer" value={meta.engineer || '—'} />
          <Meta label="Date" value={date} />
          <Meta label="Code" value="IS 11384:2022" />
          <Meta label="Method" value="Simplified interaction-curve method" />
          <Meta label="Reference" value={meta.reference} />
          <Meta label="Units" value="kN, kN-m, mm, N/mm²" />
        </dl>
      </header>

      <Section title="1. Input data">
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4 print:grid-cols-4">
          <Table
            caption="Loading"
            rows={[
              ['PD', fmt(inputs.PD, 0), 'kN'],
              ['PL', fmt(inputs.PL, 0), 'kN'],
              ['Mz', fmt(inputs.Mz, 0), 'kN-m'],
              ['My', fmt(inputs.My, 0), 'kN-m'],
            ]}
          />
          <Table
            caption={`Concrete section — ${
              inputs.sectionType === 'rect-slab'
                ? 'encasement + slab'
                : inputs.sectionType === 'circular'
                  ? 'circular encasement'
                  : 'rectangular encasement'
            }`}
            rows={[
              ...(inputs.sectionType === 'circular'
                ? ([
                    ['D', fmt(inputs.diameter, 0), 'mm'],
                    ['R', fmt(inputs.diameter / 2, 0), 'mm'],
                  ] as [string, string, string][])
                : ([
                    ['bc', fmt(inputs.bc, 0), 'mm'],
                    ['hc', fmt(inputs.hc, 0), 'mm'],
                  ] as [string, string, string][])),
              ['cover', fmt(inputs.cover, 0), 'mm'],
              ...(inputs.sectionType === 'rect-slab'
                ? ([
                    ['bs', fmt(inputs.slabWidth, 0), 'mm'],
                    ['ts', fmt(inputs.slabThickness, 0), 'mm'],
                  ] as [string, string, string][])
                : []),
            ]}
          />
          <Table
            caption="Steel I-section"
            rows={[
              ['h', fmt(inputs.h, 0), 'mm'],
              ['bf', fmt(inputs.bf, 0), 'mm'],
              ['tw', fmt(inputs.tw, 1), 'mm'],
              ['tf', fmt(inputs.tf, 1), 'mm'],
              ['r', fmt(inputs.r, 1), 'mm'],
            ]}
          />
          <Table
            caption="Member"
            rows={[
              ['Ly', fmt(inputs.Ly, 0), 'mm'],
              ['Lz', fmt(inputs.Lz, 0), 'mm'],
              ['Ky', fmt(inputs.Ky, 2), '—'],
              ['Kz', fmt(inputs.Kz, 2), '—'],
              ['ψ = M1/M2', fmt(inputs.psi, 2), '—'],
            ]}
          />
          <Table
            caption="Materials"
            rows={[
              ['concrete', inputs.concreteGrade, ''],
              ['fck', fmt(inputs.fck, 0), 'N/mm²'],
              ['γc', fmt(inputs.gammaC, 2), '—'],
              ['Ecm', fmt(inputs.Ecm, 0), 'N/mm²'],
              ['reinforcement', inputs.rebarGrade, ''],
              ['fyk', fmt(inputs.fyk, 0), 'N/mm²'],
              ['Es', fmt(inputs.Est, 0), 'N/mm²'],
              ['γs', fmt(inputs.gammaK, 2), '—'],
              ['steel', inputs.steelGrade, ''],
              ['fy', fmt(inputs.fy, 0), 'N/mm²'],
              ['fu', fmt(inputs.fu, 0), 'N/mm²'],
              ['E', fmt(inputs.Es, 0), 'N/mm²'],
              ['γm0', fmt(inputs.gammaM0, 2), '—'],
            ]}
          />
        </div>

        <div className="mt-4">
          <Table
            caption="Reinforcement position table (mm from the concrete centroid)"
            rows={
              inputs.bars.length
                ? inputs.bars.map((row, i) => [
                    row.label || `B${i + 1}`,
                    `${row.count} × ⌀${fmt(row.db, 0)} mm ` +
                      (row.spread === 'corner'
                        ? `at (±${fmt(row.x, 0)}, ±${fmt(row.y, 0)})`
                        : row.spread === 'ring'
                          ? `on a ring of ⌀${fmt(2 * Math.abs(row.x), 0)} mm from ${fmt(row.y, 0)}°`
                          : `at (${fmt(row.x, 0)}, ${fmt(row.y, 0)})`) +
                      `${row.layer ? ` · layer ${row.layer}` : ''}${row.cover ? ` · cover ${fmt(row.cover, 0)} mm` : ''}`,
                    '',
                  ] as [string, string, string])
                : [['—', 'no reinforcement rows', ''] as [string, string, string]]
            }
          />
        </div>
      </Section>

      <Section title="2. Section and member">
        <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
          <figure className="print-page">
            <CrossSection inputs={inputs} className="mx-auto h-[280px] w-full" />
            <figcaption className="mt-1 text-center text-[11px] text-ink-500">
              Figure 1 — cross-section (dimensions in mm)
            </figcaption>
          </figure>
          <figure className="print-page">
            <MemberDiagram inputs={inputs} results={results} className="mx-auto h-[280px] w-full" />
            <figcaption className="mt-1 text-center text-[11px] text-ink-500">
              Figure 2 — simply supported member and applied actions
            </figcaption>
          </figure>
        </div>
      </Section>

      <Section title="3. Summary of results" className="print-page">
        <table className="w-full border-collapse text-[11.5px]">
          <thead>
            <tr className="border-b border-ink-300 text-left dark:border-ink-700">
              <th className="py-1.5 pr-2 font-semibold">Quantity</th>
              <th className="py-1.5 pr-2 text-right font-semibold">This app</th>
              <th className="py-1.5 pr-2 text-right font-semibold">Report</th>
              <th className="py-1.5 pr-2 text-right font-semibold">Workbook</th>
              <th className="py-1.5 pr-2 text-right font-semibold">Δ</th>
              <th className="py-1.5 text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-ink-100 dark:border-ink-800/70">
                <td className="py-1 pr-2 font-mono">
                  {r.label} {r.unit !== '—' ? `(${r.unit})` : ''}
                </td>
                <td className="py-1 pr-2 text-right font-medium">{fmt(r.value, r.decimals)}</td>
                <td className="py-1 pr-2 text-right">{fmt(r.reference, r.decimals)}</td>
                <td className="py-1 pr-2 text-right">{fmt(r.workbook, r.decimals)}</td>
                <td className="py-1 pr-2 text-right">{fmt(r.delta, r.decimals)}</td>
                <td className="py-1 text-right">{r.pass ? 'ok' : 'check'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 sm:grid-cols-4 print:grid-cols-4">
          <Meta label="Pd" value={`${fmt(results.member.Pd, 1)} kN`} />
          <Meta label="χz / χy" value={`${fmt(results.global.chiZ, 3)} / ${fmt(results.global.chiY, 3)}`} />
          <Meta label="Md,z / Md,y" value={`${fmt(results.axes.z.Md, 1)} / ${fmt(results.axes.y.Md, 1)} kN-m`} />
          <Meta label="D/C ratio" value={`${fmt(results.dc.total, 3)} ${results.dc.total <= 1 ? '≤ 1.0' : '> 1.0'}`} />
        </div>
      </Section>

      <Section title="4. Interaction diagrams" className="print-page">
        <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
          <figure>
            <InteractionChart results={results} axis="z" className="h-[320px] w-full" />
            <figcaption className="mt-1 text-center text-[11px] text-ink-500">
              Figure 3 — interaction about the z-axis (major axis)
            </figcaption>
          </figure>
          <figure>
            <InteractionChart results={results} axis="y" showOther className="h-[320px] w-full" />
            <figcaption className="mt-1 text-center text-[11px] text-ink-500">
              Figure 4 — interaction about the y-axis (minor axis, with the z-axis curve for comparison)
            </figcaption>
          </figure>
        </div>
      </Section>

      <Section title="5. Detailed calculations" className="print-break">
        <div className="space-y-5">
          {results.groups.map((group) => (
            <div key={group.id}>
              <h3 className="text-[13px] font-semibold text-ink-900 dark:text-ink-50">{group.title}</h3>
              {group.subtitle && <p className="mt-0.5 text-[11px] text-ink-500">{group.subtitle}</p>}
              <table className="mt-2 w-full border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-ink-300 text-left dark:border-ink-700">
                    <th className="py-1 pr-2 font-semibold">Symbol</th>
                    <th className="py-1 pr-2 font-semibold">Expression</th>
                    <th className="py-1 pr-2 text-right font-semibold">Value</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {group.steps.map((step) => (
                    <tr key={step.id} className="border-b border-ink-100 align-top dark:border-ink-800/70">
                      <td className="w-[130px] py-1 pr-2 font-mono">{step.symbol}</td>
                      <td className="py-1 pr-2">
                        <div className="font-mono text-[10.5px]">{step.formula}</div>
                        <div className="font-mono text-[10.5px] text-ink-500">{step.substitution}</div>
                        {step.note && <div className="mt-0.5 text-[10.5px] text-ink-600 dark:text-ink-300">{step.note}</div>}
                      </td>
                      <td className="py-1 pr-2 text-right font-medium whitespace-nowrap">
                        {fmt(step.value, step.decimals)}
                        {step.unit !== '—' ? ` ${step.unit}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {group.notes?.length ? (
                <ul className="mt-1.5 space-y-0.5 text-[10.5px] text-ink-600 dark:text-ink-300">
                  {group.notes.map((note, i) => (
                    <li key={i}>• {note}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </Section>

      <Section title="6. Basis, assumptions and remarks" className="print-page">
        <ul className="space-y-1.5">
          <li>
            <strong>Code.</strong> IS 11384:2022 — design of composite columns; simplified interaction-curve
            method for concrete-encased sections.
          </li>
          <li>
            <strong>Section equilibrium.</strong> The neutral-axis depth hn is obtained from the equilibrium of
            the plastic stress blocks (0.8 αc fck / γc for concrete, fy / γm0 for structural steel, fyk / γk for
            the reinforcement) and is rounded up to {fmt(0.5, 1)} mm (z-axis) and {fmt(0.1, 1)} mm (y-axis)
            exactly as in the reference workbook.
          </li>
          <li>
            <strong>Buckling.</strong> Relative slenderness λ from the nominal axial strength Pn and the elastic
            critical force based on the effective stiffness (0.6 Ecm for the concrete); reduction factors χ from
            buckling curves b (z) and c (y).
          </li>
          <li>
            <strong>Second-order effects.</strong> Amplified moments with k = Cmm / (1 − P/Pcr) but never less
            than 1.0, as adopted in the reference.
          </li>
          <li>
            <strong>Shear.</strong> Plastic shear resistance of the embedded steel section alone (Av fy / √3);
            both utilisations stay below 0.6, so shear does not reduce the moment and axial resistances.
          </li>
          <li>
            <strong>Known asymmetry of the reference.</strong> The published equations for buckling about the
            y-axis omit the αc factor present in the z-axis equations. The published form is reproduced here so
            that the y-axis results match the benchmark (see the validation panel).
          </li>
          <li>
            <strong>Scope.</strong> The calculation covers the section at mid-height of a simply supported
            member with pinned ends. Fire, durability, detailing rules, fatigue and second-order global analysis
            are outside the scope of this document.
          </li>
        </ul>
        <p className="mt-3 text-[10.5px] text-ink-500">
          Generated with the IS 11384 composite-column web application. The independent results quoted in the
          comparison table are taken from {meta.reference}.
        </p>
      </Section>
    </article>
  )
}

function Section({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={className}>
      <h2 className="mb-2 border-b border-ink-200 pb-1 text-[13px] font-semibold tracking-wide dark:border-ink-800">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] tracking-wide text-ink-500 uppercase">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

function Table({
  caption,
  rows,
}: {
  caption: string
  rows: [string, string, string][]
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold tracking-wide text-ink-500 uppercase">{caption}</div>
      <table className="w-full border-collapse text-[11.5px]">
        <tbody>
          {rows.map(([symbol, value, unit]) => (
            <tr key={symbol} className="border-b border-ink-100 last:border-0 dark:border-ink-800/60">
              <td className="py-0.5 pr-2 font-mono">{symbol}</td>
              <td className="tabular py-0.5 pr-1 text-right">{value}</td>
              <td className="py-0.5 text-ink-500">{unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
