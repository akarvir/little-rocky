# Little Rocky — Design Spec

**Date:** 2026-04-20
**Status:** Approved

## Overview

Little Rocky is a macOS desktop AI companion modeled after Rocky from Project Hail Mary. It lives as a transparent always-on-top overlay window floating just above the macOS Dock. It paces back and forth when idle, responds to a global hotkey for AI queries, and yells at the user when they visit distracting websites.

---

## Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron (macOS only) |
| UI | React + TypeScript |
| Sprite animation | HTML Canvas (sprite sheet) |
| LLM backend | Ollama (local, default) or Claude API (swappable) |
| Browser monitoring | Chrome/Firefox WebExtension (Manifest V3) |
| Extension communication | WebSocket server on localhost:7331 |

---

## System Architecture

### Electron Main Process

- Creates a transparent, frameless `BrowserWindow` positioned above the Dock
- `alwaysOnTop: true` with level `screen-saver`
- `transparent: true`, `hasShadow: false`
- `setIgnoreMouseEvents(true, { forward: true })` in IDLE state; disabled when active
- Registers global shortcut (`Cmd+Shift+Space`) via `globalShortcut`
- Runs a WebSocket server on `localhost:7331` to receive events from the browser extension
- Forwards extension events to the renderer via Electron IPC (`ipcMain` / `ipcRenderer`)

### React Renderer

Renders all visible UI. Contains three top-level components:

- `Rocky` — HTML Canvas sprite with animation state machine
- `Chat` — prompt input, thought bubble, streaming response, follow-up input
- `Alert` — fullscreen flash overlay for YELLING state

### LLM Adapter

A thin TypeScript interface that decouples the UI from the LLM provider.

```ts
interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface LLMAdapter {
  stream(messages: Message[]): AsyncGenerator<string>
}
```

Two implementations:

- `OllamaAdapter` — POSTs to `http://localhost:11434/api/generate` with `stream: true`
- `ClaudeAdapter` — uses the Anthropic SDK with streaming enabled

Active adapter is selected via the `LLM_PROVIDER` environment variable (`ollama` | `claude`). Default is `ollama`.

### Browser Extension (Manifest V3)

- `background.js` listens to `chrome.tabs.onUpdated` and `chrome.tabs.onActivated`
- On each URL change, checks against a hardcoded blocklist: `twitter.com`, `x.com`, `youtube.com`, `instagram.com`, `tiktok.com`
- On match, sends `{ type: "distraction", url }` over WebSocket to `localhost:7331`
- Reconnects automatically if the WebSocket drops
- The 60-second cooldown is enforced in the Electron main process, not the extension — the extension always sends events; main process ignores them during cooldown

---

## Rocky: Sprite Design

Rocky is a pixel-art spider character rendered at **64×48px per frame** on an HTML Canvas.

- Brown rocky body with cracked texture
- 6 legs
- Green bioluminescent spots (turn red in YELLING state)

### Sprite Sheet Layout

| Row | Animation | Frames |
|---|---|---|
| 0 | Walk left | 6 |
| 1 | Walk right | 6 |
| 2 | Idle / facing forward | 2 |
| 3 | Ponder bob | 4 |
| 4 | Yell / angry | 4 |

---

## State Machine

Rocky has five states. Only one is active at a time.

### IDLE

- Rocky walks left and right on loop using the walk animation
- The Electron window is fully click-through (`setIgnoreMouseEvents(true)`)
- No UI elements visible
- Transitions:
  - `Cmd+Shift+Space` keybind → LISTENING
  - WebSocket distraction event → YELLING

### LISTENING

- Rocky stops, plays idle/forward frames
- A snug prompt input box appears above Rocky's head
- Window accepts mouse events
- Transitions:
  - Enter / submit button → THINKING
  - Escape → IDLE

### THINKING

- Rocky plays the ponder bob animation
- A thought bubble floats upward with a `···` indicator
- The submitted prompt is displayed above the bubble (dimmed)
- LLM streaming begins in the background
- Transitions:
  - First token received → RESPONDING

### RESPONDING

- Response streams token-by-token into a variable-height box below the prompt
- Both prompt and response boxes are auto-width (hug content), grow vertically, capped at ~200px wide
- A follow-up prompt input appears below the response once the stream ends
- Conversation history is maintained as a `Message[]` array in `App.tsx` state, passed to the LLM adapter on each new submission
- Transitions:
  - New submit → THINKING (appends to conversation history)
  - Escape → IDLE (clears chat history)

### YELLING

- Rocky switches to the angry animation (red body, red spots, splayed legs)
- A pixel-art alert box flashes on screen with a randomly selected message from:
  - "THIS IS NOT THE WAY"
  - "SNAP OUT OF IT."
  - "FOCUS. THIS IS NOT IT."
  - "DO NOT LINGER HERE."
  - "RETURN TO THE WORK."
  - "YOU KNOW BETTER THAN THIS."
  - "CLOSE THE TAB. NOW."
  - "THIS SERVES NOTHING."
  - "THE WORK AWAITS. GO."
  - "I SEE YOU. STOP."
  - "NOT NOW. NOT THIS."
  - "YOU WERE DOING SO WELL."
  - "THIS IS A TRAP. LEAVE."
  - "WHAT ARE YOU DOING?"
  - "EYES FORWARD. MOVE."
- Duration: **10 seconds**, then auto-dismisses
- Can be dismissed early by clicking the alert box
- Cooldown: 60 seconds before the extension can trigger YELLING again
- Transitions:
  - After 10s or click → IDLE

---

## UI Layout

The overlay window is anchored to the bottom center of the screen, just above the Dock.

- Rocky is always pinned to the bottom of the window
- Chat UI grows upward from Rocky, never covering the sprite
- Window height expands dynamically to fit the chat content
- All chat boxes (prompt, response, follow-up) are inline-width, hug their content, and grow taller rather than wider

---

## File Structure

```
little-rocky/
├── src/
│   ├── main/
│   │   ├── index.ts          # Electron entry point, window creation
│   │   ├── shortcuts.ts      # Global keybind registration
│   │   └── ws-server.ts      # WebSocket server (localhost:7331)
│   ├── renderer/
│   │   ├── App.tsx           # Root component, state machine wiring
│   │   ├── Rocky.tsx         # Sprite canvas + animation controller
│   │   ├── Chat.tsx          # Prompt input + streaming response UI
│   │   └── Alert.tsx         # YELLING flash overlay
│   ├── llm/
│   │   ├── interface.ts      # LLMAdapter interface
│   │   ├── ollama.ts         # OllamaAdapter
│   │   └── claude.ts         # ClaudeAdapter
│   └── shared/
│       └── types.ts          # Shared IPC event types (main <-> renderer)
├── extension/
│   ├── manifest.json         # MV3 manifest
│   ├── background.js         # URL monitoring + WebSocket client
│   └── icons/
├── assets/
│   └── rocky-sprites.png     # Pixel art sprite sheet (64×48px per frame)
├── docs/
│   └── superpowers/specs/
│       └── 2026-04-20-little-rocky-design.md
└── CLAUDE.md
```

---

## Key Design Decisions

- **Electron over Tauri** — pure TypeScript throughout, no Rust required. Binary size and RAM usage are acceptable for a personal tool.
- **LLM adapter pattern** — single interface swapped via env var. No UI changes needed to switch between Ollama and Claude.
- **Browser extension over Accessibility API** — more reliable across browsers, no accessibility permission dialogs, user accepts one-time install.
- **Chat boxes hug content** — auto-width with a ~200px cap, growing vertically. Keeps the UI compact and avoids covering the desktop.
- **10s yell with 60s cooldown** — loud enough to interrupt, short enough not to be annoying, with a cooldown to prevent spam.
