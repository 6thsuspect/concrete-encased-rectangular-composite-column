import type { ReactNode } from 'react'
import { fmt } from '../lib/format'
import type { StepStatus } from '../lib/types'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

/* ------------------------------------------------------------------ */
/* layout                                                              */
/* ------------------------------------------------------------------ */

export function Card({
  children,
  className,
  title,
  subtitle,
  actions,
  dense,
}: {
  children: ReactNode
  className?: string
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  dense?: boolean
}) {
  return (
    <section
      className={cx(
        'rounded-xl border border-ink-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]',
        'dark:border-ink-800 dark:bg-ink-900/60',
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-ink-200/70 px-4 py-3 dark:border-ink-800">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-ink-900 dark:text-ink-50">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={dense ? '' : 'p-4'}>{children}</div>
    </section>
  )
}

export function Fieldset({
  title,
  children,
  defaultOpen = true,
  hint,
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  hint?: string
}) {
  return (
    <details open={defaultOpen} className="group border-b border-ink-200/70 last:border-0 dark:border-ink-800">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-2.5 text-[11px] font-semibold tracking-wider text-ink-600 uppercase select-none hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-800/50">
        <span>{title}</span>
        <span className="text-ink-400 transition-transform group-open:rotate-90 dark:text-ink-500">›</span>
      </summary>
      <div className="px-4 pt-1 pb-4">
        {hint && <p className="mb-3 text-xs leading-relaxed text-ink-500 dark:text-ink-400">{hint}</p>}
        <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-2">{children}</div>
      </div>
    </details>
  )
}

/* ------------------------------------------------------------------ */
/* atoms                                                               */
/* ------------------------------------------------------------------ */

const statusStyles: Record<StepStatus, string> = {
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
  warn: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
  fail: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20',
  info: 'bg-ink-100 text-ink-600 ring-ink-500/15 dark:bg-ink-800 dark:text-ink-300 dark:ring-ink-600/30',
}

const statusDot: Record<StepStatus, string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  fail: 'bg-rose-500',
  info: 'bg-ink-400',
}

export function Badge({
  children,
  status = 'info',
  className,
}: {
  children: ReactNode
  status?: StepStatus
  className?: string
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        statusStyles[status],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function StatusDot({ status, label }: { status: StepStatus; label?: string }) {
  return (
    <span
      className={cx('mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full', statusDot[status])}
      title={label ?? status}
      aria-label={label ?? status}
    />
  )
}

export function Button({
  children,
  onClick,
  variant = 'default',
  size = 'md',
  disabled,
  title,
  className,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'default' | 'primary' | 'ghost' | 'subtle'
  size?: 'sm' | 'md'
  disabled?: boolean
  title?: string
  className?: string
  type?: 'button' | 'submit'
}) {
  const variants = {
    primary:
      'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300 dark:bg-brand-500 dark:hover:bg-brand-400 dark:disabled:bg-brand-900',
    default:
      'bg-white text-ink-700 ring-1 ring-ink-300 hover:bg-ink-50 disabled:text-ink-400 dark:bg-ink-800 dark:text-ink-100 dark:ring-ink-700 dark:hover:bg-ink-700',
    subtle:
      'bg-ink-100 text-ink-700 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700',
    ghost: 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800',
  }[variant]
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors',
        'focus:ring-2 focus:ring-brand-500/40 focus:outline-none disabled:cursor-not-allowed',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
        variants,
        className,
      )}
    >
      {children}
    </button>
  )
}

export function KeyValue({
  label,
  value,
  unit,
  decimals = 2,
  status,
  hint,
}: {
  label: ReactNode
  value: number
  unit?: string
  decimals?: number
  status?: StepStatus
  hint?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-ink-200/70 py-1.5 last:border-0 dark:border-ink-800">
      <span className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
        {status && <StatusDot status={status} />}
        {label}
      </span>
      <span className="tabular text-sm font-medium text-ink-900 dark:text-ink-50" title={hint}>
        {fmt(value, decimals)}
        {unit ? <span className="ml-0.5 text-xs font-normal text-ink-500 dark:text-ink-400">{unit}</span> : null}
      </span>
    </div>
  )
}

export function Stat({
  label,
  value,
  unit,
  decimals = 2,
  tone = 'default',
  hint,
}: {
  label: string
  value: number
  unit?: string
  decimals?: number
  tone?: 'default' | 'ok' | 'fail'
  hint?: string
}) {
  const tones = {
    default: 'text-ink-900 dark:text-ink-50',
    ok: 'text-emerald-600 dark:text-emerald-400',
    fail: 'text-rose-600 dark:text-rose-400',
  }[tone]
  return (
    <div
      className="rounded-lg border border-ink-200/80 bg-ink-50/60 px-3 py-2.5 dark:border-ink-800 dark:bg-ink-900/40"
      title={hint}
    >
      <div className="text-[11px] leading-tight font-medium tracking-wide text-ink-500 uppercase dark:text-ink-400">
        {label}
      </div>
      <div className={cx('tabular mt-1 text-lg leading-none font-semibold', tones)}>
        {fmt(value, decimals)}
        {unit ? <span className="ml-1 text-xs font-normal text-ink-500 dark:text-ink-400">{unit}</span> : null}
      </div>
    </div>
  )
}
