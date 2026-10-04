/// <reference types="vite/client" />

/** API exposed by the Electron preload script (absent in the browser). */
export interface DesktopApi {
  readonly isElectron: true
  platform: string
  version: string
  saveFile(options: { suggestedName: string; contents: string }): Promise<{ saved: boolean; path?: string }>
  openFile(options?: { extensions?: string[] }): Promise<{ opened: boolean; contents?: string; path?: string }>
  print(): void
}

declare global {
  interface Window {
    desktop?: DesktopApi
  }
}

export {}
