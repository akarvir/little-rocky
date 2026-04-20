/// <reference types="vite/client" />

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
