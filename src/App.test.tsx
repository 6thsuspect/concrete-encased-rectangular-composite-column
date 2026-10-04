// @vitest-environment jsdom
/**
 * Interaction smoke tests for the application shell, mounted in jsdom:
 * tab navigation, live recalculation while typing, presets and persistence.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import App from './App'

let root: Root | null = null
let container: HTMLDivElement

beforeAll(() => {
  ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = ''
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root?.render(<App />)
  })
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
})

const text = () => container.textContent ?? ''

function click(el: Element | null | undefined, what = 'element') {
  if (!el) throw new Error(`${what} not found`)
  act(() => {
    ;(el as HTMLElement).click()
  })
}

function clickButton(label: string) {
  const exact = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === label)
  if (exact) return click(exact, `button "${label}"`)
  const partial = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(label))
  return click(partial, `button containing "${label}"`)
}

function field(name: string): HTMLInputElement {
  const el = container.querySelector(`[data-field="${name}"]`)
  if (!el) throw new Error(`field ${name} not found`)
  return el as HTMLInputElement
}

function selectOf(label: string): HTMLSelectElement {
  const el = container.querySelector(`select[aria-label="${label}"]`)
  if (!el) throw new Error(`select ${label} not found`)
  return el as HTMLSelectElement
}

function setSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
  act(() => {
    setter?.call(select, value)
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('application shell', () => {
  it('mounts and shows the reference results', () => {
    expect(text()).toContain('Concrete-encased composite column')
    expect(text()).toContain('1.381')
    expect(text()).toContain('Not adequate')
    expect(text()).toContain('5,701') // Pd
    expect(text()).toContain('1,835') // P'd,C,z
  })

  it('switches between all tabs without crashing', () => {
    clickButton('Interaction diagrams')
    expect(text()).toContain('Point C — maximum moment')
    expect(text()).toContain('505.0')

    clickButton('Calculations')
    expect(text()).toContain('Section properties')
    expect(text()).toContain('(EI)e,z')

    clickButton('Validation')
    expect(text()).toContain('Comparison with the published benchmark')
    expect(text()).toContain('All reference checks pass')

    clickButton('Report')
    expect(text()).toContain('Design calculation report')

    clickButton('Summary')
    expect(text()).toContain('Utilisation ratios')
  })

  it('recalculates as soon as an input changes', () => {
    const pd = field('PD')
    expect(pd.value).toBe('1200')

    setInputValue(pd, '2000')
    // P at mid-height becomes 2,000 + 600 kN and the ratios change accordingly
    expect(text()).toContain('2,600')
    expect(text()).not.toContain('1,800.0 / (0.761')
  })

  it('applies a preset and persists the inputs', () => {
    clickButton('Slender member, L = 14 m')
    const sidebar = container.querySelector('aside')
    const values = Array.from(sidebar?.querySelectorAll('input[type="text"]') ?? []).map(
      (i) => (i as HTMLInputElement).value,
    )
    expect(values).toContain('14000')

    const stored = JSON.parse(localStorage.getItem('is11384-cecc-inputs-v1') ?? '{}') as Record<string, number>
    expect(stored).toMatchObject({ Ly: 14000, Lz: 14000, bc: 400, PD: 1200 })
  })

  it('rejects an invalid entry without breaking the results', () => {
    setInputValue(field('bc'), 'abc')
    expect(text()).toContain('Invalid value')
    expect(text()).toContain('D/C')
  })

  it('auto-fills the concrete grade and marks manual values as customised', () => {
    // the hint text of the materials fieldset mentions the word once
    const badges = () => (text().match(/customised/g) ?? []).length
    const baseline = badges()
    setSelectValue(selectOf('Concrete grade'), 'M40')
    expect(field('fck').value).toBe('40')
    expect(field('Ecm').value).toBe('31623')

    expect(badges()).toBe(baseline)
    setInputValue(field('fck'), '42')
    expect(badges()).toBe(baseline + 1)
    expect(field('fck').value).toBe('42')
  })

  it('stops the calculation while the inputs contain a blocking error', () => {
    // cover larger than half the smallest concrete dimension
    setInputValue(field('c'), '300')
    expect(text()).toContain('Calculation stopped')
    expect(text()).toContain('The cover must be smaller than half of the smallest concrete dimension.')
    expect(text()).toContain('check inputs')
    expect(text()).not.toContain('Demand / capacity')

    // switching to a valid cover brings the results back
    setInputValue(field('c'), '41')
    expect(text()).toContain('Demand / capacity')
    expect(text()).toContain('1.381')
  })

  it('switches the concrete section type and reveals the slab inputs', () => {
    expect(container.querySelector('[data-field="bs"]')).toBeNull()
    clickButton('Encasement + slab')
    expect(field('bs').value).toBe('1000')
    expect(field('ts').value).toBe('150')
    expect(text()).toContain('slab 1,000 × 150')
    // the slab raises the moment resistance, so the D/C ratio drops
    expect(text()).toContain('0.857')

    clickButton('Rectangular encasement')
    expect(text()).toContain('1.381')
  })

  it('adds and removes reinforcement rows through the table', () => {
    expect(text()).toContain('Ast = 452.4')
    clickButton('Add row')
    expect(text()).toContain('Ast = 904.8')
    // both rows are corner rows of four ⌀12 bars
    expect(container.querySelectorAll('[aria-label^="X of row"]').length).toBe(2)

    const del = container.querySelector('[aria-label="Delete row B2"]') as HTMLButtonElement | null
    click(del, 'delete row B2')
    expect(text()).toContain('Ast = 452.4')
  })
})
