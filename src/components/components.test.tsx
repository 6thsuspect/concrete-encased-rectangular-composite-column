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

  it('renders the input panel', () => {
    const html = renderToStaticMarkup(
      <InputPanel
        inputs={DEFAULT_INPUTS}
        results={results}
        setInput={() => undefined}
        onPreset={() => undefined}
        onReset={() => undefined}
        activePresetId="reference"
      />,
    )
    expect(html).toContain('Cross-section')
    expect(html).toContain('Loadings')
    expect(html).toContain('Slender member, L = 14 m')
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
