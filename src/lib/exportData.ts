import type { Inputs, Results } from './types'
import { buildReportHtml, type ReportFigure, type ReportMeta } from './report'
import { compareToReference } from './reference'

/** Save a text file — through Electron when available, otherwise a download. */
export async function saveText(filename: string, contents: string, mime = 'text/plain'): Promise<boolean> {
  if (window.desktop) {
    const result = await window.desktop.saveFile({ suggestedName: filename, contents })
    return result.saved
  }
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return true
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

export function resultsToJson(inputs: Inputs, results: Results): string {
  const rows = compareToReference(results)
  return JSON.stringify(
    {
      application: 'IS 11384:2022 concrete-encased rectangular composite column',
      generated: new Date().toISOString(),
      inputs,
      results: {
        required: results.required,
        steel: results.steel,
        rebar: results.rebar,
        concrete: results.concrete,
        member: results.member,
        global: results.global,
        dc: results.dc,
        axes: {
          z: stripCurves(results.axes.z),
          y: stripCurves(results.axes.y),
        },
      },
      verificationAgainstBenchmark: rows.map((r) => ({
        quantity: r.label,
        value: r.value,
        reference: r.reference,
        workbook: r.workbook,
        difference: r.delta,
        unit: r.unit,
        tolerance: r.tolerance,
        pass: r.pass,
      })),
    },
    null,
    2,
  )
}

function stripCurves<T extends { curve: unknown; bilinear: unknown }>(a: T) {
  const { curve: _curve, bilinear: _bilinear, ...rest } = a
  void _curve
  void _bilinear
  return rest
}

export function resultsToCsv(results: Results): string {
  const lines: string[] = ['Group,Step,Symbol,Description,Formula,Substitution,Value,Unit,Status']
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`
  for (const group of results.groups) {
    for (const step of group.steps) {
      lines.push(
        [
          q(group.title),
          q(step.id),
          q(step.symbol),
          q(step.label),
          q(step.formula),
          q(step.substitution),
          step.value,
          q(step.unit),
          q(step.check === false ? '' : (step.status ?? '')),
        ].join(','),
      )
    }
  }
  return lines.join('\n')
}

export function collectFigures(): ReportFigure[] {
  const found: ReportFigure[] = []
  const scope = document.querySelector('[data-export-figures]') ?? document
  const specs: { id: string; caption: string }[] = [
    { id: 'cross-section', caption: 'Figure 1 — cross-section (dimensions in mm)' },
    { id: 'member', caption: 'Figure 2 — simply supported member and applied actions' },
    { id: 'interaction-z', caption: 'Figure 3 — interaction diagram about the z-axis (major axis)' },
    { id: 'interaction-y', caption: 'Figure 4 — interaction diagram about the y-axis (minor axis)' },
  ]
  for (const spec of specs) {
    const el = scope.querySelector(`[data-figure="${spec.id}"] svg`)
    if (el) {
      found.push({ id: spec.id, caption: spec.caption, svg: inlineSvg(el, spec.id) })
    }
  }
  return found
}

/**
 * Copy an SVG so that it stands alone: Tailwind classes are replaced by the
 * resolved presentation attributes (this also freezes the current theme).
 */
function inlineSvg(el: Element, id: string): string {
  const clone = el.cloneNode(true) as SVGElement
  const originals = [el, ...Array.from(el.querySelectorAll('*'))]
  const clones = [clone, ...Array.from(clone.querySelectorAll('*'))]

  const properties = [
    'fill',
    'fill-opacity',
    'stroke',
    'stroke-width',
    'stroke-dasharray',
    'stroke-linecap',
    'opacity',
    'font-size',
    'font-family',
    'font-weight',
    'text-anchor',
  ] as const

  originals.forEach((original, i) => {
    const node = clones[i] as SVGElement | undefined
    if (!node || !(node instanceof Element)) return
    const computed = getComputedStyle(original as Element)
    node.removeAttribute('class')
    for (const property of properties) {
      const value = computed.getPropertyValue(property)
      if (!value) continue
      if (property === 'fill' && value === 'none') {
        node.setAttribute('fill', 'none')
        continue
      }
      if (property === 'stroke' && value === 'none') {
        node.setAttribute('stroke', 'none')
        continue
      }
      node.setAttribute(property, value)
    }
  })

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.removeAttribute('class')
  clone.setAttribute('style', 'max-width:100%;height:auto')
  const markup = clone.outerHTML
  return markup.replace(/<svg([^>]*)>/, `<svg$1 id="${id}">`)
}

export async function exportReport(
  inputs: Inputs,
  results: Results,
  meta: ReportMeta,
): Promise<boolean> {
  const html = buildReportHtml(inputs, results, meta, collectFigures())
  return saveText(`is11384-cecc-report-${stamp()}.html`, html, 'text/html')
}

export async function exportJson(inputs: Inputs, results: Results): Promise<boolean> {
  return saveText(`is11384-cecc-results-${stamp()}.json`, resultsToJson(inputs, results), 'application/json')
}

export async function exportCsv(results: Results): Promise<boolean> {
  return saveText(`is11384-cecc-steps-${stamp()}.csv`, resultsToCsv(results), 'text/csv')
}

export function printReport(): void {
  if (window.desktop) {
    window.desktop.print()
    return
  }
  window.print()
}
