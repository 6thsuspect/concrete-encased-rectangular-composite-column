import { contextBridge, ipcRenderer } from 'electron'

/** Minimal, explicitly enumerated API surface exposed to the renderer. */
const api = {
  isElectron: true as const,
  platform: process.platform,
  version: process.versions.electron,
  saveFile: (options: { suggestedName: string; contents: string }): Promise<{ saved: boolean; path?: string }> =>
    ipcRenderer.invoke('file:save', options),
  print: (): void => {
    void ipcRenderer.invoke('window:print')
  },
  info: (): Promise<{ version: string; platform: string; electron: string }> => ipcRenderer.invoke('app:info'),
}

contextBridge.exposeInMainWorld('desktop', api)
