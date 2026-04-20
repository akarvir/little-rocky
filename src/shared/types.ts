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
