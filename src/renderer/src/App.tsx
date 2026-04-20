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
    const adapter = await getLLMAdapter()
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
