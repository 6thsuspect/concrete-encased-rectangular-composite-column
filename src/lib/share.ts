import type { Inputs } from './types'
import { DEFAULT_INPUTS } from './calc/defaults'

/** Compact, URL-safe representation of the input set. */
export function encodeInputs(i: Inputs): string {
  const json = JSON.stringify(i)
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeInputs(token: string): Inputs | null {
  try {
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<Inputs>
    // merge over the defaults so old links stay usable after new fields appear
    const merged: Inputs = { ...DEFAULT_INPUTS }
    for (const key of Object.keys(DEFAULT_INPUTS) as (keyof Inputs)[]) {
      const value = parsed[key]
      if (key === 'hnZOverride' || key === 'hnYOverride') {
        merged[key] = typeof value === 'number' && Number.isFinite(value) ? value : null
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        ;(merged[key] as number) = value
      }
    }
    return merged
  } catch {
    return null
  }
}

export function shareUrl(i: Inputs): string {
  const base = `${location.origin}${location.pathname}`
  return `${base}#s=${encodeInputs(i)}`
}

export function readHashInputs(): Inputs | null {
  const m = /(?:^|[#&])s=([A-Za-z0-9\-_]+)/.exec(location.hash)
  return m ? decodeInputs(m[1]) : null
}
