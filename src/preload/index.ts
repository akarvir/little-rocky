import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('rocky', {
  onActivate: (cb: () => void) => {
    ipcRenderer.on('activate', cb)
    return () => ipcRenderer.removeListener('activate', cb)
  },
  onDeactivate: (cb: () => void) => {
    ipcRenderer.on('deactivate', cb)
    return () => ipcRenderer.removeListener('deactivate', cb)
  },
  onDistraction: (cb: () => void) => {
    ipcRenderer.on('distraction', cb)
    return () => ipcRenderer.removeListener('distraction', cb)
  },
  setInteractive: (value: boolean) => ipcRenderer.send('set-interactive', value),
  resize: (height: number) => ipcRenderer.send('resize', height),
})
