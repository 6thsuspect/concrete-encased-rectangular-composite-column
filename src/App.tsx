import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { computeAll } from './lib/calc'
import { inputProblems, type InputProblem } from './lib/calc/defaults'
import { useInputs } from './hooks/useInputs'
import { inputsFromJson, openInputFile, saveInputs } from './lib/inputIO'
import { Header } from './components/Header'
import { InputPanel } from './components/InputPanel'
import { SummaryPanel } from './components/SummaryPanel'
import { StepsView } from './components/StepsPanel'
import { ValidationPanel } from './components/ValidationPanel'
import { ReportView, DEFAULT_META } from './components/ReportView'
import { InteractionChart } from './components/InteractionChart'
import { ExportFigures } from './components/ExportFigures'
import { Badge, Button, cx } from './components/ui'
import { exportCsv, exportJson, exportReport, printReport } from './lib/exportData'

const APP_VERSION = '1.0.0'

type TabId = 'summary' | 'interaction' | 'calculations' | 'validation' | 'report'

const TABS: { id: TabId; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'interaction', label: 'Interaction diagrams' },
  { id: 'calculations', label: 'Calculations' },
  { id: 'validation', label: 'Validation' },
  { id: 'report', label: 'Report' },
]

export default function App() {
  const { inputs, setInput, patchInputs, replaceInputs, reset, applyPreset, activePresetId, share } = useInputs()
  const [tab, setTab] = useState<TabId>('summary')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dark, setDark] = useState<boolean>(() => {
    const stored = localStorage.getItem('is11384-theme')
    if (stored) return stored === 'dark'
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle')
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const results = useMemo(() => computeAll(inputs), [inputs])
  const problems = useMemo(() => inputProblems(inputs), [inputs])
  const blocking = problems.filter((p) => p.level === 'error')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('is11384-theme', dark ? 'dark' : 'light')
  }, [dark])

  const notify = useCallback((message: string) => {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  const handleShare = useCallback(async () => {
    const url = await share()
    setShareState('copied')
    notify('Shareable link copied to the clipboard')
    window.setTimeout(() => setShareState('idle'), 2400)
    window.history.replaceState(null, '', url)
  }, [share, notify])

  const handleExportReport = useCallback(async () => {
    const saved = await exportReport(inputs, results, { ...DEFAULT_META, appVersion: APP_VERSION })
    notify(saved ? 'HTML report saved' : 'Export cancelled')
  }, [inputs, results, notify])

  const handleExportJson = useCallback(async () => {
    const saved = await exportJson(inputs, results)
    notify(saved ? 'Results exported as JSON' : 'Export cancelled')
  }, [inputs, results, notify])

  const handleExportCsv = useCallback(async () => {
    const saved = await exportCsv(results)
    notify(saved ? 'Calculation steps exported as CSV' : 'Export cancelled')
  }, [results, notify])

  const handleSaveInputs = useCallback(async () => {
    const saved = await saveInputs(inputs)
    notify(saved ? 'Input file saved' : 'Save cancelled')
  }, [inputs, notify])

  const handleLoadInputs = useCallback(async () => {
    const contents = await openInputFile(['json'])
    if (contents === null) return
    const loaded = inputsFromJson(contents)
    if (!loaded) {
      notify('That file is not a valid input file')
      return
    }
    replaceInputs(loaded)
    notify('Input file loaded')
  }, [replaceInputs, notify])

  const handlePrint = useCallback(() => {
    setTab('report')
    // print on a light surface: the dark scheme would produce unreadable pages
    window.setTimeout(() => {
      const root = document.documentElement
      const wasDark = root.classList.contains('dark')
      if (wasDark) root.classList.remove('dark')
      try {
        printReport()
      } finally {
        if (wasDark) {
          window.setTimeout(() => root.classList.add('dark'), 1500)
        }
      }
    }, 150)
  }, [])

  return (
    <div className="min-h-full">
      <Header
        results={results}
        dark={dark}
        onToggleTheme={() => setDark((d) => !d)}
        onToggleSidebar={() => setSidebarOpen((s) => !s)}
        sidebarOpen={sidebarOpen}
        onExportJson={handleExportJson}
        onExportCsv={handleExportCsv}
        onExportReport={handleExportReport}
        onPrint={handlePrint}
        onShare={handleShare}
        shareState={shareState}
        isDesktop={Boolean(window.desktop)}
        blocked={blocking.length > 0}
      />

      <div className="mx-auto flex max-w-[1600px] gap-4 px-4 py-4">
        {/* input sidebar */}
        <aside
          className={cx(
            'no-print w-full shrink-0 lg:block lg:w-[350px] xl:w-[380px]',
            sidebarOpen ? 'block' : 'hidden',
          )}
        >
          <div className="sticky top-[68px] max-h-[calc(100vh-84px)] overflow-y-auto rounded-xl border border-ink-200/80 bg-white shadow-sm lg:max-h-[calc(100vh-92px)] dark:border-ink-800 dark:bg-ink-900/60">
            <div className="flex items-center justify-between border-b border-ink-200/70 px-4 py-2.5 dark:border-ink-800">
              <span className="text-[11px] font-semibold tracking-wider text-ink-600 uppercase dark:text-ink-300">
                Design inputs
              </span>
              <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)} className="lg:hidden">
                Close
              </Button>
            </div>
            <InputPanel
              inputs={inputs}
              results={results}
              problems={problems}
              setInput={setInput}
              patchInputs={patchInputs}
              onPreset={(p) => {
                applyPreset(p)
                if (window.innerWidth < 1024) setSidebarOpen(false)
              }}
              onReset={reset}
              activePresetId={activePresetId}
              onSaveInputs={handleSaveInputs}
              onLoadInputs={handleLoadInputs}
              onExportReport={handleExportReport}
              onExportJson={handleExportJson}
              onExportCsv={handleExportCsv}
              onPrint={handlePrint}
            />
            <div className="border-t border-ink-200/70 px-4 py-3 text-[11px] text-ink-500 dark:border-ink-800 dark:text-ink-400">
              Results update as you type. Everything is computed locally — nothing leaves this device.
            </div>
          </div>
        </aside>

        {/* main content */}
        <main className="min-w-0 flex-1">
          <nav className="no-print mb-3 flex flex-wrap gap-1 rounded-xl border border-ink-200/80 bg-white p-1 shadow-sm dark:border-ink-800 dark:bg-ink-900/60">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cx(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  tab === t.id
                    ? 'bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900'
                    : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800',
                )}
                aria-current={tab === t.id}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {blocking.length > 0 ? <BlockedPanel problems={blocking} /> : (
          <>
          {tab === 'summary' && <SummaryPanel inputs={inputs} results={results} />}

          {tab === 'interaction' && (
            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-2">
                <InteractionCard axis="z" results={results} />
                <InteractionCard axis="y" results={results} showOther />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KeyPointCard
                  title="Point A — pure compression"
                  rows={[
                    ['P', `${(results.member.Pd).toFixed(1)} kN`],
                    ['M', '0 kN-m'],
                  ]}
                />
                <KeyPointCard
                  title="Point B — simplified curve knee"
                  rows={[
                    ['P′d,C,z', `${results.axes.z.PdC.toFixed(1)} kN`],
                    ['Md,z', `${results.axes.z.Md.toFixed(1)} kN-m`],
                    ['P′d,C,y', `${results.axes.y.PdC.toFixed(1)} kN`],
                    ['Md,y', `${results.axes.y.Md.toFixed(1)} kN-m`],
                  ]}
                />
                <KeyPointCard
                  title="Point C — maximum moment"
                  rows={[
                    ['Mmax,z', `${results.axes.z.Mmax.toFixed(1)} kN-m`],
                    ['P = P′d,C,z/2', `${(results.axes.z.PdC / 2).toFixed(1)} kN`],
                    ['Mmax,y', `${results.axes.y.Mmax.toFixed(1)} kN-m`],
                    ['P = P′d,C,y/2', `${(results.axes.y.PdC / 2).toFixed(1)} kN`],
                  ]}
                />
                <KeyPointCard
                  title="Point D — pure bending"
                  rows={[
                    ['Md,z', `${results.axes.z.Md.toFixed(1)} kN-m`],
                    ['Md,y', `${results.axes.y.Md.toFixed(1)} kN-m`],
                  ]}
                />
              </div>
            </div>
          )}

          {tab === 'calculations' && <StepsView groups={results.groups} />}

          {tab === 'validation' && <ValidationPanel results={results} problems={problems} />}

          {tab === 'report' && <ReportView inputs={inputs} results={results} meta={DEFAULT_META} />}
          </>
          )}
        </main>
      </div>

      <ExportFigures inputs={inputs} results={results} />

      {toast && (
        <div className="no-print fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink-900 px-4 py-2 text-xs font-medium text-white shadow-lg dark:bg-ink-100 dark:text-ink-900">
          {toast}
        </div>
      )}

      <footer className="no-print mx-auto max-w-[1600px] px-4 pb-8 text-[11px] leading-relaxed text-ink-400">
        Independent results reproduced from the CSI software verification report “IS 11384:2022 CCD Example
        001”. This application is an independent implementation of the simplified interaction-curve method and
        does not replace engineering judgement or the governing code.
      </footer>
    </div>
  )
}

/** Shown instead of the results while the input set contains blocking errors. */
function BlockedPanel({ problems }: { problems: InputProblem[] }) {
  return (
    <div className="rounded-xl border border-rose-500/30 bg-rose-50 p-5 dark:border-rose-500/30 dark:bg-rose-500/10">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-rose-800 dark:text-rose-200">
        <Badge status="fail">input error{problems.length === 1 ? '' : 's'}</Badge>
        Calculation stopped — fix the input{problems.length === 1 ? '' : 's'} first
      </h2>
      <p className="mt-2 text-xs leading-relaxed text-rose-800/90 dark:text-rose-200/90">
        Every input is validated before the calculation runs. The list below shows what has to be corrected; the
        results, diagrams and exports become available again as soon as the input set is consistent.
      </p>
      <ul className="mt-3 space-y-1.5">
        {problems.map((p, i) => (
          <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-rose-900 dark:text-rose-100">
            <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
            {p.message}
          </li>
        ))}
      </ul>
    </div>
  )
}

function InteractionCard({
  axis,
  results,
  showOther,
}: {
  axis: 'z' | 'y'
  results: ReturnType<typeof computeAll>
  showOther?: boolean
}) {
  return (
    <div className="rounded-xl border border-ink-200/80 bg-white p-3 shadow-sm dark:border-ink-800 dark:bg-ink-900/60">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-50">
          {axis === 'z' ? 'Major axis (z)' : 'Minor axis (y)'}
        </h3>
        <span className="text-[11px] text-ink-500 dark:text-ink-400">
          λ{axis} = {results.axes[axis].lambda.toFixed(3)} · χ{axis} = {results.axes[axis].chi.toFixed(3)}
        </span>
      </div>
      <InteractionChart results={results} axis={axis} showOther={showOther} className="mx-auto h-[400px] w-full" />
    </div>
  )
}

function KeyPointCard({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="rounded-xl border border-ink-200/80 bg-white p-3 shadow-sm dark:border-ink-800 dark:bg-ink-900/60">
      <h3 className="mb-2 text-xs font-semibold text-ink-600 dark:text-ink-300">{title}</h3>
      <dl className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-2">
            <dt className="font-mono text-[11px] text-ink-500 dark:text-ink-400">{k}</dt>
            <dd className="tabular text-xs font-medium text-ink-900 dark:text-ink-50">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
