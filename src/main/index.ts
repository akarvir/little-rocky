import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { registerShortcuts, unregisterShortcuts } from './shortcuts'
import { startWsServer, stopWsServer } from './ws-server'

const WIN_WIDTH = 420
const DOCK_CLEARANCE = 80 // px above bottom of screen to clear the Dock

let win: BrowserWindow | null = null

function createWindow() {
  const { size } = screen.getPrimaryDisplay()

  win = new BrowserWindow({
    width: WIN_WIDTH,
    height: 120,
    x: Math.floor((size.width - WIN_WIDTH) / 2),
    y: size.height - DOCK_CLEARANCE - 120,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setIgnoreMouseEvents(true, { forward: true })
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (process.env.NODE_ENV === 'development') {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']!)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Resize window when renderer content changes height
  ipcMain.on('resize', (_e, height: number) => {
    if (!win) return
    const { size } = screen.getPrimaryDisplay()
    win.setBounds({
      width: WIN_WIDTH,
      height: Math.max(120, height),
      x: Math.floor((size.width - WIN_WIDTH) / 2),
      y: size.height - DOCK_CLEARANCE - Math.max(120, height),
    })
  })

  // Toggle click-through
  ipcMain.on('set-interactive', (_e, value: boolean) => {
    if (!win) return
    win.setIgnoreMouseEvents(!value, { forward: true })
    if (value) win.setFocusable(true)
    else win.setFocusable(false)
  })
}

app.whenReady().then(() => {
  createWindow()
  registerShortcuts(win!)
  startWsServer(win!)
})

app.on('will-quit', () => {
  unregisterShortcuts()
  stopWsServer()
})

app.on('window-all-closed', () => app.quit())
