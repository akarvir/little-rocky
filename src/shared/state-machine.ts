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
