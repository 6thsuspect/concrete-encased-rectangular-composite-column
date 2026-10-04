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
    const sidebar = container.querySelector('aside')
    const pd = sidebar?.querySelector('input[type="text"]') as HTMLInputElement | null
    expect(pd).toBeTruthy()
    expect(pd?.value).toBe('1200')

    setInputValue(pd as HTMLInputElement, '2000')
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
    const sidebar = container.querySelector('aside')
    const bc = Array.from(sidebar?.querySelectorAll('input[type="text"]') ?? [])[4] as HTMLInputElement
    setInputValue(bc, 'abc')
    expect(text()).toContain('Invalid value')
    expect(text()).toContain('D/C')
  })
})
