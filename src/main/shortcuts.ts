import { globalShortcut, BrowserWindow } from 'electron'

export function registerShortcuts(win: BrowserWindow) {
  const ok = globalShortcut.register('CommandOrControl+Shift+Space', () => {
    win.setIgnoreMouseEvents(false, { forward: true })
    win.setFocusable(true)
    win.focus()
    win.webContents.send('activate')
  })
  if (!ok) console.warn('[shortcuts] failed to register CommandOrControl+Shift+Space')
}

export function unregisterShortcuts() {
  globalShortcut.unregisterAll()
}
