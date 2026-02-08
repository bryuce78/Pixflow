import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getServerPort: (): Promise<number> => ipcRenderer.invoke('get-server-port'),
  showNotification: (title: string, body: string): void => {
    ipcRenderer.send('show-notification', title, body)
  },
  openPath: (filePath: string): Promise<string> => ipcRenderer.invoke('open-path', filePath),
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('api', api)
} else {
  // @ts-expect-error fallback for non-isolated context
  window.electron = electronAPI
  // @ts-expect-error
  window.api = api
}
