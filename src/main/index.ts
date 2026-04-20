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
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (!devUrl) throw new Error('ELECTRON_RENDERER_URL is not set in development mode')
    win.loadURL(devUrl)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

}

app.whenReady().then(() => {
  createWindow()
  registerShortcuts(win!)
  startWsServer(win!)

  // Resize window when renderer content changes height
  ipcMain.on('resize', (_e, height: number) => {
    if (!win || win.isDestroyed()) return
    const { size } = screen.getPrimaryDisplay()
    const clampedHeight = Math.min(Math.max(120, height), size.height - DOCK_CLEARANCE)
    win.setBounds({
      width: WIN_WIDTH,
      height: clampedHeight,
      x: Math.floor((size.width - WIN_WIDTH) / 2),
      y: size.height - DOCK_CLEARANCE - clampedHeight,
    })
  })

  // Toggle click-through
  ipcMain.on('set-interactive', (_e, value: boolean) => {
    if (!win || win.isDestroyed()) return
    win.setIgnoreMouseEvents(!value, { forward: true })
    win.setFocusable(value)
  })
})

app.on('will-quit', () => {
  unregisterShortcuts()
  stopWsServer()
})

app.on('window-all-closed', () => app.quit())
