import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      stream: vi.fn(),
    },
  })),
}))

describe('ClaudeAdapter', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('streams text_delta tokens', async () => {
    async function* fakeStreamGen() {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Carbon' } }
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' has 4' } }
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' valence electrons.' } }
      yield { type: 'message_stop' }
    }
    const fakeStream = () => Object.assign(fakeStreamGen(), { abort: vi.fn() })

    const Anthropic = (await import('@anthropic-ai/sdk')).default as any
    Anthropic.mockImplementation(function (this: any) {
      this.messages = {
        stream: vi.fn().mockReturnValue(fakeStream()),
      }
    })

    const { ClaudeAdapter } = await import('../../src/llm/claude')
    const adapter = new ClaudeAdapter('claude-haiku-4-5-20251001', 'test-key')
    const tokens: string[] = []

    for await (const token of adapter.stream([{ role: 'user', content: 'valence electrons of carbon?' }])) {
      tokens.push(token)
    }

    expect(tokens.join('')).toBe('Carbon has 4 valence electrons.')
  })

  it('skips non-text_delta events', async () => {
    async function* fakeStreamGen() {
      yield { type: 'message_start', message: {} }
      yield { type: 'content_block_start', index: 0 }
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } }
      yield { type: 'message_stop' }
    }
    const fakeStream = () => Object.assign(fakeStreamGen(), { abort: vi.fn() })

    const Anthropic = (await import('@anthropic-ai/sdk')).default as any
    Anthropic.mockImplementation(function (this: any) {
      this.messages = {
        stream: vi.fn().mockReturnValue(fakeStream()),
      }
    })

    const { ClaudeAdapter } = await import('../../src/llm/claude')
    const adapter = new ClaudeAdapter('claude-haiku-4-5-20251001', 'test-key')
    const tokens: string[] = []

    for await (const token of adapter.stream([{ role: 'user', content: 'hi' }])) {
      tokens.push(token)
    }

    expect(tokens).toEqual(['Hello'])
  })
})
