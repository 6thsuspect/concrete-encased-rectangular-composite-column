import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Inputs } from '../lib/types'
import { DEFAULT_INPUTS, PRESETS, type Preset } from '../lib/calc/defaults'
import { readHashInputs, shareUrl } from '../lib/share'

const STORAGE_KEY = 'is11384-cecc-inputs-v1'

function load(): Inputs {
  const fromHash = readHashInputs()
  if (fromHash) return fromHash
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Inputs>
      return { ...DEFAULT_INPUTS, ...parsed }
    }
  } catch {
    /* ignore corrupted storage */
  }
  return { ...DEFAULT_INPUTS }
}

export interface UseInputs {
  inputs: Inputs
  setInput: <K extends keyof Inputs>(key: K, value: Inputs[K]) => void
  reset: () => void
  applyPreset: (preset: Preset) => void
  activePresetId: string | null
  share: () => Promise<string>
}

export function useInputs(): UseInputs {
  const [inputs, setInputs] = useState<Inputs>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs))
    } catch {
      /* storage may be unavailable (private mode, file://) — not fatal */
    }
  }, [inputs])

  const setInput = useCallback(<K extends keyof Inputs>(key: K, value: Inputs[K]) => {
    setInputs((prev) => ({ ...prev, [key]: value }))
  }, [])

  const reset = useCallback(() => setInputs({ ...DEFAULT_INPUTS }), [])

  const applyPreset = useCallback((preset: Preset) => {
    setInputs({ ...DEFAULT_INPUTS, ...preset.patch })
  }, [])

  const activePresetId = useMemo(() => {
    const match = PRESETS.find((preset) =>
      Object.entries(preset.patch).every(([k, v]) => inputs[k as keyof Inputs] === v),
    )
    if (!match) return null
    // only report a preset when every other field is still at its default
    const rest = (Object.keys(DEFAULT_INPUTS) as (keyof Inputs)[]).filter(
      (k) => !(k in (match.patch as Record<string, unknown>)),
    )
    return rest.every((k) => inputs[k] === DEFAULT_INPUTS[k]) ? match.id : null
  }, [inputs])

  const share = useCallback(async () => {
    const url = shareUrl(inputs)
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      /* clipboard may be blocked — the caller shows the link */
    }
    return url
  }, [inputs])

  return { inputs, setInput, reset, applyPreset, activePresetId, share }
}
