import { globalShortcut, BrowserWindow } from 'electron'

export function registerShortcuts(win: BrowserWindow) {
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    win.webContents.send('activate')
  })
}

export function unregisterShortcuts() {
  globalShortcut.unregisterAll()
}
