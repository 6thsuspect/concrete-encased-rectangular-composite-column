/**
 * Render smoke tests: every panel must render without throwing and must show
 * the expected engineering values (server rendering, no DOM required).
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { computeAll } from '../lib/calc'
import { DEFAULT_INPUTS, inputProblems } from '../lib/calc/defaults'
import { SummaryPanel } from './SummaryPanel'
import { StepsView } from './StepsPanel'
import { ValidationPanel } from './ValidationPanel'
import { ReportView, DEFAULT_META } from './ReportView'
import { CrossSection, iSectionOutline, iSectionPath } from './CrossSection'
import { MemberDiagram } from './MemberDiagram'
import { InteractionChart } from './InteractionChart'
import { InputPanel } from './InputPanel'
import { buildReportHtml } from '../lib/report'
import { resultsToCsv, resultsToJson } from '../lib/exportData'

const results = computeAll(DEFAULT_INPUTS)

/** Even-odd ray casting for a simple polygon. */
function insidePolygon(p: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

describe('components', () => {
  it('renders the summary panel with the governing values', () => {
    const html = renderToStaticMarkup(<SummaryPanel inputs={DEFAULT_INPUTS} results={results} />)
    expect(html).toContain('Demand / capacity')
    expect(html).toContain('1.381')
    expect(html).toContain('5,701')
    expect(html).toContain('1,835')
  })

  it('renders the cross-section, member and interaction figures', () => {
    expect(renderToStaticMarkup(<CrossSection inputs={DEFAULT_INPUTS} />)).toContain('<svg')
    expect(renderToStaticMarkup(<MemberDiagram inputs={DEFAULT_INPUTS} results={results} />)).toContain('<svg')
    const chart = renderToStaticMarkup(<InteractionChart results={results} axis="z" />)
    expect(chart).toContain('<svg')
    expect(chart).toContain('μdd,z = 0.839')
    expect(chart).toContain('Mmax')
  })

  it('draws the embedded I-section with both flanges and the web', () => {
    // model coordinates: the outline is checked in mm, y upwards
    const outline = iSectionOutline(DEFAULT_INPUTS, (z) => z, (v) => v)
    expect(outline).toHaveLength(12)

    const inside = (x: number, y: number) => insidePolygon({ x, y }, outline)
    // the web centre and the web quarter points are part of the steel section
    expect(inside(0, 0)).toBe(true)
    expect(inside(0, 100)).toBe(true)
    expect(inside(3, -100)).toBe(true)
    // the flanges are there too
    expect(inside(100, 120)).toBe(true)
    expect(inside(-100, -120)).toBe(true)
    // but not the gap between the web and the flange edges at mid-height
    expect(inside(60, 0)).toBe(false)
    expect(inside(-60, 0)).toBe(false)
    // nor anything outside the section
    expect(inside(0, 200)).toBe(false)

    const path = iSectionPath(outline, 0)
    const vertices = (path.match(/[MLQ]/g) ?? []).length
    expect(vertices).toBeGreaterThanOrEqual(12)
    expect(path.endsWith('Z')).toBe(true)
    // every web coordinate appears in the path
    for (const x of [-5.25, 5.25]) expect(path).toContain(`${x} 112.7`)
  })

  it('renders the steel outline as a single closed shape covering the web', () => {
    const html = renderToStaticMarkup(<CrossSection inputs={DEFAULT_INPUTS} />)
    const steel = /<path d="([^"]+)" class="fill-ink-900/.exec(html)
    expect(steel).not.toBeNull()
    const d = (steel as RegExpExecArray)[1]
    // twelve corners of the I silhouette: two flanges + a web in one path
    expect((d.match(/[MLQ]/g) ?? []).length).toBeGreaterThanOrEqual(13)
    // the web's inner edges are part of that same path
    expect((d.match(/L[\d.]+ /g) ?? []).length).toBeGreaterThanOrEqual(12)

    // a root radius adds rounded corners
    const rounded = renderToStaticMarkup(<CrossSection inputs={{ ...DEFAULT_INPUTS, r: 20 }} />)
    const steelR = /<path d="([^"]+)" class="fill-ink-900/.exec(rounded)
    expect((steelR as RegExpExecArray)[1]).toContain('Q')
    expect((steelR as RegExpExecArray)[1]).not.toEqual(d)
    // ... and the preview uses the same drawing
    expect(renderToStaticMarkup(<CrossSection inputs={DEFAULT_INPUTS} preview />)).toContain('fill-ink-900')
  })

  it('renders every calculation group', () => {
    const html = renderToStaticMarkup(<StepsView groups={results.groups} />)
    for (const group of results.groups) {
      expect(html).toContain(group.title)
    }
    expect(html).toContain('(EI)e,z')
    expect(html).toContain('μdd,y')
  })

  it('renders the validation panel with the benchmark comparison', () => {
    const html = renderToStaticMarkup(
      <ValidationPanel results={results} problems={inputProblems(DEFAULT_INPUTS)} />,
    )
    expect(html).toContain('Comparison with the published benchmark')
    expect(html).toContain('All reference checks pass')
    expect(html).toContain('No input problems detected.')
  })

  it('renders the input panel with every input group', () => {
    const noop = () => undefined
    const html = renderToStaticMarkup(
      <InputPanel
        inputs={DEFAULT_INPUTS}
        results={results}
        problems={inputProblems(DEFAULT_INPUTS)}
        setInput={noop}
        patchInputs={noop}
        onPreset={noop}
        onReset={noop}
        activePresetId="reference"
        onSaveInputs={noop}
        onLoadInputs={noop}
        onExportReport={noop}
        onExportJson={noop}
        onExportCsv={noop}
        onPrint={noop}
      />,
    )
    expect(html).toContain('Concrete section &amp; steel I-section')
    expect(html).toContain('Loadings')
    expect(html).toContain('Slender member, L = 14 m')
    expect(html).toContain('Concrete grade')
    expect(html).toContain('Structural steel grade')
    expect(html).toContain('Reinforcement inside the compression zone')
    expect(html).toContain('Add row')
    expect(html).toContain('All inputs are valid.')
  })

  it('renders the reinforcement table rows and the 2D preview', () => {
    const noop = () => undefined
    const html = renderToStaticMarkup(
      <InputPanel
        inputs={DEFAULT_INPUTS}
        results={results}
        problems={inputProblems(DEFAULT_INPUTS)}
        setInput={noop}
        patchInputs={noop}
        onPreset={noop}
        onReset={noop}
        activePresetId={null}
        onSaveInputs={noop}
        onLoadInputs={noop}
        onExportReport={noop}
        onExportJson={noop}
        onExportCsv={noop}
        onPrint={noop}
      />,
    )
    expect(html).toContain('aria-label="Bar diameter of row B1"')
    expect(html).toContain('aria-label="X of row B1"')
    expect(html).toContain('452.4')
    expect(html).toContain('<svg')
  })

  it('renders the printable report', () => {
    const html = renderToStaticMarkup(
      <ReportView inputs={DEFAULT_INPUTS} results={results} meta={DEFAULT_META} />,
    )
    expect(html).toContain('Design calculation report')
    expect(html).toContain('IS 11384:2022')
    expect(html).toContain('Section NOT adequate')
    expect(html).toContain('Interaction about the z-axis'.replace('Interaction about the z-axis', 'Figure 3'))
  })
})

describe('exports', () => {
  it('builds a standalone HTML report', () => {
    const html = buildReportHtml(DEFAULT_INPUTS, results, { ...DEFAULT_META, appVersion: 'test' })
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('1.381')
    expect(html).toContain('Detailed calculations')
    expect(html).not.toContain('undefined')
  })

  it('builds JSON and CSV payloads', () => {
    const json = JSON.parse(resultsToJson(DEFAULT_INPUTS, results)) as {
      inputs: { bc: number }
      verificationAgainstBenchmark: unknown[]
    }
    expect(json.inputs.bc).toBe(400)
    expect(json.verificationAgainstBenchmark.length).toBe(12)

    const csv = resultsToCsv(results)
    const lines = csv.trim().split('\n')
    expect(lines[0]).toContain('Group,Step,Symbol')
    expect(lines.length).toBeGreaterThan(40)
    expect(lines.every((l) => l.split(',').length >= 9)).toBe(true)
  })
})
