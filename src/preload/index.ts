import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('rocky', {
  onActivate: (cb: () => void) => {
    const listener = () => cb()
    ipcRenderer.on('activate', listener)
    return () => ipcRenderer.removeListener('activate', listener)
  },
  onDeactivate: (cb: () => void) => {
    const listener = () => cb()
    ipcRenderer.on('deactivate', listener)
    return () => ipcRenderer.removeListener('deactivate', listener)
  },
  onDistraction: (cb: () => void) => {
    const listener = () => cb()
    ipcRenderer.on('distraction', listener)
    return () => ipcRenderer.removeListener('distraction', listener)
  },
  setInteractive: (value: boolean) => ipcRenderer.send('set-interactive', value),
  resize: (height: number) => ipcRenderer.send('resize', height),
})
