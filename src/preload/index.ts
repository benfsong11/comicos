import { contextBridge, ipcRenderer } from 'electron'

const api = {
  saveImage: (dataUrl: string) => ipcRenderer.invoke('file:save-image', dataUrl),
  openImage: () => ipcRenderer.invoke('file:open-image'),
  getZoomFactor: () => ipcRenderer.invoke('zoom:get'),
  setZoomFactor: (factor: number) => ipcRenderer.invoke('zoom:set', factor),
  onMenuAction: (callback: (action: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: string) => callback(action)
    ipcRenderer.on('menu:action', handler)
    return () => ipcRenderer.removeListener('menu:action', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
