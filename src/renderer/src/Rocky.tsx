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
  ctx.beginPath()
  ctx.arc(cx + 5, y + 2, 2.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx - 1, y + 6, 2, 0, Math.PI * 2)
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
        if (Math.abs(xRef.current) >= WALK_RANGE) dirRef.current = (dirRef.current * -1) as 1 | -1
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
