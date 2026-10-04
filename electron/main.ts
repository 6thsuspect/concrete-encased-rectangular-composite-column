import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Electron shell for the IS 11384 composite-column application.
 * The renderer is the very same web build served by Vite (dev server URL when
 * `VITE_DEV_SERVER_URL` is set, otherwise the bundled `dist/index.html`).
 */

const __dirname_ = path.dirname(fileURLToPath(import.meta.url))

// dist-electron/main.js  →  ../dist  (built renderer)
process.env.APP_ROOT = path.join(__dirname_, '..')
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#f6f8fa',
    title: 'IS 11384:2022 — concrete-encased composite column',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname_, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    void mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  // external links open in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  platform: process.platform,
  electron: process.versions.electron,
}))

ipcMain.handle('file:save', async (_event, options: { suggestedName: string; contents: string }) => {
  if (!mainWindow) return { saved: false }
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: options.suggestedName,
    filters: filtersFor(options.suggestedName),
  })
  if (canceled || !filePath) return { saved: false }
  await writeFile(filePath, options.contents, 'utf8')
  return { saved: true, path: filePath }
})

ipcMain.handle('file:open', async (_event, options?: { extensions?: string[] }) => {
  if (!mainWindow) return { opened: false }
  const extensions = options?.extensions ?? ['json']
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Input file', extensions },
      { name: 'All files', extensions: ['*'] },
    ],
  })
  if (canceled || filePaths.length === 0) return { opened: false }
  const contents = await readFile(filePaths[0], 'utf8')
  return { opened: true, contents, path: filePaths[0] }
})

ipcMain.handle('window:print', async () => {
  if (!mainWindow) return false
  await new Promise<void>((resolve) => {
    mainWindow?.webContents.print({ silent: false, printBackground: true }, () => resolve())
  })
  return true
})

function filtersFor(name: string): Electron.FileFilter[] {
  const ext = path.extname(name).replace('.', '').toLowerCase()
  const map: Record<string, string> = {
    html: 'HTML document',
    json: 'JSON data',
    csv: 'CSV file',
    txt: 'Text file',
    pdf: 'PDF document',
  }
  return [
    { name: map[ext] ?? 'All files', extensions: [ext || '*'] },
    { name: 'All files', extensions: ['*'] },
  ]
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
