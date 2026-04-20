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
  const [currentMessage, setCurrentMessage] = useState(() => MESSAGES[Math.floor(Math.random() * MESSAGES.length)])

  useEffect(() => {
    if (!active) return
    setCurrentMessage(MESSAGES[Math.floor(Math.random() * MESSAGES.length)])

    const interval = setInterval(() => {
      setCurrentMessage(prev => {
        let next: string
        do { next = MESSAGES[Math.floor(Math.random() * MESSAGES.length)] } while (next === prev)
        return next
      })
    }, 3000)

    return () => clearInterval(interval)
  }, [active])

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
