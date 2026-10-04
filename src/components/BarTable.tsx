import type { BarRow, Inputs } from '../lib/types'
import { BAR_DIAMETERS } from '../lib/calc/grades'
import { barInstances, describeBarRow } from '../lib/calc/geometry'
import { fmt } from '../lib/format'
import { Button, cx } from './ui'

interface Props {
  inputs: Inputs
  onUpdate: (id: string, patch: Partial<BarRow>) => void
  onAdd: () => void
  onRemove: (id: string) => void
  onReset: () => void
}

/**
 * Reinforcement position table: one row per bar group. `corner` spreads four
 * bars to (±X, ±Y); `point` stacks `n` bars at the single position (X, Y).
 */
export function BarTable({ inputs, onUpdate, onAdd, onRemove, onReset }: Props) {
  const instances = barInstances(inputs.bars)
  const Ast = instances.reduce((a, b) => a + b.area, 0)
  const dbMax = instances.reduce((m, b) => Math.max(m, b.db), 0)

  const cells = 'w-[62px] shrink-0'

  return (
    <div className="col-span-full space-y-2">
      <div className="overflow-x-auto rounded-lg border border-ink-200/80 dark:border-ink-800">
        <table className="w-full min-w-[560px] border-collapse text-[11px]">
          <thead>
            <tr className="bg-ink-50 text-left text-ink-500 dark:bg-ink-800/60 dark:text-ink-400">
              <Th className="w-[46px]">Bar</Th>
              <Th className={cells}>Layer</Th>
              <Th className={cells}>⌀ mm</Th>
              <Th className="w-[52px]">Nos.</Th>
              <Th className="w-[74px]">Arr.</Th>
              <Th className={cells}>Cover</Th>
              <Th className={cells}>X mm</Th>
              <Th className={cells}>Y mm</Th>
              <Th className="w-[30px]">{''}</Th>
            </tr>
          </thead>
          <tbody>
            {inputs.bars.map((bar) => (
              <tr
                key={bar.id}
                title={describeBarRow(bar)}
                className="border-t border-ink-200/70 dark:border-ink-800"
              >
                <Td>
                  <Cell
                    value={bar.label}
                    text
                    onChange={(v) => onUpdate(bar.id, { label: v })}
                    ariaLabel={`Label of bar row ${bar.label}`}
                  />
                </Td>
                <Td>
                  <Cell
                    value={bar.layer}
                    text
                    onChange={(v) => onUpdate(bar.id, { layer: v })}
                    ariaLabel={`Layer of bar row ${bar.label}`}
                  />
                </Td>
                <Td>
                  <select
                    value={BAR_DIAMETERS.includes(bar.db) ? bar.db : 'other'}
                    aria-label={`Bar diameter of row ${bar.label}`}
                    onChange={(e) => onUpdate(bar.id, { db: e.target.value === 'other' ? bar.db : Number(e.target.value) })}
                    className="tabular w-full rounded border border-ink-200 bg-white px-1 py-1 text-[11px] text-ink-900 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-50"
                  >
                    {BAR_DIAMETERS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                    <option value="other">…</option>
                  </select>
                </Td>
                <Td>
                  <Cell
                    value={bar.count}
                    step={1}
                    min={0}
                    onChange={(v) => onUpdate(bar.id, { count: Math.max(0, Math.round(v)) })}
                    ariaLabel={`Number of bars in row ${bar.label}`}
                  />
                </Td>
                <Td>
                  <select
                    value={bar.spread}
                    aria-label={`Arrangement of row ${bar.label}`}
                    onChange={(e) => onUpdate(bar.id, { spread: e.target.value as BarRow['spread'] })}
                    className="w-full rounded border border-ink-200 bg-white px-1 py-1 text-[11px] text-ink-900 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-50"
                  >
                    <option value="corner">corner</option>
                    <option value="point">point</option>
                  </select>
                </Td>
                <Td>
                  <Cell
                    value={bar.cover}
                    onChange={(v) => onUpdate(bar.id, { cover: v })}
                    ariaLabel={`Cover of row ${bar.label}`}
                  />
                </Td>
                <Td>
                  <Cell value={bar.x} onChange={(v) => onUpdate(bar.id, { x: v })} ariaLabel={`X of row ${bar.label}`} />
                </Td>
                <Td>
                  <Cell value={bar.y} onChange={(v) => onUpdate(bar.id, { y: v })} ariaLabel={`Y of row ${bar.label}`} />
                </Td>
                <Td>
                  <button
                    type="button"
                    title={`Delete row ${bar.label}`}
                    aria-label={`Delete row ${bar.label}`}
                    disabled={inputs.bars.length <= 1}
                    onClick={() => onRemove(bar.id)}
                    className="rounded px-1 text-ink-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                  >
                    ✕
                  </button>
                </Td>
              </tr>
            ))}
            {inputs.bars.length === 0 && (
              <tr>
                <td colSpan={9} className="px-2 py-3 text-center text-ink-500 dark:text-ink-400">
                  No reinforcement rows — add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="subtle" onClick={onAdd}>
          Add row
        </Button>
        <Button
          size="sm"
          variant="subtle"
          onClick={() => onRemove(inputs.bars[inputs.bars.length - 1]?.id ?? '')}
          disabled={inputs.bars.length <= 1}
        >
          Delete row
        </Button>
        <Button size="sm" variant="ghost" onClick={onReset}>
          Reset
        </Button>
      </div>

      <p className="text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
        Ast = <span className="tabular font-medium text-ink-700 dark:text-ink-200">{fmt(Ast, 1)}</span> mm² in{' '}
        {instances.length} bar{instances.length === 1 ? '' : 's'}
        {dbMax > 0 ? ` (largest ⌀${fmt(dbMax, 0)})` : ''} · Ast/(bc·hc) ={' '}
        {fmt((Ast / Math.max(inputs.bc * inputs.hc, 1e-9)) * 100, 3)} %. Coordinates X, Y are measured from the
        concrete centroid; a corner row places four bars at (±X, ±Y).
      </p>
    </div>
  )
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cx('px-1.5 py-1.5 font-semibold whitespace-nowrap', className)}>{children}</th>
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-1 py-1 align-middle">{children}</td>
}

/** Small unstyled input for a table cell. */
function Cell({
  value,
  onChange,
  step = 1,
  min,
  text,
  ariaLabel,
}: {
  value: number | string
  onChange: (v: never) => void
  step?: number
  min?: number
  text?: boolean
  ariaLabel: string
}) {
  return (
    <input
      type="text"
      inputMode={text ? 'text' : 'decimal'}
      step={step}
      min={min}
      aria-label={ariaLabel}
      value={String(value)}
      onChange={(e) => {
        if (text) {
          ;(onChange as (v: string) => void)(e.target.value)
          return
        }
        const parsed = Number(e.target.value.replace(/,/g, '.').trim())
        if (e.target.value.trim() === '' || !Number.isFinite(parsed)) return
        ;(onChange as (v: number) => void)(parsed)
      }}
      className="tabular w-full rounded border border-ink-200 bg-white px-1 py-1 text-[11px] text-ink-900 outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-50"
    />
  )
}
