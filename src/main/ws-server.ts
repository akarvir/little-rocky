import { WebSocketServer, WebSocket } from 'ws'
import { BrowserWindow } from 'electron'

const PORT = 7331
const YELL_COOLDOWN_MS = 60_000
const BLOCKLIST = ['twitter.com', 'x.com', 'youtube.com', 'instagram.com', 'tiktok.com']

let wss: WebSocketServer | null = null
let lastYellAt = 0

function isBlocked(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return BLOCKLIST.some(b => host === b || host.endsWith(`.${b}`))
  } catch {
    return false
  }
}

export function startWsServer(win: BrowserWindow) {
  if (wss) return
  wss = new WebSocketServer({ port: PORT, host: '127.0.0.1' })

  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', (raw) => {
      let msg: { type: string; url?: string }
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }

      if (msg.type === 'distraction' && msg.url && isBlocked(msg.url)) {
        const now = Date.now()
        if (now - lastYellAt < YELL_COOLDOWN_MS) return
        lastYellAt = now
        if (!win.isDestroyed()) win.webContents.send('distraction')
      }

      if (msg.type === 'distraction_end') {
        lastYellAt = 0
        if (!win.isDestroyed()) win.webContents.send('distraction_end')
      }
    })
  })

  wss.on('error', (err) => {
    if ((err as NodeJS.ErrnoException).code !== 'EADDRINUSE') {
      console.error('[ws-server]', err)
    }
  })
}

export function stopWsServer() {
  wss?.close()
  wss = null
}
