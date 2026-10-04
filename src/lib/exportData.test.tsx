// @vitest-environment jsdom
/**
 * Export pipeline: the report figures must be collectable as standalone SVG
 * markup from the off-screen figure block.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ExportFigures } from '../components/ExportFigures'
import { computeAll } from './calc'
import { DEFAULT_INPUTS } from './calc/defaults'
import { collectFigures, resultsToCsv, resultsToJson, exportReport } from './exportData'
import { buildReportHtml } from './report'

const results = computeAll(DEFAULT_INPUTS)

let root: Root | null = null

beforeEach(() => {
  ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  document.body.innerHTML = '<div id="host"></div>'
  const host = document.getElementById('host') as HTMLDivElement
  root = createRoot(host)
  act(() => {
    root?.render(<ExportFigures inputs={DEFAULT_INPUTS} results={results} />)
  })
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
})

describe('export pipeline', () => {
  it('collects the four report figures as standalone SVG', () => {
    const figures = collectFigures()
    expect(figures.map((f) => f.id)).toEqual(['cross-section', 'member', 'interaction-z', 'interaction-y'])
    for (const figure of figures) {
      expect(figure.svg.startsWith('<svg')).toBe(true)
      expect(figure.svg).toContain('xmlns="http://www.w3.org/2000/svg"')
      expect(figure.svg).not.toContain('class=')
    }
    expect(figures[0].svg).toContain('id="cross-section"')
  })

  it('embeds the figures in the standalone HTML report', () => {
    const html = buildReportHtml(DEFAULT_INPUTS, results, {
      project: 'test',
      element: 'test',
      engineer: 'test',
      reference: 'test',
      appVersion: 'test',
    }, collectFigures())
    expect(html).toContain('Figure 1 — cross-section')
    expect(html.match(/<figure/g)?.length).toBe(4)
    expect(html).toContain('1.381')
  })

  it('exposes the export entry points without throwing', async () => {
    // JSON / CSV are pure string builders and must always work
    expect(JSON.parse(resultsToJson(DEFAULT_INPUTS, results))).toBeTruthy()
    expect(resultsToCsv(results).length).toBeGreaterThan(1000)

    // exportReport falls back to a download in the browser (no window.desktop);
    // jsdom has no URL.createObjectURL, so stub it to observe the call
    const created: string[] = []
    const originalCreate = URL.createObjectURL
    const originalRevoke = URL.revokeObjectURL
    URL.createObjectURL = () => {
      created.push('blob')
      return 'blob:test'
    }
    URL.revokeObjectURL = () => undefined
    try {
      const saved = await exportReport(DEFAULT_INPUTS, results, {
        project: 'p',
        element: 'e',
        engineer: 'eng',
        reference: 'r',
        appVersion: '1.0.0',
      })
      expect(saved).toBe(true)
      expect(created.length).toBe(1)
    } finally {
      URL.createObjectURL = originalCreate
      URL.revokeObjectURL = originalRevoke
    }
  })
})
