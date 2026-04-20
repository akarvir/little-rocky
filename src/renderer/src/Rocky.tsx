import { useEffect, useRef } from 'react'
import type { RockyState } from '../../shared/types'

interface Props {
  state: RockyState
}

const FRAME_MS = 80
const WALK_SPEED = 0.9
const WALK_RANGE = 80
const CANVAS_W = 240
const CANVAS_H = 80
const P = 6 // pixels per grid cell

// 11×10 pixel-art diamond/cross sprite
// 0=transparent 1=body(navy) 2=cyan 3=highlight-cyan 4=shadow-cyan
const SPRITE = [
  [0,0,0,3,3,3,3,3,0,0,0],
  [0,0,3,2,1,1,1,2,3,0,0],
  [0,3,2,1,1,2,1,1,2,3,0],
  [3,2,1,1,2,2,2,1,1,2,3],
  [2,1,1,2,2,2,2,2,1,1,2],
  [2,1,1,2,2,2,2,2,1,1,2],
  [4,2,1,1,2,2,2,1,1,2,4],
  [0,4,2,1,1,2,1,1,2,4,0],
  [0,0,4,2,1,1,1,2,4,0,0],
  [0,0,0,4,4,4,4,4,0,0,0],
]
const SW = SPRITE[0].length  // 11
const SH = SPRITE.length     // 10

function getPalette(state: RockyState) {
  if (state === 'yelling') return ['', '#3a0000', '#ef4444', '#ff9090', '#660000']
  if (state === 'thinking' || state === 'responding') return ['', '#120a3a', '#a78bfa', '#ddd6fe', '#2d1b69']
  return ['', '#0d1a4a', '#00d4ff', '#b0f0ff', '#004466']
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  state: RockyState,
  frame: number,
) {
  const palette = getPalette(state)
  const glowColor = palette[2]

  const bob = state === 'thinking'
    ? Math.sin(frame * 0.3) * 4
    : state === 'idle'
    ? Math.sin(frame * 0.15) * 1.5
    : 0

  const shake = state === 'yelling' ? (frame % 2 === 0 ? 1 : -1) : 0

  const ox = Math.round(cx - (SW * P) / 2) + shake
  const oy = Math.round(cy - (SH * P) / 2 + bob)

  // Ambient glow beneath sprite
  ctx.save()
  ctx.shadowColor = glowColor
  ctx.shadowBlur = 16
  ctx.globalAlpha = 0.25
  ctx.fillStyle = glowColor
  ctx.fillRect(ox + P, oy + P, (SW - 2) * P, (SH - 2) * P)
  ctx.restore()

  // Draw pixel grid
  for (let row = 0; row < SH; row++) {
    for (let col = 0; col < SW; col++) {
      const v = SPRITE[row][col]
      if (v === 0) continue
      ctx.fillStyle = palette[v]
      ctx.fillRect(ox + col * P, oy + row * P, P, P)
    }
  }

  // Pulsing center glow on border pixels
  const pulse = (Math.sin(frame * 0.2) + 1) / 2
  ctx.save()
  ctx.globalAlpha = 0.15 + pulse * 0.2
  ctx.shadowColor = glowColor
  ctx.shadowBlur = 8
  ctx.fillStyle = glowColor
  for (let row = 0; row < SH; row++) {
    for (let col = 0; col < SW; col++) {
      if (SPRITE[row][col] === 2) {
        ctx.fillRect(ox + col * P, oy + row * P, P, P)
      }
    }
  }
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
        if (Math.abs(xRef.current) >= WALK_RANGE) {
          dirRef.current = (dirRef.current * -1) as 1 | -1
        }
      }

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      const cx = CANVAS_W / 2 + (state === 'idle' ? xRef.current : 0)
      drawSprite(ctx, cx, CANVAS_H * 0.55, state, frameRef.current)
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
