import { useEffect, useId, useRef, useState } from 'react'
import { cx } from './ui'

interface Props {
  label: string
  symbol?: string
  value: number
  onChange: (value: number) => void
  unit?: string
  step?: number
  min?: number
  max?: number
  hint?: string
  className?: string
}

/**
 * Numeric input that keeps the raw text while the user is typing so that
 * intermediate states ("17.", "-", "") do not fight the controlled value.
 */
export function NumberField({
  label,
  symbol,
  value,
  onChange,
  unit,
  step = 1,
  min,
  max,
  hint,
  className,
}: Props) {
  const id = useId()
  const [text, setText] = useState(String(value))
  const [invalid, setInvalid] = useState(false)
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) {
      setText(formatInput(value))
      setInvalid(false)
    }
  }, [value])

  /** Live commit: valid entries propagate immediately, invalid ones are flagged. */
  const commit = (raw: string) => {
    const parsed = Number(raw.replace(/,/g, '.').trim())
    if (raw.trim() === '' || !Number.isFinite(parsed)) {
      setInvalid(true)
      return
    }
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed))
    setInvalid(clamped !== parsed)
    onChange(clamped)
  }

  return (
    <label htmlFor={id} className={cx('block', className)} title={hint}>
      <span className="flex items-baseline gap-1 text-[11px] leading-4 font-medium text-ink-600 dark:text-ink-300">
        {symbol && <span className="font-mono text-ink-500 dark:text-ink-400">{symbol}</span>}
        <span className="truncate">{label}</span>
      </span>
      <span className="mt-1 flex items-stretch overflow-hidden rounded-lg border bg-white shadow-inner focus-within:ring-2 focus-within:ring-brand-500/30 dark:bg-ink-900">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          data-field={symbol ?? label}
          spellCheck={false}
          value={text}
          step={step}
          onFocus={() => {
            focused.current = true
          }}
          onChange={(e) => {
            setText(e.target.value)
            commit(e.target.value)
          }}
          onBlur={(e) => {
            focused.current = false
            const parsed = Number(e.target.value.replace(/,/g, '.').trim())
            setText(formatInput(clamp(parsed, min, max, value)))
            setInvalid(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit((e.target as HTMLInputElement).value)
              ;(e.target as HTMLInputElement).blur()
            }
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault()
              const delta = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)
              const next = clamp(value + delta, min, max, value)
              setText(formatInput(next))
              onChange(next)
            }
          }}
          className={cx(
            'tabular w-full min-w-0 border-0 bg-transparent px-2.5 py-1.5 text-sm text-ink-900 outline-none',
            'placeholder:text-ink-300 dark:text-ink-50',
            invalid && 'text-rose-600 dark:text-rose-400',
          )}
        />
        {unit && (
          <span className="flex items-center border-l border-ink-200/70 bg-ink-50 px-2 text-[11px] whitespace-nowrap text-ink-500 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-400">
            {unit}
          </span>
        )}
      </span>
      {invalid && <span className="mt-0.5 block text-[11px] text-rose-600 dark:text-rose-400">Invalid value</span>}
    </label>
  )
}

function clamp(v: number, min?: number, max?: number, fallback = 0): number {
  if (!Number.isFinite(v)) return fallback
  return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v))
}

function formatInput(v: number): string {
  if (!Number.isFinite(v)) return ''
  return String(Number(v.toFixed(6)))
}

/** Optional override of a computed value (checkbox + input). */
export function NullableNumberField({
  label,
  value,
  onChange,
  seed,
  unit,
  step,
  hint,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  /** value written into the field when the override is switched on */
  seed: number
  unit?: string
  step?: number
  hint?: string
}) {
  const active = value !== null
  return (
    <div className="sm:col-span-2">
      <label className="flex items-center gap-2 text-[11px] font-medium text-ink-600 dark:text-ink-300">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => onChange(e.target.checked ? Number(seed.toFixed(3)) : null)}
          className="size-3.5 rounded border-ink-300 text-brand-600 focus:ring-brand-500/40 dark:border-ink-600"
        />
        {label}
      </label>
      {active && (
        <div className="mt-1.5">
          <NumberField
            label="adopted value"
            value={value as number}
            onChange={(v) => onChange(v)}
            unit={unit}
            step={step}
            hint={hint}
          />
        </div>
      )}
    </div>
  )
}
