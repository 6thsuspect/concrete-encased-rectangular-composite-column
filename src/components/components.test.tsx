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
import { CrossSection } from './CrossSection'
import { MemberDiagram } from './MemberDiagram'
import { InteractionChart } from './InteractionChart'
import { InputPanel } from './InputPanel'
import { buildReportHtml } from '../lib/report'
import { resultsToCsv, resultsToJson } from '../lib/exportData'

const results = computeAll(DEFAULT_INPUTS)

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
