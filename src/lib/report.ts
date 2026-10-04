import type { Inputs, Results } from './types'
import { fmt } from './format'
import { compareToReference } from './reference'

export interface ReportMeta {
  project: string
  element: string
  engineer: string
  reference: string
  appVersion: string
}

export interface ReportFigure {
  id: string
  svg: string
  caption: string
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const num = (v: number, d = 2) => fmt(v, d)

/**
 * Self-contained HTML report (no external assets), suitable for archiving or
 * for conversion to PDF with any browser.
 */
export function buildReportHtml(
  inputs: Inputs,
  results: Results,
  meta: ReportMeta,
  figures: ReportFigure[] = [],
): string {
  const rows = compareToReference(results)
  const date = new Date().toISOString().slice(0, 10)

  const inputTable = (
    caption: string,
    rowsIn: [string, string, string][],
  ) => `<div class="tbl"><h3>${esc(caption)}</h3><table><tbody>${rowsIn
    .map(
      ([s, v, u]) =>
        `<tr><td class="sym">${esc(s)}</td><td class="val">${esc(v)}</td><td class="unit">${esc(u)}</td></tr>`,
    )
    .join('')}</tbody></table></div>`

  const groups = results.groups
    .map(
      (g) => `<section class="group">
    <h3>${esc(g.title)}</h3>
    ${g.subtitle ? `<p class="sub">${esc(g.subtitle)}</p>` : ''}
    <table class="calc">
      <thead><tr><th>Symbol</th><th>Expression</th><th class="right">Value</th></tr></thead>
      <tbody>
      ${g.steps
        .map(
          (s) => `<tr>
        <td class="sym">${esc(s.symbol)}</td>
        <td><span class="mono">${esc(s.formula)}</span><br /><span class="mono muted">${esc(s.substitution)}</span>${
          s.note ? `<br /><span class="note">${esc(s.note)}</span>` : ''
        }</td>
        <td class="right nowrap"><strong>${esc(num(s.value, s.decimals))}</strong> ${esc(s.unit === '—' ? '' : s.unit)}</td>
      </tr>`,
        )
        .join('')}
      </tbody>
    </table>
    ${
      g.notes?.length
        ? `<ul class="notes">${g.notes.map((n2) => `<li>${esc(n2)}</li>`).join('')}</ul>`
        : ''
    }
  </section>`,
    )
    .join('\n')

  const figureHtml = figures
    .map(
      (f) => `<figure id="${esc(f.id)}">${f.svg}<figcaption>${esc(f.caption)}</figcaption></figure>`,
    )
    .join('\n')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(meta.project)} — design calculation report</title>
<style>
  :root { --ink:#1b2230; --line:#cbd5e1; --muted:#64748b; --brand:#0b62a1; }
  * { box-sizing: border-box; }
  body { margin: 0 auto; max-width: 900px; padding: 32px 28px 64px; color: var(--ink);
         font: 13px/1.55 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 28px 0 8px; padding-bottom: 4px; border-bottom: 1px solid var(--line); }
  h3 { font-size: 13px; margin: 18px 0 6px; }
  .lead { color: var(--muted); margin: 0 0 16px; }
  .badge { display:inline-block; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:600; }
  .ok { background:#ecfdf5; color:#047857; } .bad { background:#fff1f2; color:#be123c; }
  dl.meta { display:grid; grid-template-columns: repeat(4, 1fr); gap: 8px 20px; margin: 16px 0 8px; }
  dl.meta dt { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
  dl.meta dd { margin: 0; font-weight: 500; }
  .cols { display:grid; grid-template-columns: repeat(4, 1fr); gap: 6px 20px; }
  .cols.one { grid-template-columns: 1fr; }
  .tbl h3 { margin: 0 0 4px; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 3px 6px 3px 0; text-align: left; vertical-align: top; }
  .tbl td { border-bottom: 1px solid #eef2f7; }
  .sym { font-family: ui-monospace, Menlo, Consolas, monospace; white-space: nowrap; }
  .val, .right { text-align: right; } .nowrap { white-space: nowrap; }
  .unit, .muted, .sub, figcaption, .notes { color: var(--muted); }
  .sub { margin: 0 0 6px; font-size: 11.5px; }
  .mono { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11px; }
  .note { font-size: 11px; color: #475569; }
  table.calc thead th { border-bottom: 1px solid var(--line); font-size: 11px; }
  table.calc tr { border-bottom: 1px solid #eef2f7; }
  table.sum tbody td { border-bottom: 1px solid #eef2f7; }
  .notes { font-size: 11px; margin: 6px 0 0; padding-left: 18px; }
  figure { margin: 0; }
  figure svg { width: 100%; height: auto; }
  figcaption { font-size: 11px; text-align: center; margin-top: 4px; }
  .figs { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  footer { margin-top: 32px; padding-top: 8px; border-top: 1px solid var(--line); font-size: 11px; color: var(--muted); }
  @media print { body { padding: 0; max-width: none; } section, figure, table { break-inside: avoid; } }
</style>
</head>
<body>
<header>
  <h1>Design calculation report</h1>
  <p class="lead">Concrete-encased rectangular composite column — compression, moment, shear and demand/capacity verification</p>
  <span class="badge ${results.dc.total <= 1 ? 'ok' : 'bad'}">${results.dc.total <= 1 ? 'Section adequate' : 'Section NOT adequate'} — D/C = ${esc(num(results.dc.total, 3))}</span>
  <dl class="meta">
    <div><dt>Project</dt><dd>${esc(meta.project)}</dd></div>
    <div><dt>Element</dt><dd>${esc(meta.element)}</dd></div>
    <div><dt>Designer</dt><dd>${esc(meta.engineer || '—')}</dd></div>
    <div><dt>Date</dt><dd>${esc(date)}</dd></div>
    <div><dt>Code</dt><dd>IS 11384:2022</dd></div>
    <div><dt>Method</dt><dd>Simplified interaction-curve method</dd></div>
    <div><dt>Units</dt><dd>kN, kN-m, mm, N/mm²</dd></div>
    <div><dt>Reference</dt><dd>${esc(meta.reference)}</dd></div>
  </dl>
</header>

<h2>1. Input data</h2>
<div class="cols">
  ${inputTable('Loading', [
    ['PD', num(inputs.PD, 0), 'kN'],
    ['PL', num(inputs.PL, 0), 'kN'],
    ['Mz', num(inputs.Mz, 0), 'kN-m'],
    ['My', num(inputs.My, 0), 'kN-m'],
  ])}
  ${inputTable('Concrete section', [
    ['type', inputs.sectionType === 'rect-slab' ? 'rect + slab' : inputs.sectionType === 'circular' ? 'circular' : 'rectangular', ''],
    ...(inputs.sectionType === 'circular'
      ? ([
          ['D', num(inputs.diameter, 0), 'mm'],
          ['R', num(inputs.diameter / 2, 0), 'mm'],
        ] as [string, string, string][])
      : ([
          ['bc', num(inputs.bc, 0), 'mm'],
          ['hc', num(inputs.hc, 0), 'mm'],
        ] as [string, string, string][])),
    ['cover', num(inputs.cover, 0), 'mm'],
    ...(inputs.sectionType === 'rect-slab'
      ? ([
          ['bs', num(inputs.slabWidth, 0), 'mm'],
          ['ts', num(inputs.slabThickness, 0), 'mm'],
        ] as [string, string, string][])
      : []),
  ])}
  ${inputTable('Steel I-section', [
    ['h', num(inputs.h, 0), 'mm'],
    ['bf', num(inputs.bf, 0), 'mm'],
    ['tw', num(inputs.tw, 1), 'mm'],
    ['tf', num(inputs.tf, 1), 'mm'],
    ['r', num(inputs.r, 1), 'mm'],
  ])}
  ${inputTable('Member', [
    ['Ly', num(inputs.Ly, 0), 'mm'],
    ['Lz', num(inputs.Lz, 0), 'mm'],
    ['Ky', num(inputs.Ky, 2), '—'],
    ['Kz', num(inputs.Kz, 2), '—'],
    ['ψ = M1/M2', num(inputs.psi, 2), '—'],
  ])}
  ${inputTable('Materials', [
    ['concrete', `${inputs.concreteGrade}`, ''],
    ['fck', num(inputs.fck, 0), 'N/mm²'],
    ['γc', num(inputs.gammaC, 2), '—'],
    ['Ecm', num(inputs.Ecm, 0), 'N/mm²'],
    ['reinforcement', `${inputs.rebarGrade}`, ''],
    ['fyk', num(inputs.fyk, 0), 'N/mm²'],
    ['Es', num(inputs.Est, 0), 'N/mm²'],
    ['γs', num(inputs.gammaK, 2), '—'],
    ['steel', `${inputs.steelGrade}`, ''],
    ['fy', num(inputs.fy, 0), 'N/mm²'],
    ['fu', num(inputs.fu, 0), 'N/mm²'],
    ['E', num(inputs.Es, 0), 'N/mm²'],
    ['γm0', num(inputs.gammaM0, 2), '—'],
  ])}
</div>
<div class="cols one">
  ${inputTable(
    'Reinforcement position table (mm from the concrete centroid)',
    inputs.bars.length
      ? inputs.bars.map((row, i) => [
          row.label || `B${i + 1}`,
          `${row.count} × ⌀${num(row.db, 0)} mm ` +
            (row.spread === 'corner'
              ? `at (±${num(row.x, 0)}, ±${num(row.y, 0)})`
              : row.spread === 'ring'
                ? `on a ring of ⌀${num(2 * Math.abs(row.x), 0)} mm from ${num(row.y, 0)}°`
                : `at (${num(row.x, 0)}, ${num(row.y, 0)})`) +
            `${row.layer ? ` · layer ${row.layer}` : ''}${row.cover ? ` · cover ${num(row.cover, 0)} mm` : ''}`,
          '',
        ])
      : [['—', 'no reinforcement rows', '']],
  )}
</div>

${figures.length ? `<h2>2. Section and member</h2><div class="figs">${figureHtml}</div>` : ''}

<h2>${figures.length ? '3' : '2'}. Summary of results</h2>
<table class="sum">
  <thead><tr><th>Quantity</th><th class="right">This app</th><th class="right">Report</th><th class="right">Workbook</th><th class="right">Δ</th><th class="right">Status</th></tr></thead>
  <tbody>
  ${rows
    .map(
      (r) => `<tr><td>${esc(r.label)} ${r.unit !== '—' ? `<span class="muted">(${esc(r.unit)})</span>` : ''}</td>
    <td class="right"><strong>${esc(num(r.value, r.decimals))}</strong></td>
    <td class="right">${esc(num(r.reference, r.decimals))}</td>
    <td class="right">${esc(num(r.workbook, r.decimals))}</td>
    <td class="right">${esc(num(r.delta, r.decimals))}</td>
    <td class="right">${r.pass ? 'ok' : 'check'}</td></tr>`,
    )
    .join('')}
  </tbody>
</table>

<h2>${figures.length ? '4' : '3'}. Detailed calculations</h2>
${groups}

<h2>${figures.length ? '5' : '4'}. Basis, assumptions and remarks</h2>
<ul class="notes">
  <li><strong>Code.</strong> IS 11384:2022 — design of composite columns; simplified interaction-curve method for concrete-encased sections.</li>
  <li><strong>Section equilibrium.</strong> The neutral-axis depth hn follows from the equilibrium of the plastic stress blocks and is rounded up to 0.5 mm (z-axis) and 0.1 mm (y-axis) as in the reference workbook.</li>
  <li><strong>Buckling.</strong> Reduction factors derived from buckling curves b (z-axis) and c (y-axis); effective stiffness with 0.6 Ecm for the concrete.</li>
  <li><strong>Second-order effects.</strong> Amplified moments k = Cmm / (1 − P/Pcr) ≥ 1.0.</li>
  <li><strong>Shear.</strong> Plastic shear resistance of the embedded steel section; utilisations below 0.6, hence no reduction of the moment and axial resistances.</li>
  <li><strong>Known asymmetry of the reference.</strong> The published y-axis equations omit the αc factor of the z-axis equations; the published form is reproduced so that the results match the benchmark.</li>
  <li><strong>Scope.</strong> Mid-height section of a simply supported member with pinned ends; fire, durability, detailing, fatigue and global second-order analysis are excluded.</li>
</ul>

<footer>Generated by the IS 11384 composite-column application v${esc(meta.appVersion)} on ${esc(date)}. Independent results quoted from ${esc(meta.reference)}.</footer>
</body>
</html>`
}
