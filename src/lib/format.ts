/** Number formatting helpers (engineering report style, en-US grouping). */

const cache = new Map<string, Intl.NumberFormat>()

function formatter(decimals: number): Intl.NumberFormat {
  const key = `d${decimals}`
  let f = cache.get(key)
  if (!f) {
    f = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: true,
    })
    cache.set(key, f)
  }
  return f
}

/** Fixed-decimal number with thousands separators. */
export function fmt(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—'
  if (Math.abs(value) !== 0 && (Math.abs(value) < 1e-4 || Math.abs(value) >= 1e12)) {
    return value.toExponential(3)
  }
  return formatter(decimals).format(value)
}

/** Round-trip safe: value + unit. */
export function fmtWithUnit(value: number, unit: string, decimals = 2): string {
  const u = unit ? ` ${unit}` : ''
  return `${fmt(value, decimals)}${u}`
}

/**
 * Engineering (power-of-ten) notation with an SI-ish superscript exponent,
 * e.g. 140,676,409.0 → "140.676 × 10⁶".
 */
export function fmtEng(value: number, sig = 3): string {
  if (!Number.isFinite(value)) return '—'
  if (value === 0) return '0'
  const exp = Math.floor(Math.log10(Math.abs(value)))
  const exp3 = Math.floor(exp / 3) * 3
  const mant = value / 10 ** exp3
  return `${fmt(mant, Math.max(0, sig - Math.floor(Math.log10(Math.abs(mant))) - 1))} × 10${sup(exp3)}`
}

const SUP: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
}

export function sup(n: number): string {
  return String(n)
    .split('')
    .map((c) => SUP[c] ?? c)
    .join('')
}

export function fmtPercent(ratio: number, decimals = 2): string {
  return `${fmt(ratio * 100, decimals)}%`
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

/** Pretty number for axis ticks. */
export function tickLabel(v: number): string {
  const a = Math.abs(v)
  if (a >= 1000) return fmt(v, 0)
  if (a >= 100) return fmt(v, 0)
  if (a >= 10) return fmt(v, 1)
  return fmt(v, 2)
}

export function roundTo(v: number, step: number): number {
  return Math.round(v / step) * step
}
