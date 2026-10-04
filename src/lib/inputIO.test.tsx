// @vitest-environment jsdom
/**
 * Save / load round trips. The Electron bridge is stubbed so that the whole
 * file protocol (envelope → dialog → contents) can be exercised in jsdom.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cloneInputs, DEFAULT_INPUTS } from './calc/defaults'
import { inputsFromJson, inputsToJson, openInputFile, saveInputs } from './inputIO'

afterEach(() => {
  vi.unstubAllGlobals()
  delete (window as { desktop?: unknown }).desktop
})

describe('save / load through the desktop bridge', () => {
  it('saves the input set through the Electron dialog', async () => {
    const saveFile = vi.fn().mockResolvedValue({ saved: true, path: '/tmp/x.json' })
    window.desktop = {
      isElectron: true,
      platform: 'test',
      version: '0',
      saveFile,
      openFile: vi.fn(),
      print: vi.fn(),
    }

    await expect(saveInputs(DEFAULT_INPUTS)).resolves.toBe(true)
    expect(saveFile).toHaveBeenCalledTimes(1)
    const arg = saveFile.mock.calls[0][0] as { suggestedName: string; contents: string }
    expect(arg.suggestedName).toMatch(/^IS11384-inputs-.*\.json$/)
    expect(inputsFromJson(arg.contents)?.bc).toBe(400)
  })

  it('reports a cancelled save', async () => {
    window.desktop = {
      isElectron: true,
      platform: 'test',
      version: '0',
      saveFile: vi.fn().mockResolvedValue({ saved: false }),
      openFile: vi.fn(),
      print: vi.fn(),
    }
    await expect(saveInputs(DEFAULT_INPUTS)).resolves.toBe(false)
  })

  it('loads an input file through the Electron dialog', async () => {
    const modified = { ...cloneInputs(DEFAULT_INPUTS), bc: 500, fck: 35 }
    window.desktop = {
      isElectron: true,
      platform: 'test',
      version: '0',
      saveFile: vi.fn(),
      openFile: vi.fn().mockResolvedValue({ opened: true, contents: inputsToJson(modified) }),
      print: vi.fn(),
    }
    const contents = await openInputFile(['json'])
    expect(contents).not.toBeNull()
    expect(inputsFromJson(contents as string)).toMatchObject({ bc: 500, fck: 35 })
  })

  it('returns null when the open dialog is cancelled', async () => {
    window.desktop = {
      isElectron: true,
      platform: 'test',
      version: '0',
      saveFile: vi.fn(),
      openFile: vi.fn().mockResolvedValue({ opened: false }),
      print: vi.fn(),
    }
    await expect(openInputFile()).resolves.toBeNull()
  })
})
