import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn(function (this: any, config: any) {
      this.messages = {
        stream: vi.fn(),
      }
    }),
  }
})

describe('ClaudeAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('streams text_delta tokens', async () => {
    async function* fakeStream() {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Carbon' } }
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' has 4' } }
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' valence electrons.' } }
      yield { type: 'message_stop' }
    }

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
    async function* fakeStream() {
      yield { type: 'message_start', message: {} }
      yield { type: 'content_block_start', index: 0 }
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } }
      yield { type: 'message_stop' }
    }

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
