import type { Results } from '../lib/types'
import type { InputProblem } from '../lib/calc/defaults'
import { compareToReference } from '../lib/reference'
import { fmt, fmtPercent } from '../lib/format'
import { Badge, Card, cx } from './ui'

export function ValidationPanel({
  results,
  problems,
}: {
  results: Results
  problems: InputProblem[]
}) {
  const rows = compareToReference(results)
  const failures = rows.filter((r) => !r.pass)
  const errors = problems.filter((p) => p.level === 'error')
  const warnings = problems.filter((p) => p.level === 'warn')
  const checks = results.groups.flatMap((g) => g.steps).filter((s) => s.check !== false && s.status && s.status !== 'ok')

  return (
    <div className="space-y-4">
      <Card
        title="Comparison with the published benchmark"
        subtitle="Independent hand-calculation results of the CSI verification report (ETABS, IS 11384:2022 CCD Example 001) and of the accompanying workbook."
        actions={
          <Badge status={failures.length === 0 ? 'ok' : 'fail'}>
            {failures.length === 0 ? 'All reference checks pass' : `${failures.length} outside tolerance`}
          </Badge>
        }
        dense
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left text-[11px] tracking-wide text-ink-500 uppercase dark:border-ink-800 dark:text-ink-400">
                <th className="px-4 py-2 font-medium">Quantity</th>
                <th className="px-3 py-2 text-right font-medium">This app</th>
                <th className="px-3 py-2 text-right font-medium">Report</th>
                <th className="px-3 py-2 text-right font-medium">Workbook</th>
                <th className="px-3 py-2 text-right font-medium">Δ</th>
                <th className="px-3 py-2 text-right font-medium">Δ rel.</th>
                <th className="px-4 py-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-ink-100 last:border-0 dark:border-ink-800/70">
                  <td className="px-4 py-2 text-left">
                    <span className="font-mono text-[13px] text-ink-900 dark:text-ink-50">{r.label}</span>
                    {r.unit !== '—' && <span className="ml-1 text-xs text-ink-400">{r.unit}</span>}
                    {r.note && (
                      <details className="mt-0.5">
                        <summary className="cursor-pointer text-[11px] text-ink-400 hover:text-ink-600 dark:hover:text-ink-300">
                          remark
                        </summary>
                        <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">{r.note}</p>
                      </details>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-ink-900 dark:text-ink-50">
                    {fmt(r.value, r.decimals)}
                  </td>
                  <td className="px-3 py-2 text-right text-ink-600 dark:text-ink-300">{fmt(r.reference, r.decimals)}</td>
                  <td className="px-3 py-2 text-right text-ink-500 dark:text-ink-400">{fmt(r.workbook, r.decimals)}</td>
                  <td className="px-3 py-2 text-right text-ink-500 dark:text-ink-400">{fmt(r.delta, r.decimals)}</td>
                  <td className="px-3 py-2 text-right text-ink-500 dark:text-ink-400">{fmtPercent(r.deltaPercent / 100, 2)}</td>
                  <td className="px-4 py-2 text-right">
                    <Badge status={r.pass ? 'ok' : 'fail'}>{r.pass ? 'Pass' : 'Deviation'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-ink-200/70 px-4 py-3 text-xs text-ink-500 dark:border-ink-800 dark:text-ink-400">
          {failures.length === 0
            ? 'The results show an excellent match with the independent results of the benchmark.'
            : 'Some quantities deviate from the benchmark beyond the stated tolerances — review the remarks above.'}
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Input validation" subtitle="Geometry and material sanity checks on the current input set." dense>
          {problems.length === 0 ? (
            <p className="px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
              No input problems detected.
            </p>
          ) : (
            <ul className="divide-y divide-ink-200/70 dark:divide-ink-800">
              {[...errors, ...warnings].map((p, i) => (
                <li key={i} className="flex items-start gap-2 px-4 py-2.5 text-sm">
                  <Badge status={p.level === 'error' ? 'fail' : 'warn'}>{p.level === 'error' ? 'Error' : 'Warning'}</Badge>
                  <span className="text-ink-600 dark:text-ink-300">{p.message}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-ink-200/70 px-4 py-3 dark:border-ink-800">
            <div className="text-xs text-ink-500 dark:text-ink-400">Applicability of the simplified method</div>
            <p
              className={cx(
                'mt-1 text-sm',
                results.member.applicability.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
              )}
            >
              {results.member.applicability.ok
                ? 'Satisfied: 0.2 < δ < 0.9, λz < 2.0 and λy < 2.0.'
                : results.member.applicability.reasons.join('; ')}
            </p>
          </div>
        </Card>

        <Card title="Governing checks" subtitle="Design checks that are not satisfied or that require attention." dense>
          {checks.length === 0 ? (
            <p className="px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
              All design checks are satisfied.
            </p>
          ) : (
            <ul className="divide-y divide-ink-200/70 dark:divide-ink-800">
              {checks.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <div>
                    <div className="font-mono text-[13px] text-ink-900 dark:text-ink-50">{s.symbol}</div>
                    <div className="text-xs text-ink-500 dark:text-ink-400">{s.label}</div>
                    {s.note && <div className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{s.note}</div>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="tabular text-sm font-semibold text-ink-900 dark:text-ink-50">
                      {fmt(s.value, s.decimals)}
                    </span>
                    <Badge status={s.status === 'fail' ? 'fail' : 'warn'}>{s.status === 'fail' ? 'Not satisfied' : 'Check'}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
