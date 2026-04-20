# Little Rocky Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a macOS desktop AI companion (Rocky) that lives as a transparent overlay above the Dock, responds to a global hotkey for LLM queries, and yells at the user when they visit distracting websites.

**Architecture:** Electron (main process) manages a transparent always-on-top window, global shortcuts, and a local WebSocket server. A React renderer handles all UI: Rocky's pixel-art canvas animation, a streaming chat interface, and a yelling overlay. A browser extension connects to the WebSocket server and sends distraction events. A swappable LLM adapter (Ollama by default, Claude as alternative) handles AI queries.

**Tech Stack:** Electron 31, React 18, TypeScript 5, electron-vite 2, Vitest 1, ws 8, @anthropic-ai/sdk

---

## File Map

| File | Responsibility |
|---|---|
| `src/main/index.ts` | Electron entry: window creation, IPC routing, app lifecycle |
| `src/main/shortcuts.ts` | Global keybind registration and teardown |
| `src/main/ws-server.ts` | WebSocket server on localhost:7331, distraction cooldown enforcement |
| `src/preload/index.ts` | contextBridge: exposes typed IPC channels to renderer |
| `src/renderer/src/main.tsx` | React root mount |
| `src/renderer/src/App.tsx` | State machine wiring, conversation history, IPC event binding |
| `src/renderer/src/Rocky.tsx` | HTML Canvas sprite + animation loop |
| `src/renderer/src/Chat.tsx` | Prompt input, thought bubble, streaming response, follow-up input |
| `src/renderer/src/Alert.tsx` | YELLING flash overlay with random message + 10s auto-dismiss |
| `src/renderer/src/app.css` | Transparent background, layout, monospace font |
| `src/llm/interface.ts` | Message type + LLMAdapter interface |
| `src/llm/ollama.ts` | OllamaAdapter (streams from localhost:11434/api/chat) |
| `src/llm/claude.ts` | ClaudeAdapter (Anthropic SDK streaming) |
| `src/llm/index.ts` | Factory: reads LLM_PROVIDER env var, returns correct adapter |
| `src/shared/types.ts` | RockyState, RockyEvent, IPCEvent shared types |
| `src/shared/state-machine.ts` | Pure `transition(state, event)` function |
| `extension/manifest.json` | MV3 manifest |
| `extension/background.js` | URL monitoring + WebSocket client with auto-reconnect |
| `tests/llm/ollama.test.ts` | OllamaAdapter unit tests |
| `tests/llm/claude.test.ts` | ClaudeAdapter unit tests |
| `tests/state-machine.test.ts` | State transition unit tests |

---

## Task 1: Scaffold the project

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`, `vitest.config.ts`

- [ ] **Step 1.1: Scaffold with electron-vite**

```bash
cd /Users/anshkarvir/projects/little-rocky
npm create @quick-start/electron@latest . -- --template react-ts --skip-install
```

Expected: electron-vite template files created (package.json, src/, etc.)

- [ ] **Step 1.2: Install dependencies**

```bash
npm install
npm install ws @anthropic-ai/sdk
npm install --save-dev @types/ws vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

Expected: `node_modules/` populated, no errors.

- [ ] **Step 1.3: Add vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
})
```

- [ ] **Step 1.4: Add test script to package.json**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 1.5: Clear template boilerplate**

Delete the template content from these files (leave them as empty shells — later tasks fill them in):
- `src/main/index.ts` — keep only the import of `app` and `BrowserWindow`
- `src/renderer/src/App.tsx` — replace with `export default function App() { return null }`
- `src/renderer/src/main.tsx` — keep as-is (ReactDOM.createRoot boilerplate is correct)

Delete entirely: `src/renderer/src/assets/`, `src/renderer/src/components/`

- [ ] **Step 1.6: Add .gitignore entries**

Append to `.gitignore` (create it if absent):

```
node_modules/
out/
dist/
.superpowers/
```

- [ ] **Step 1.7: Verify dev server starts**

```bash
npm run dev
```

Expected: Electron window opens (any content). Ctrl+C to stop.

- [ ] **Step 1.8: Commit**

```bash
git add -A
git commit -m "chore: scaffold electron-vite + react-ts project"
```

---

## Task 2: Shared types + state machine

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/state-machine.ts`
- Create: `tests/state-machine.test.ts`

- [ ] **Step 2.1: Write failing state machine tests**

Create `tests/state-machine.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { transition } from '../../src/shared/state-machine'

describe('transition', () => {
  it('IDLE + ACTIVATE -> LISTENING', () => {
    expect(transition('idle', { type: 'ACTIVATE' })).toBe('listening')
  })

  it('IDLE + DISTRACTION -> YELLING', () => {
    expect(transition('idle', { type: 'DISTRACTION' })).toBe('yelling')
  })

  it('IDLE + SUBMIT stays IDLE', () => {
    expect(transition('idle', { type: 'SUBMIT' })).toBe('idle')
  })

  it('LISTENING + SUBMIT -> THINKING', () => {
    expect(transition('listening', { type: 'SUBMIT' })).toBe('thinking')
  })

  it('LISTENING + DEACTIVATE -> IDLE', () => {
    expect(transition('listening', { type: 'DEACTIVATE' })).toBe('idle')
  })

  it('THINKING + FIRST_TOKEN -> RESPONDING', () => {
    expect(transition('thinking', { type: 'FIRST_TOKEN' })).toBe('responding')
  })

  it('RESPONDING + SUBMIT -> THINKING', () => {
    expect(transition('responding', { type: 'SUBMIT' })).toBe('thinking')
  })

  it('RESPONDING + DEACTIVATE -> IDLE', () => {
    expect(transition('responding', { type: 'DEACTIVATE' })).toBe('idle')
  })

  it('YELLING + YELL_END -> IDLE', () => {
    expect(transition('yelling', { type: 'YELL_END' })).toBe('idle')
  })

  it('YELLING ignores ACTIVATE', () => {
    expect(transition('yelling', { type: 'ACTIVATE' })).toBe('yelling')
  })
})
```

- [ ] **Step 2.2: Run tests to confirm they fail**

```bash
npm test -- tests/state-machine.test.ts
```

Expected: FAIL — `Cannot find module '../../src/shared/state-machine'`

- [ ] **Step 2.3: Create shared types**

Create `src/shared/types.ts`:

```ts
export type RockyState = 'idle' | 'listening' | 'thinking' | 'responding' | 'yelling'

export type RockyEvent =
  | { type: 'ACTIVATE' }
  | { type: 'DEACTIVATE' }
  | { type: 'SUBMIT' }
  | { type: 'FIRST_TOKEN' }
  | { type: 'YELL_END' }
  | { type: 'DISTRACTION' }

export type IPCEvent =
  | { type: 'activate' }
  | { type: 'deactivate' }
  | { type: 'distraction' }
  | { type: 'set-interactive'; value: boolean }
  | { type: 'resize'; height: number }
```

- [ ] **Step 2.4: Implement the state machine**

Create `src/shared/state-machine.ts`:

```ts
import type { RockyState, RockyEvent } from './types'

export function transition(state: RockyState, event: RockyEvent): RockyState {
  switch (state) {
    case 'idle':
      if (event.type === 'ACTIVATE') return 'listening'
      if (event.type === 'DISTRACTION') return 'yelling'
      return state
    case 'listening':
      if (event.type === 'SUBMIT') return 'thinking'
      if (event.type === 'DEACTIVATE') return 'idle'
      return state
    case 'thinking':
      if (event.type === 'FIRST_TOKEN') return 'responding'
      return state
    case 'responding':
      if (event.type === 'SUBMIT') return 'thinking'
      if (event.type === 'DEACTIVATE') return 'idle'
      return state
    case 'yelling':
      if (event.type === 'YELL_END') return 'idle'
      return state
  }
}
```

- [ ] **Step 2.5: Run tests to confirm they pass**

```bash
npm test -- tests/state-machine.test.ts
```

Expected: 10 tests PASS

- [ ] **Step 2.6: Commit**

```bash
git add src/shared/ tests/state-machine.test.ts
git commit -m "feat: shared types and state machine with tests"
```

---

## Task 3: LLM interface + OllamaAdapter

**Files:**
- Create: `src/llm/interface.ts`
- Create: `src/llm/ollama.ts`
- Create: `src/llm/index.ts`
- Create: `tests/llm/ollama.test.ts`

- [ ] **Step 3.1: Write failing OllamaAdapter tests**

Create `tests/llm/ollama.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { OllamaAdapter } from '../../src/llm/ollama'

afterEach(() => vi.unstubAllGlobals())

describe('OllamaAdapter', () => {
  it('streams tokens from /api/chat', async () => {
    const lines = [
      JSON.stringify({ message: { content: 'Hello' }, done: false }),
      JSON.stringify({ message: { content: ' world' }, done: false }),
      JSON.stringify({ message: { content: '' }, done: true }),
    ].join('\n') + '\n'

    const encoder = new TextEncoder()
    const bytes = encoder.encode(lines)
    let pos = 0

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn(async () => {
            if (pos < bytes.length) {
              const chunk = bytes.slice(pos, pos + 32)
              pos += 32
              return { done: false, value: chunk }
            }
            return { done: true, value: undefined }
          }),
          releaseLock: vi.fn(),
        }),
      },
    }))

    const adapter = new OllamaAdapter('llama3')
    const tokens: string[] = []

    for await (const token of adapter.stream([{ role: 'user', content: 'Say hello' }])) {
      tokens.push(token)
    }

    expect(tokens.join('')).toBe('Hello world')
  })

  it('throws when Ollama returns non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    }))

    const adapter = new OllamaAdapter('llama3')

    await expect(async () => {
      for await (const _ of adapter.stream([{ role: 'user', content: 'hi' }])) {
        // drain
      }
    }).rejects.toThrow('Ollama error 500')
  })
})
```

- [ ] **Step 3.2: Run tests to confirm they fail**

```bash
npm test -- tests/llm/ollama.test.ts
```

Expected: FAIL — `Cannot find module '../../src/llm/ollama'`

- [ ] **Step 3.3: Create the LLM interface**

Create `src/llm/interface.ts`:

```ts
export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface LLMAdapter {
  stream(messages: Message[]): AsyncGenerator<string>
}
```

- [ ] **Step 3.4: Implement OllamaAdapter**

Create `src/llm/ollama.ts`:

```ts
import type { LLMAdapter, Message } from './interface'

export class OllamaAdapter implements LLMAdapter {
  constructor(
    private model: string,
    private baseUrl = 'http://localhost:11434'
  ) {}

  async *stream(messages: Message[]): AsyncGenerator<string> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages, stream: true }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Ollama error ${res.status}: ${body}`)
    }

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        const obj = JSON.parse(line) as { message: { content: string }; done: boolean }
        if (obj.message?.content) yield obj.message.content
        if (obj.done) return
      }
    }

    reader.releaseLock()
  }
}
```

- [ ] **Step 3.5: Run tests to confirm they pass**

```bash
npm test -- tests/llm/ollama.test.ts
```

Expected: 2 tests PASS

- [ ] **Step 3.6: Create LLM factory**

Create `src/llm/index.ts`:

```ts
import type { LLMAdapter } from './interface'
import { OllamaAdapter } from './ollama'
import { ClaudeAdapter } from './claude'

// Renderer runs in Vite context — use import.meta.env.VITE_* for env vars.
// Set VITE_LLM_PROVIDER, VITE_LLM_MODEL, VITE_ANTHROPIC_API_KEY in .env

export function getLLMAdapter(): LLMAdapter {
  const provider = import.meta.env.VITE_LLM_PROVIDER ?? 'ollama'
  const model = import.meta.env.VITE_LLM_MODEL ?? 'llama3'

  if (provider === 'ollama') {
    return new OllamaAdapter(model)
  }

  if (provider === 'claude') {
    return new ClaudeAdapter(model, import.meta.env.VITE_ANTHROPIC_API_KEY ?? '')
  }

  throw new Error(`Unknown VITE_LLM_PROVIDER: ${provider}. Use 'ollama' or 'claude'.`)
}

export type { LLMAdapter, Message } from './interface'
```

- [ ] **Step 3.7: Commit**

```bash
git add src/llm/ tests/llm/ollama.test.ts
git commit -m "feat: LLM interface + OllamaAdapter with tests"
```

---

## Task 4: ClaudeAdapter

**Files:**
- Create: `src/llm/claude.ts`
- Create: `tests/llm/claude.test.ts`

- [ ] **Step 4.1: Write failing ClaudeAdapter tests**

Create `tests/llm/claude.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

describe('ClaudeAdapter', () => {
  it('streams text_delta tokens', async () => {
    async function* fakeStream() {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Carbon' } }
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' has 4' } }
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' valence electrons.' } }
      yield { type: 'message_stop' }
    }

    vi.mock('@anthropic-ai/sdk', () => ({
      default: vi.fn().mockImplementation(() => ({
        messages: {
          stream: vi.fn().mockReturnValue(fakeStream()),
        },
      })),
    }))

    const { ClaudeAdapter } = await import('../../src/llm/claude')
    const adapter = new ClaudeAdapter('claude-haiku-4-5-20251001', 'test-key')
    const tokens: string[] = []

    for await (const token of adapter.stream([{ role: 'user', content: 'valence electrons of carbon?' }])) {
      tokens.push(token)
    }

    expect(tokens.join('')).toBe('Carbon has 4 valence electrons.')
    vi.resetModules()
  })

  it('skips non-text_delta events', async () => {
    async function* fakeStream() {
      yield { type: 'message_start', message: {} }
      yield { type: 'content_block_start', index: 0 }
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } }
      yield { type: 'message_stop' }
    }

    vi.mock('@anthropic-ai/sdk', () => ({
      default: vi.fn().mockImplementation(() => ({
        messages: { stream: vi.fn().mockReturnValue(fakeStream()) },
      })),
    }))

    const { ClaudeAdapter } = await import('../../src/llm/claude')
    const adapter = new ClaudeAdapter('claude-haiku-4-5-20251001', 'test-key')
    const tokens: string[] = []

    for await (const token of adapter.stream([{ role: 'user', content: 'hi' }])) {
      tokens.push(token)
    }

    expect(tokens).toEqual(['Hello'])
    vi.resetModules()
  })
})
```

- [ ] **Step 4.2: Run tests to confirm they fail**

```bash
npm test -- tests/llm/claude.test.ts
```

Expected: FAIL — `Cannot find module '../../src/llm/claude'`

- [ ] **Step 4.3: Implement ClaudeAdapter**

Create `src/llm/claude.ts`:

```ts
import Anthropic from '@anthropic-ai/sdk'
import type { LLMAdapter, Message } from './interface'

export class ClaudeAdapter implements LLMAdapter {
  private client: Anthropic

  constructor(
    private model: string,
    apiKey: string
  ) {
    this.client = new Anthropic({ apiKey })
  }

  async *stream(messages: Message[]): AsyncGenerator<string> {
    const streamIter = this.client.messages.stream({
      model: this.model,
      max_tokens: 2048,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    for await (const event of streamIter) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text
      }
    }
  }
}
```

- [ ] **Step 4.4: Run tests to confirm they pass**

```bash
npm test -- tests/llm/claude.test.ts
```

Expected: 2 tests PASS

- [ ] **Step 4.5: Run all tests**

```bash
npm test
```

Expected: 14 tests PASS across 3 test files.

- [ ] **Step 4.6: Commit**

```bash
git add src/llm/claude.ts tests/llm/claude.test.ts
git commit -m "feat: ClaudeAdapter with tests"
```

---

## Task 5: Electron main window

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 5.1: Replace src/main/index.ts**

```ts
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
```

- [ ] **Step 5.2: Replace src/preload/index.ts**

```ts
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
```

- [ ] **Step 5.3: Add window.rocky type declaration**

Create `src/renderer/src/env.d.ts`:

```ts
interface RockyBridge {
  onActivate: (cb: () => void) => () => void
  onDeactivate: (cb: () => void) => () => void
  onDistraction: (cb: () => void) => () => void
  setInteractive: (value: boolean) => void
  resize: (height: number) => void
}

declare global {
  interface Window {
    rocky: RockyBridge
  }
}

export {}
```

- [ ] **Step 5.4: Commit**

```bash
git add src/main/index.ts src/preload/index.ts src/renderer/src/env.d.ts
git commit -m "feat: transparent always-on-top Electron window with IPC bridge"
```

---

## Task 6: Global shortcuts + WebSocket server

**Files:**
- Create: `src/main/shortcuts.ts`
- Create: `src/main/ws-server.ts`

- [ ] **Step 6.1: Create shortcuts.ts**

```ts
import { globalShortcut, BrowserWindow } from 'electron'

export function registerShortcuts(win: BrowserWindow) {
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    win.webContents.send('activate')
  })
}

export function unregisterShortcuts() {
  globalShortcut.unregisterAll()
}
```

- [ ] **Step 6.2: Create ws-server.ts**

```ts
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
        win.webContents.send('distraction')
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
}
```

- [ ] **Step 6.3: Verify app still launches**

```bash
npm run dev
```

Expected: Electron window opens, no console errors. Ctrl+C to stop.

- [ ] **Step 6.4: Commit**

```bash
git add src/main/shortcuts.ts src/main/ws-server.ts
git commit -m "feat: global shortcuts and WebSocket distraction server"
```

---

## Task 7: Rocky canvas component

**Files:**
- Create: `src/renderer/src/Rocky.tsx`

- [ ] **Step 7.1: Create Rocky.tsx**

```tsx
import { useEffect, useRef } from 'react'
import type { RockyState } from '../../shared/types'

interface Props {
  state: RockyState
}

const FRAME_MS = 80
const WALK_SPEED = 0.8
const WALK_RANGE = 70
const CANVAS_W = 220
const CANVAS_H = 64

function getColors(state: RockyState) {
  if (state === 'yelling') {
    return { body: '#8b3a2a', shadow: '#5a1a0a', highlight: '#c05030', spot: '#e74c3c', leg: '#7a2e1a' }
  }
  if (state === 'thinking' || state === 'responding') {
    return { body: '#7a5c3a', shadow: '#5a3e22', highlight: '#9a7a52', spot: '#a78bfa', leg: '#6b4e30' }
  }
  return { body: '#7a5c3a', shadow: '#5a3e22', highlight: '#9a7a52', spot: '#2ecc71', leg: '#6b4e30' }
}

function drawRocky(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  state: RockyState,
  frame: number,
  dir: 1 | -1
) {
  const c = getColors(state)
  const bob = state === 'thinking' ? Math.sin(frame * 0.25) * 3 : 0
  const y = cy + bob

  ctx.save()
  // Mirror for left-walking direction
  if (dir === -1) {
    ctx.translate(cx * 2, 0)
    ctx.scale(-1, 1)
  }

  // Legs — drawn behind body
  ctx.strokeStyle = c.leg
  ctx.lineWidth = 3
  ctx.lineCap = 'round'

  const legPhase = state === 'idle' || state === 'yelling' ? Math.sin(frame * 0.4) * 4 : 0

  // Left side legs
  ;[
    [cx - 10, y - 4, cx - 28, y - 12 + legPhase, cx - 38, y],
    [cx - 12, y, cx - 30, y + legPhase, cx - 38, y + 12],
    [cx - 10, y + 4, cx - 26, y + 12 - legPhase, cx - 34, y + 20],
  ].forEach(([x1, y1, x2, y2, x3, y3]) => {
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.quadraticCurveTo(x2, y2, x3, y3)
    ctx.stroke()
  })

  // Right side legs
  ;[
    [cx + 10, y - 4, cx + 28, y - 12 - legPhase, cx + 38, y],
    [cx + 12, y, cx + 30, y - legPhase, cx + 38, y + 12],
    [cx + 10, y + 4, cx + 26, y + 12 + legPhase, cx + 34, y + 20],
  ].forEach(([x1, y1, x2, y2, x3, y3]) => {
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.quadraticCurveTo(x2, y2, x3, y3)
    ctx.stroke()
  })

  // Body — ellipse
  ctx.fillStyle = c.body
  ctx.beginPath()
  ctx.ellipse(cx, y, 18, 13, 0, 0, Math.PI * 2)
  ctx.fill()

  // Shadow texture
  ctx.fillStyle = c.shadow
  ctx.globalAlpha = 0.5
  ctx.beginPath()
  ctx.ellipse(cx + 5, y + 3, 10, 7, 0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // Highlight
  ctx.fillStyle = c.highlight
  ctx.globalAlpha = 0.6
  ctx.beginPath()
  ctx.ellipse(cx - 5, y - 4, 7, 5, -0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // Bioluminescent spots
  ctx.fillStyle = c.spot
  ctx.globalAlpha = 0.9
  ctx.beginPath()
  ctx.arc(cx - 6, y - 3, 3.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx + 5, y + 2, 2.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx - 1, y + 6, 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // Spot glow
  ctx.shadowColor = c.spot
  ctx.shadowBlur = 6
  ctx.fillStyle = c.spot
  ctx.globalAlpha = 0.4
  ctx.beginPath()
  ctx.arc(cx - 6, y - 3, 3.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  ctx.restore()
}

export default function Rocky({ state }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef(0)
  const xRef = useRef(0)
  const dirRef = useRef<1 | -1>(1)
  const rafRef = useRef(0)
  const lastRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick)
      if (now - lastRef.current < FRAME_MS) return
      lastRef.current = now
      frameRef.current++

      if (state === 'idle') {
        xRef.current += WALK_SPEED * dirRef.current
        if (Math.abs(xRef.current) >= WALK_RANGE) dirRef.current *= -1 as 1 | -1
      }

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      drawRocky(ctx, CANVAS_W / 2 + (state === 'idle' ? xRef.current : 0), CANVAS_H / 2, state, frameRef.current, dirRef.current)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [state])

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      style={{ display: 'block', imageRendering: 'pixelated' }}
    />
  )
}
```

- [ ] **Step 7.2: Temporarily mount Rocky in App.tsx to verify it renders**

Replace `src/renderer/src/App.tsx` with:

```tsx
import Rocky from './Rocky'

export default function App() {
  return (
    <div style={{ background: 'transparent' }}>
      <Rocky state="idle" />
    </div>
  )
}
```

- [ ] **Step 7.3: Run dev and visually verify Rocky walks**

```bash
npm run dev
```

Expected: A brown spider walks back and forth on a transparent background. Ctrl+C.

- [ ] **Step 7.4: Commit**

```bash
git add src/renderer/src/Rocky.tsx src/renderer/src/App.tsx
git commit -m "feat: Rocky pixel-art spider canvas component"
```

---

## Task 8: Chat component

**Files:**
- Create: `src/renderer/src/Chat.tsx`

- [ ] **Step 8.1: Create Chat.tsx**

```tsx
import { useRef, useEffect, KeyboardEvent } from 'react'
import type { Message } from '../../llm/interface'

interface Props {
  messages: Message[]
  streamingToken: string
  isThinking: boolean
  onSubmit: (text: string) => void
}

export default function Chat({ messages, streamingToken, isThinking, onSubmit }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [messages.length])

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputRef.current?.value.trim()) {
      onSubmit(inputRef.current.value.trim())
      inputRef.current.value = ''
    }
  }

  // Pairs of [user, assistant] for display
  const pairs: { user: string; assistant?: string }[] = []
  for (let i = 0; i < messages.length; i += 2) {
    pairs.push({
      user: messages[i].content,
      assistant: messages[i + 1]?.content,
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingBottom: 4 }}>
      {pairs.map((pair, idx) => (
        <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div className="msg-box msg-user">{pair.user}</div>
          {pair.assistant !== undefined && (
            <div className="msg-box msg-assistant">{pair.assistant}</div>
          )}
          {idx === pairs.length - 1 && !pair.assistant && streamingToken && (
            <div className="msg-box msg-assistant">{streamingToken}<span className="cursor">|</span></div>
          )}
        </div>
      ))}

      {isThinking && (
        <div className="thought-bubble">···</div>
      )}

      {!isThinking && (
        <input
          ref={inputRef}
          className="prompt-input"
          placeholder="ask rocky..."
          onKeyDown={handleKey}
          autoComplete="off"
          spellCheck={false}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 8.2: Add styles to app.css**

Replace `src/renderer/src/app.css` with:

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: transparent;
  font-family: 'Courier New', Courier, monospace;
  overflow: hidden;
  user-select: none;
}

#root {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  min-height: 100vh;
  padding-bottom: 4px;
}

.prompt-input {
  background: rgba(10, 30, 10, 0.92);
  border: 1px solid #22c55e;
  border-radius: 4px;
  color: #22c55e;
  font-family: inherit;
  font-size: 12px;
  padding: 5px 8px;
  outline: none;
  width: auto;
  min-width: 120px;
  max-width: 200px;
}

.prompt-input::placeholder {
  color: #2a4a2a;
}

.msg-box {
  border-radius: 4px;
  font-size: 11px;
  padding: 5px 8px;
  width: auto;
  min-width: 80px;
  max-width: 200px;
  word-break: break-word;
  white-space: pre-wrap;
  display: inline-block;
}

.msg-user {
  background: rgba(13, 13, 30, 0.92);
  border: 1px solid #374151;
  color: #666;
}

.msg-assistant {
  background: rgba(10, 26, 10, 0.92);
  border: 1px solid #166534;
  color: #86efac;
}

.cursor {
  color: #4ade80;
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  50% { opacity: 0; }
}

.thought-bubble {
  background: rgba(30, 27, 75, 0.95);
  border: 1px solid #4338ca;
  border-radius: 8px;
  color: #a78bfa;
  font-size: 13px;
  letter-spacing: 3px;
  padding: 4px 12px;
  margin-bottom: 2px;
}
```

- [ ] **Step 8.3: Commit**

```bash
git add src/renderer/src/Chat.tsx src/renderer/src/app.css
git commit -m "feat: Chat component with streaming display and styles"
```

---

## Task 9: Alert overlay

**Files:**
- Create: `src/renderer/src/Alert.tsx`

- [ ] **Step 9.1: Create Alert.tsx**

```tsx
import { useEffect, useState } from 'react'

const MESSAGES = [
  'THIS IS NOT THE WAY',
  'SNAP OUT OF IT.',
  'FOCUS. THIS IS NOT IT.',
  'DO NOT LINGER HERE.',
  'RETURN TO THE WORK.',
  'YOU KNOW BETTER THAN THIS.',
  'CLOSE THE TAB. NOW.',
  'THIS SERVES NOTHING.',
  'THE WORK AWAITS. GO.',
  'I SEE YOU. STOP.',
  'NOT NOW. NOT THIS.',
  'YOU WERE DOING SO WELL.',
  'THIS IS A TRAP. LEAVE.',
  'WHAT ARE YOU DOING?',
  'EYES FORWARD. MOVE.',
]

interface Props {
  active: boolean
  onDismiss: () => void
}

export default function Alert({ active, onDismiss }: Props) {
  const [message] = useState(() => MESSAGES[Math.floor(Math.random() * MESSAGES.length)])
  const [currentMessage, setCurrentMessage] = useState(message)

  useEffect(() => {
    if (!active) return
    setCurrentMessage(MESSAGES[Math.floor(Math.random() * MESSAGES.length)])

    const timer = setTimeout(onDismiss, 10_000)
    return () => clearTimeout(timer)
  }, [active, onDismiss])

  if (!active) return null

  return (
    <div
      onClick={onDismiss}
      style={{
        background: 'rgba(26, 0, 0, 0.96)',
        border: '2px solid #ef4444',
        borderRadius: 4,
        boxShadow: '0 0 24px rgba(239, 68, 68, 0.6)',
        color: '#ef4444',
        cursor: 'pointer',
        fontFamily: "'Courier New', monospace",
        fontSize: 15,
        fontWeight: 'bold',
        letterSpacing: 3,
        marginBottom: 8,
        padding: '10px 18px',
        textAlign: 'center',
        userSelect: 'none',
      }}
    >
      {currentMessage}
    </div>
  )
}
```

- [ ] **Step 9.2: Commit**

```bash
git add src/renderer/src/Alert.tsx
git commit -m "feat: Alert overlay with 15-message pool and 10s auto-dismiss"
```

---

## Task 10: App.tsx — wire everything together

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/main.tsx`

- [ ] **Step 10.1: Replace App.tsx**

```tsx
import { useEffect, useRef, useReducer, useCallback } from 'react'
import Rocky from './Rocky'
import Chat from './Chat'
import Alert from './Alert'
import { transition } from '../../shared/state-machine'
import type { RockyState, RockyEvent } from '../../shared/types'
import type { Message } from '../../llm/interface'

interface AppState {
  rocky: RockyState
  messages: Message[]
  streaming: string
}

type Action =
  | { type: 'EVENT'; event: RockyEvent }
  | { type: 'TOKEN'; token: string }
  | { type: 'STREAM_DONE'; fullText: string }
  | { type: 'ADD_USER_MSG'; content: string }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'EVENT':
      return {
        ...state,
        rocky: transition(state.rocky, action.event),
        messages: action.event.type === 'DEACTIVATE' ? [] : state.messages,
        streaming: action.event.type === 'DEACTIVATE' ? '' : state.streaming,
      }
    case 'TOKEN':
      return { ...state, streaming: state.streaming + action.token }
    case 'STREAM_DONE':
      return {
        ...state,
        messages: [...state.messages, { role: 'assistant', content: action.fullText }],
        streaming: '',
      }
    case 'ADD_USER_MSG':
      return {
        ...state,
        messages: [...state.messages, { role: 'user', content: action.content }],
      }
  }
}

const initialState: AppState = { rocky: 'idle', messages: [], streaming: '' }

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const rootRef = useRef<HTMLDivElement>(null)
  const streamingRef = useRef('')

  // Resize window to match content height
  useEffect(() => {
    if (!rootRef.current) return
    const height = rootRef.current.scrollHeight
    window.rocky.resize(height)
  })

  // Toggle window interactivity based on state
  useEffect(() => {
    const interactive = state.rocky !== 'idle'
    window.rocky.setInteractive(interactive)
  }, [state.rocky])

  // IPC listeners
  useEffect(() => {
    const offActivate = window.rocky.onActivate(() => {
      dispatch({ type: 'EVENT', event: { type: 'ACTIVATE' } })
    })
    const offDistraction = window.rocky.onDistraction(() => {
      dispatch({ type: 'EVENT', event: { type: 'DISTRACTION' } })
    })

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dispatch({ type: 'EVENT', event: { type: 'DEACTIVATE' } })
      }
    }
    window.addEventListener('keydown', handleEsc)

    return () => {
      offActivate()
      offDistraction()
      window.removeEventListener('keydown', handleEsc)
    }
  }, [])

  const handleSubmit = useCallback(async (text: string) => {
    dispatch({ type: 'ADD_USER_MSG', content: text })
    dispatch({ type: 'EVENT', event: { type: 'SUBMIT' } })

    // Dynamic import so this runs in renderer context only
    const { getLLMAdapter } = await import('../../llm/index')
    const adapter = getLLMAdapter()
    const newMessages: Message[] = [
      ...state.messages,
      { role: 'user', content: text },
    ]

    streamingRef.current = ''
    let firstToken = true

    for await (const token of adapter.stream(newMessages)) {
      if (firstToken) {
        dispatch({ type: 'EVENT', event: { type: 'FIRST_TOKEN' } })
        firstToken = false
      }
      streamingRef.current += token
      dispatch({ type: 'TOKEN', token })
    }

    dispatch({ type: 'STREAM_DONE', fullText: streamingRef.current })
  }, [state.messages])

  const handleYellDismiss = useCallback(() => {
    dispatch({ type: 'EVENT', event: { type: 'YELL_END' } })
  }, [])

  const isThinking = state.rocky === 'thinking'
  const showChat = state.rocky !== 'idle' && state.rocky !== 'yelling'

  // Chat always renders ABOVE Rocky so it grows upward per spec.
  // isThinking hides the input and shows the thought bubble instead.
  return (
    <div ref={rootRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {state.rocky === 'yelling' && (
        <Alert active={true} onDismiss={handleYellDismiss} />
      )}
      {showChat && (
        <Chat
          messages={state.messages}
          streamingToken={state.streaming}
          isThinking={isThinking}
          onSubmit={handleSubmit}
        />
      )}
      <Rocky state={state.rocky} />
    </div>
  )
}
```

- [ ] **Step 10.2: Ensure main.tsx imports app.css**

Verify `src/renderer/src/main.tsx` contains:

```tsx
import './app.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 10.3: Verify full app flow**

```bash
npm run dev
```

Manually verify:
1. Rocky walks back and forth on transparent background
2. Press `Cmd+Shift+Space` — Rocky stops, prompt box appears
3. Type a question, press Enter — thought bubble appears
4. Response streams in below the question
5. Press Escape — Rocky returns to walking, chat clears

- [ ] **Step 10.4: Commit**

```bash
git add src/renderer/src/App.tsx src/renderer/src/main.tsx
git commit -m "feat: App.tsx wires state machine, LLM streaming, and IPC"
```

---

## Task 11: Browser extension

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/background.js`
- Create: `extension/icons/icon16.png` (placeholder — 16×16 green pixel, create manually)
- Create: `extension/icons/icon48.png` (placeholder — 48×48 green pixel, create manually)
- Create: `extension/icons/icon128.png` (placeholder — 128×128 green pixel, create manually)

- [ ] **Step 11.1: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "Little Rocky Guardian",
  "version": "1.0.0",
  "description": "Notifies Rocky when you visit distracting sites.",
  "permissions": ["tabs", "webNavigation"],
  "background": {
    "service_worker": "background.js"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 11.2: Create background.js**

```js
const WS_URL = 'ws://127.0.0.1:7331'
const BLOCKLIST = ['twitter.com', 'x.com', 'youtube.com', 'instagram.com', 'tiktok.com']
const RECONNECT_DELAY_MS = 3000

let ws = null

function isBlocked(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return BLOCKLIST.some(b => host === b || host.endsWith(`.${b}`))
  } catch {
    return false
  }
}

function connect() {
  try {
    ws = new WebSocket(WS_URL)

    ws.addEventListener('open', () => {
      console.log('[rocky-ext] connected')
    })

    ws.addEventListener('close', () => {
      ws = null
      setTimeout(connect, RECONNECT_DELAY_MS)
    })

    ws.addEventListener('error', () => {
      ws?.close()
    })
  } catch {
    setTimeout(connect, RECONNECT_DELAY_MS)
  }
}

function notify(url) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify({ type: 'distraction', url }))
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && isBlocked(tab.url)) {
    notify(tab.url)
  }
})

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (tab.url && isBlocked(tab.url)) notify(tab.url)
  })
})

connect()
```

- [ ] **Step 11.3: Create placeholder icons**

```bash
# Create minimal 1x1 green PNG for each icon size using Node
node -e "
const { createCanvas } = require('canvas');
const fs = require('fs');
[16, 48, 128].forEach(size => {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(0, 0, size, size);
  fs.writeFileSync('extension/icons/icon' + size + '.png', c.toBuffer('image/png'));
});
" 2>/dev/null || echo "canvas not available — create icons/icon16.png, icon48.png, icon128.png manually as any small green PNG"
```

If the above fails, create any small PNG files manually and place them at `extension/icons/icon16.png`, `extension/icons/icon48.png`, `extension/icons/icon128.png`.

- [ ] **Step 11.4: Load extension in Chrome and test**

1. Open Chrome → `chrome://extensions`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked" → select the `extension/` directory
4. Open Twitter or YouTube
5. Expected: Rocky turns red and yells within ~1 second

- [ ] **Step 11.5: Commit**

```bash
git add extension/
git commit -m "feat: browser extension for distraction detection"
```

---

## Task 12: Final polish + build

**Files:**
- Create: `.env.example`
- Modify: `package.json` (add build script env)

- [ ] **Step 12.1: Create .env.example**

```bash
cat > .env.example << 'EOF'
# LLM provider: 'ollama' (default) or 'claude'
# Vite exposes VITE_* vars to the renderer via import.meta.env
VITE_LLM_PROVIDER=ollama

# Model name (for Ollama: llama3, mistral, etc. For Claude: claude-haiku-4-5-20251001)
VITE_LLM_MODEL=llama3

# Required only when VITE_LLM_PROVIDER=claude
VITE_ANTHROPIC_API_KEY=
EOF
```

Also copy to `.env` so it works in dev immediately:

```bash
cp .env.example .env
```

- [ ] **Step 12.2: Verify full production build**

```bash
npm run build
```

Expected: `out/` directory created, no TypeScript errors.

- [ ] **Step 12.3: Run all tests one final time**

```bash
npm test
```

Expected: 14 tests PASS across 3 files.

- [ ] **Step 12.4: Final commit**

```bash
git add .env.example
git commit -m "chore: add .env.example and verify production build"
```
