import type { Step, StepGroup } from '../lib/types'
import { fmt } from '../lib/format'
import { Badge, Card, StatusDot, cx } from './ui'

export function StepsView({ groups }: { groups: StepGroup[] }) {
  const shown = groups.filter((g) => g.steps.length > 0)

  return (
    <div className="space-y-4">
      {shown.map((group) => (
        <Card key={group.id} title={group.title} subtitle={group.subtitle} actions={<span className="font-mono text-[10px] text-ink-400">{group.source}</span>} dense>
          <ul className="divide-y divide-ink-200/70 dark:divide-ink-800">
            {group.steps.map((step) => (
              <StepRow key={step.id} step={step} />
            ))}
          </ul>
          {group.notes && group.notes.length > 0 && (
            <ul className="space-y-1 border-t border-ink-200/70 bg-ink-50/60 px-4 py-3 text-xs text-ink-600 dark:border-ink-800 dark:bg-ink-900/40 dark:text-ink-300">
              {group.notes.map((note, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-ink-400">•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
    </div>
  )
}

export function StepRow({ step }: { step: Step }) {
  const status = step.check === false ? undefined : step.status
  return (
    <li className="grid grid-cols-1 gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 gap-2">
        {status && <StatusDot status={status} />}
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-mono text-[13px] font-semibold text-ink-900 dark:text-ink-50">{step.symbol}</span>
            <span className="text-[13px] text-ink-600 dark:text-ink-300">{step.label}</span>
            {status && (
              <Badge status={status} className="translate-y-px">
                {status === 'ok' ? 'OK' : status === 'fail' ? 'Not satisfied' : status === 'warn' ? 'Check' : 'Info'}
              </Badge>
            )}
          </div>
          <div className="mt-1 space-y-0.5 font-mono text-[11.5px] leading-relaxed break-words text-ink-500 dark:text-ink-400">
            <div>{step.formula}</div>
            <div className="text-ink-400 dark:text-ink-500">{step.substitution}</div>
          </div>
          {step.note && (
            <p
              className={cx(
                'mt-1.5 text-xs',
                status === 'fail'
                  ? 'text-rose-600 dark:text-rose-400'
                  : status === 'warn'
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-ink-500 dark:text-ink-400',
              )}
            >
              {step.note}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-baseline gap-1 sm:justify-end sm:pl-2 sm:text-right">
        <span className="tabular text-[15px] font-semibold text-ink-900 dark:text-ink-50">
          {fmt(step.value, step.decimals)}
        </span>
        {step.unit && step.unit !== '—' && <span className="text-xs text-ink-500 dark:text-ink-400">{step.unit}</span>}
      </div>
    </li>
  )
}
