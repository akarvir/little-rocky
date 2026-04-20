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
          {idx === pairs.length - 1 && pair.assistant === undefined && streamingToken && (
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
