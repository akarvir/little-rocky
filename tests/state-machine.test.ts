import { describe, it, expect } from 'vitest'
import { transition } from '../src/shared/state-machine'

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
