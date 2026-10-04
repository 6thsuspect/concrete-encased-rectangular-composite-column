import type { Results } from '../lib/types'
import { fmt } from '../lib/format'
import { Badge, Button, cx } from './ui'

interface Props {
  results: Results
  dark: boolean
  onToggleTheme: () => void
  onToggleSidebar: () => void
  sidebarOpen: boolean
  onExportJson: () => void
  onExportCsv: () => void
  onExportReport: () => void
  onPrint: () => void
  onShare: () => void
  shareState: 'idle' | 'copied'
  isDesktop: boolean
}

export function Header({
  results,
  dark,
  onToggleTheme,
  onToggleSidebar,
  sidebarOpen,
  onExportJson,
  onExportCsv,
  onExportReport,
  onPrint,
  onShare,
  shareState,
  isDesktop,
}: Props) {
  const dc = results.dc.total
  const adequate = dc <= 1

  return (
    <header className="no-print sticky top-0 z-30 border-b border-ink-200/80 bg-white/85 backdrop-blur-md dark:border-ink-800 dark:bg-ink-950/85">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-2.5">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50 lg:hidden dark:text-ink-300 dark:ring-ink-700 dark:hover:bg-ink-800"
          aria-expanded={sidebarOpen}
        >
          <span aria-hidden>☰</span> Inputs
        </button>

        <div className="flex min-w-0 items-center gap-2.5">
          <Logo />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight text-ink-900 dark:text-ink-50">
              Concrete-encased composite column
            </h1>
            <p className="truncate text-[11px] text-ink-500 dark:text-ink-400">
              IS 11384:2022 · simplified interaction-curve method · CCD Example 001
            </p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="hidden items-baseline gap-2 rounded-lg bg-ink-100 px-2.5 py-1.5 sm:flex dark:bg-ink-800/70">
            <span className="text-[10px] tracking-wide text-ink-500 uppercase dark:text-ink-400">D/C</span>
            <span className={cx('tabular text-sm font-semibold', adequate ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
              {fmt(dc, 3)}
            </span>
            <Badge status={adequate ? 'ok' : 'fail'}>{adequate ? 'Adequate' : 'Not adequate'}</Badge>
          </div>

          <Button variant="ghost" size="sm" onClick={onShare} title="Copy a shareable link with the current inputs">
            {shareState === 'copied' ? 'Link copied' : 'Share link'}
          </Button>

          <details className="relative no-print">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 ring-1 ring-ink-300 hover:bg-ink-50 dark:bg-ink-800 dark:text-ink-100 dark:ring-ink-700 dark:hover:bg-ink-700">
              Export <span aria-hidden className="text-[9px]">▾</span>
            </summary>
            <div className="absolute right-0 z-40 mt-1 w-60 overflow-hidden rounded-xl border border-ink-200 bg-white p-1 shadow-lg dark:border-ink-700 dark:bg-ink-900">
              <MenuItem onClick={onExportReport} title="Standalone HTML">
                Report (HTML)
              </MenuItem>
              <MenuItem onClick={onPrint} title={isDesktop ? 'Electron print dialog' : 'Print / save as PDF'}>
                Print / PDF
              </MenuItem>
              <MenuItem onClick={onExportJson}>Results (JSON)</MenuItem>
              <MenuItem onClick={onExportCsv}>Calculation steps (CSV)</MenuItem>
            </div>
          </details>

          <Button variant="ghost" size="sm" onClick={onToggleTheme} title="Toggle colour scheme">
            {dark ? '☀' : '☾'}
          </Button>
        </div>
      </div>
    </header>
  )
}

function MenuItem({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        onClick()
        const details = (e.currentTarget.closest('details') as HTMLDetailsElement | null) ?? null
        if (details) details.open = false
      }}
      className="block w-full rounded-lg px-2.5 py-2 text-left text-xs text-ink-700 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-800"
    >
      {children}
    </button>
  )
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
      <rect width="32" height="32" rx="7" className="fill-ink-900 dark:fill-ink-100" />
      <rect x="8.5" y="8.5" width="15" height="15" fill="none" className="stroke-brand-400" strokeWidth="1.4" />
      <rect x="12.5" y="7" width="7" height="2.2" className="fill-brand-400" />
      <rect x="12.5" y="22.8" width="7" height="2.2" className="fill-brand-400" />
      <rect x="14.9" y="7" width="2.2" height="18" className="fill-brand-400" />
    </svg>
  )
}
