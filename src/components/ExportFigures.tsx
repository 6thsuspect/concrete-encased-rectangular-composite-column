import type { Inputs, Results } from '../lib/types'
import { CrossSection } from './CrossSection'
import { MemberDiagram } from './MemberDiagram'
import { InteractionChart } from './InteractionChart'

/**
 * Off-screen copies of the four report figures. They are always mounted, so
 * the HTML/PDF export contains every figure regardless of the active tab, and
 * they give `collectFigures()` a single, stable place to pick the markup from.
 */
export function ExportFigures({ inputs, results }: { inputs: Inputs; results: Results }) {
  return (
    <div data-export-figures className="no-print pointer-events-none fixed top-0 -left-[9999px] h-px w-px overflow-hidden opacity-0" aria-hidden>
      <div data-figure="cross-section">
        <CrossSection inputs={inputs} className="h-[300px] w-[340px]" />
      </div>
      <div data-figure="member">
        <MemberDiagram inputs={inputs} results={results} className="h-[260px] w-[340px]" />
      </div>
      <div data-figure="interaction-z">
        <InteractionChart results={results} axis="z" className="h-[420px] w-[560px]" />
      </div>
      <div data-figure="interaction-y">
        <InteractionChart results={results} axis="y" showOther className="h-[420px] w-[560px]" />
      </div>
    </div>
  )
}
