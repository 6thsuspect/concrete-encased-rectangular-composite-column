import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Inputs } from '../lib/types'
import { DEFAULT_INPUTS, PRESETS, cloneInputs, normalizeInputs, type Preset } from '../lib/calc/defaults'
import { readHashInputs, shareUrl } from '../lib/share'

const STORAGE_KEY = 'is11384-cecc-inputs-v1'

function load(): Inputs {
  const fromHash = readHashInputs()
  if (fromHash) return fromHash
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return normalizeInputs(JSON.parse(raw))
  } catch {
    /* ignore corrupted storage */
  }
  return cloneInputs(DEFAULT_INPUTS)
}

export interface UseInputs {
  inputs: Inputs
  setInput: <K extends keyof Inputs>(key: K, value: Inputs[K]) => void
  patchInputs: (patch: Partial<Inputs>) => void
  replaceInputs: (next: Inputs) => void
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

  const patchInputs = useCallback((patch: Partial<Inputs>) => {
    setInputs((prev) => ({ ...prev, ...patch }))
  }, [])

  const replaceInputs = useCallback((next: Inputs) => setInputs(normalizeInputs(next)), [])

  const reset = useCallback(() => setInputs(cloneInputs(DEFAULT_INPUTS)), [])

  const applyPreset = useCallback((preset: Preset) => {
    setInputs((prev) => cloneInputs({ ...prev, ...preset.patch, bars: preset.patch.bars ?? prev.bars }))
  }, [])

  const activePresetId = useMemo(() => {
    const match = PRESETS.find((preset) =>
      Object.entries(preset.patch).every(([k, v]) => JSON.stringify(inputs[k as keyof Inputs]) === JSON.stringify(v)),
    )
    if (!match) return null
    // only report a preset when every other field is still at its default
    const rest = (Object.keys(DEFAULT_INPUTS) as (keyof Inputs)[]).filter(
      (k) => !(k in (match.patch as Record<string, unknown>)),
    )
    return rest.every((k) => JSON.stringify(inputs[k]) === JSON.stringify(DEFAULT_INPUTS[k])) ? match.id : null
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

  return {
    inputs,
    setInput,
    patchInputs,
    replaceInputs,
    reset,
    applyPreset,
    activePresetId,
    share,
  }
}
