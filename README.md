# Concrete-encased rectangular composite column — IS 11384:2022

Compression, moment and shear capacities together with the corresponding demand/capacity (D/C) ratios of a
**concrete-encased rectangular composite column** verified at mid-height according to **IS 11384:2022** using the
*simplified interaction-curve method*.

The original repository contained only the reference documents of the benchmark
(`IS11384_2022.pdf`, `IS-11384 2022 Ex001.pdf` and `IS-11384 2022 Ex001_v1.2.xlsx`, i.e. the CSI/ETABS software
verification example 001). It is now a complete **web application — and, from the same code base, a desktop
application — built with React 19 + TypeScript + Vite + Tailwind CSS + Electron**.

```
┌───────────────┬──────────────────────────────────────────────────────────────┐
│ Design inputs │  Summary · Interaction diagrams · Calculations · Validation  │
│ (live)        │  · printable Report            ← results update while typing  │
└───────────────┴──────────────────────────────────────────────────────────────┘
```

The calculation engine is a faithful, fully typed TypeScript port of the reference workbook: all section
properties, the neutral-axis depth of the interaction point C, the global buckling reduction factors, the
second-order moments, the shear resistance and the combined biaxial D/C ratio are reproduced **and validated
against the published independent results** (see [Verification](#verification-against-the-benchmark)).

---

## Quick start

```bash
npm install          # installs the web app tool-chain (Electron is downloaded too)

npm run dev          # → http://localhost:5173   web app with hot reload
npm run dev:desktop  # → same dev server inside an Electron window
npm run build        # type-checks and produces a static bundle in dist/
npm run build:desktop# static bundle + dist-electron/ + installers in release/
npm test             # 28 unit / rendering tests (engine + UI)
npm run typecheck    # tsc --noEmit for the app and for the Electron/Node code
npm run preview      # serve the production bundle locally
```

Requirements: Node.js ≥ 20 (developed on Node 22) and npm ≥ 10.

### Web

`npm run build` emits a self-contained static site (`dist/`, relative asset paths) that can be hosted anywhere —
GitHub Pages, Netlify, S3, an intranet share, or opened from `file://`.

### Desktop

`npm run dev:desktop` starts the Vite dev server and opens it in an Electron window; `npm run build:desktop`
produces installers (`release/`) for Windows (NSIS), macOS (DMG) and Linux (AppImage) via `electron-builder`.
In the desktop build the *Export* menu uses native save dialogs and *Print / PDF* uses Electron's print dialog.

---

## What the app does

| Panel | Content |
| --- | --- |
| **Inputs** (sidebar) | Loadings, cross-section, materials, member/buckling and advanced overrides. Presets for the reference example and three variations. Every change recalculates instantly. |
| **Summary** | D/C headline, capacities, utilisation bars for axial / shear / both bending axes, cross-section and member drawings, both interaction diagrams. |
| **Interaction diagrams** | P–M interaction diagram per principal axis: the plastic curve A→B→C→D, the simplified bilinear curve A→B→D, the key points and the design point of the member. |
| **Calculations** | The complete calculation sheet, group by group: symbol, expression, numeric substitution, value, unit, governing check and the source cell of the reference workbook. |
| **Validation** | Comparison with the independent results of the benchmark (report *and* workbook columns, absolute and relative deviation, tolerance), input validation and the list of governing checks. |
| **Report** | Print-ready A4 calculation report (header block, inputs, figures, summary table, all calculation steps, basis and assumptions) plus HTML / JSON / CSV export. |

Other features: light and dark colour schemes, shareable links that encode the whole input set in the URL
(`…/#s=…`), local persistence of the inputs (no server, nothing leaves the device), keyboard-friendly numeric
fields (`↑`/`↓` to step, `Shift` for ×10).

---

## Engineering model

Everything follows the reference implementation of IS 11384:2022 (simplified method for concrete-encased
sections, as exercised by the CSI verification example):

1. **Required strengths** at mid-height — `P = PD + PL`, `Mz = Mz,end/2`, `My = My,end/2`, `Vy = Mz/L`,
   `Vz = My/L`.
2. **Section properties** of the steel I-section, the reinforcement (parallel-axis theorem) and the concrete
   (gross outline minus steel and bars).
3. **Effective flexural stiffness** `(EI)e = Es Is + 0.6 Ecm Ic + Est Ist` (0.6 Ecm per the simplified method),
   elastic critical forces `Pcr = π² (EI)e / (K L)²`.
4. **Axial resistances** `Pn = As fy + Ast fyk + 0.8 Ac αc fck` and
   `Pd = As fy/γm0 + Ast fyk/γk + 0.68 Ac fck/γc`, applicability check `0.2 < δ < 0.9` with `λz, λy < 2.0`.
5. **Interaction point C** from the equilibrium of the plastic stress blocks (neutral-axis depth `hn`), rounded
   up to 0.5 mm (z-axis) and 0.1 mm (y-axis) exactly as in the reference workbook, giving `P′d,C`, `Md` and
   `Mmax` for each axis.
6. **Global buckling** — relative slenderness `λ = √(Pn/Pcr)`, buckling curves *b* (z-axis, α = 0.34) and *c*
   (y-axis, α = 0.49), `χ = 1/(Φ + √(Φ² − λ²))`, utilisations `P/(χ Pd)`.
7. **Second-order moments** `Mz = kz Mz,end` with `kz = Cmm/(1 − P/Pcr,z) ≥ 1.0`, `Cmm = 0.6 + 0.4 ψ`.
8. **Shear** — plastic resistance of the embedded steel `Vd = Av fy/√3` for both directions; both utilisations
   stay below 0.6, so shear does not reduce the moment and axial resistances.
9. **Demand/capacity** — `μdd` from the simplified interaction curve, `M/(μdd Md)` per axis and the sum
   `My/(μdd,y Md,y) + Mz/(μdd,z Md,z)` as the governing D/C ratio (compared with the αmm = 0.9 threshold).

### Verification against the benchmark

`npm test` reproduces the published independent results. The validation panel shows this table live for the
current input set:

| Quantity | Report | Workbook | This app | Δ |
| --- | --- | --- | --- | --- |
| `Pd` (kN) | 5701 | 5701 | 5700.8 | −0.2 |
| `P′d,C,z` (kN) | 1837 | 1835 | 1835.4 | −1.6 |
| `P′d,C,y` (kN) | 3859 | 3884 | 3883.8 | +24.8 |
| `χz` / `χy` | 0.76 / 0.62 | 0.76 / 0.62 | 0.761 / 0.619 | ≈ 0 |
| `Mmax,z` / `Md,z` (kN-m) | 505 / 468 | 505 / 468 | 505.0 / 468.4 | ≈ 0 |
| `Mmax,y` / `Md,y` (kN-m) | 310 / 189 | 310 / 187 | 310.1 / 187.3 | ≈ 0 |
| `Vd,y` / `Vd,z` (kN) | 544 / 1764 | 544 / 1764 | 543.8 / 1764.3 | ≈ 0 |
| D/C | 1.377 | 1.381 | **1.381** | +0.004 |

Two documented peculiarities of the source material are reproduced deliberately (both are flagged in the app
and in the report):

* **Neutral-axis rounding.** The report prints `hn,z = 78.6 mm` and `hn,y = 94.4 mm`, while the workbook solves
  the exact expressions (`78.134 mm`, `95.137 mm`) and rounds *up* to 0.5 mm / 0.1 mm. This app follows the
  workbook, which is why `P′d,C,z` is 1835 kN rather than 1837 kN. The advanced inputs allow the reported
  neutral-axis depths to be imposed manually.
* **αc asymmetry in the published equations.** The z-axis expressions carry the concrete stress-block
  coefficient `αc`, the published y-axis expressions omit it (PDF pages 6–7 and the workbook agree on this).
  The published form is reproduced verbatim so that the y-axis results match the benchmark — hence
  `P′d,C,y = 3883.8 kN` (workbook 3884 kN) instead of the report's 3858.6 kN. For `αc = 0.85` a "consistent"
  implementation would give ≈ 3770 kN.

---

## Project structure

```
├── electron/
│   ├── main.ts               Electron main process: window, save dialog, print
│   └── preload.ts            contextBridge API (`window.desktop`)
├── src/
│   ├── lib/
│   │   ├── calc/             ← the calculation engine (no UI dependencies)
│   │   │   ├── section.ts        required strengths + section properties
│   │   │   ├── member.ts         effective stiffness, Pcr, Pd, χ, second-order moments
│   │   │   ├── interaction.ts    neutral-axis depth, interaction point C, curves
│   │   │   ├── shear.ts          shear resistance and the D/C ratio
│   │   │   ├── defaults.ts       reference inputs, presets, input validation
│   │   │   └── index.ts          computeAll()
│   │   ├── reference.ts      independent results of the benchmark + tolerances
│   │   ├── report.ts         standalone HTML report (no external assets)
│   │   ├── exportData.ts     JSON / CSV / HTML export, print bridge
│   │   ├── share.ts          URL-safe encoding of the input set
│   │   ├── format.ts         engineering number formatting
│   │   └── types.ts          input / result / step types
│   ├── components/          UI: inputs, summary, charts, steps, validation, report
│   ├── hooks/useInputs.ts   state, persistence, presets, share links
│   ├── App.tsx              shell, tabs, exports
│   └── index.css            Tailwind v4 theme (light + dark)
├── IS11384_2022.pdf                     original code extract (source document)
├── IS-11384 2022 Ex001.pdf              CSI verification report (benchmark)
└── IS-11384 2022 Ex001_v1.2.xlsx        reference workbook
```

Each calculation step carries its source reference (e.g. `4.z-Buckling!E43`), so every number in the UI can be
traced back to the workbook cell it reproduces.

## Tech stack

| Layer | Choice |
| --- | --- |
| UI | React 19, TypeScript 5 (strict), Tailwind CSS 4 |
| Build | Vite 8 (`@vitejs/plugin-react`, `@tailwindcss/vite`) |
| Desktop | Electron 44 + `vite-plugin-electron` + `electron-builder` |
| Tests | Vitest 5 (+ jsdom for the UI interaction tests) |
| Charts | Hand-written SVG (no charting dependency) |

No runtime dependencies beyond React — the calculation engine is dependency-free and can be imported by other
projects (`import { computeAll } from './src/lib/calc'`).

## Disclaimer

This application is an independent implementation of the simplified interaction-curve method of IS 11384:2022.
It was written to reproduce a published verification benchmark and is provided for engineering assistance only —
it does not replace the governing code, project specifications or engineering judgement. Always verify the
results against the applicable standard before using them in a design.
