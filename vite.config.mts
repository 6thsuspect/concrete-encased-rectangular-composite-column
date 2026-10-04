import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'
import type { PluginOption } from 'vite'

/**
 * `npm run dev`            → pure web app (browser) on http://localhost:5173
 * `npm run dev:desktop`    → same dev server + Electron shell (ELECTRON=1)
 * `npm run build`          → static web bundle in ./dist
 * `npm run build:desktop`  → web bundle + Electron main/preload + installers
 */
const withElectron = process.env.ELECTRON === '1'

export default defineConfig({
  // Relative base so the same bundle works from a static host, a sub-path
  // (e.g. GitHub Pages) and from Electron's file:// protocol.
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    ...(withElectron
      ? ([
          electron({
            main: {
              entry: 'electron/main.ts',
            },
            preload: {
              input: 'electron/preload.ts',
            },
          }),
        ] as PluginOption[])
      : []),
  ],
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    // The sandboxed preview is served from a proxied host name.
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
