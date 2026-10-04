/**
 * Save / load / export of the design input set.
 *
 * A saved file is a small self-describing JSON envelope; the loader also
 * accepts a bare input object (for files produced by hand or by an older
 * version of the app).
 */
import type { Inputs } from './types'
import { normalizeInputs } from './calc/defaults'
import { saveText } from './exportData'

export const INPUT_FORMAT = 'is11384-inputs'
export const INPUT_FORMAT_VERSION = 1

export interface InputFile {
  app: string
  format: typeof INPUT_FORMAT
  version: number
  saved: string
  inputs: Inputs
}

export function inputsToJson(i: Inputs, pretty = true): string {
  const payload: InputFile = {
    app: 'IS 11384:2022 — concrete-encased rectangular composite column',
    format: INPUT_FORMAT,
    version: INPUT_FORMAT_VERSION,
    saved: new Date().toISOString(),
    inputs: i,
  }
  return JSON.stringify(payload, null, pretty ? 2 : 0)
}

/** Parse a saved file (envelope or bare object). Returns null when unusable. */
export function inputsFromJson(text: string): Inputs | null {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return null
    const candidate =
      parsed.inputs && typeof parsed.inputs === 'object' ? (parsed.inputs as Record<string, unknown>) : parsed
    if (!candidate || typeof candidate !== 'object') return null
    return normalizeInputs(candidate)
  } catch {
    return null
  }
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

/** Save the input set as a JSON file (Electron dialog, or a browser download). */
export function saveInputs(i: Inputs): Promise<boolean> {
  return saveText(`IS11384-inputs-${stamp()}.json`, inputsToJson(i), 'application/json')
}

/**
 * Open an input file. Uses the Electron dialog when available, otherwise a
 * hidden `<input type="file">`. Resolves to the file contents or null.
 */
export function openInputFile(extensions: string[] = ['json']): Promise<string | null> {
  if (window.desktop?.openFile) {
    return window.desktop.openFile({ extensions }).then((r) => (r.opened && r.contents ? r.contents : null))
  }
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = extensions.map((e) => `.${e}`).join(',')
    input.style.display = 'none'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) {
        input.remove()
        resolve(null)
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        input.remove()
        resolve(typeof reader.result === 'string' ? reader.result : null)
      }
      reader.onerror = () => {
        input.remove()
        resolve(null)
      }
      reader.readAsText(file)
    })
    document.body.appendChild(input)
    input.click()
  })
}
