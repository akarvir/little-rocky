import { describe, it, expect, vi, afterEach } from 'vitest'
import { OllamaAdapter } from '../../src/llm/ollama'

afterEach(() => vi.unstubAllGlobals())

describe('OllamaAdapter', () => {
  it('streams tokens from /api/chat', async () => {
    const lines = [
      JSON.stringify({ message: { content: 'Hello' }, done: false }),
      JSON.stringify({ message: { content: ' world' }, done: false }),
      JSON.stringify({ message: { content: '' }, done: true }),
    ].join('\n') + '\n'

    const encoder = new TextEncoder()
    const bytes = encoder.encode(lines)
    let pos = 0

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn(async () => {
            if (pos < bytes.length) {
              const chunk = bytes.slice(pos, pos + 32)
              pos += 32
              return { done: false, value: chunk }
            }
            return { done: true, value: undefined }
          }),
          releaseLock: vi.fn(),
        }),
      },
    }))

    const adapter = new OllamaAdapter('llama3')
    const tokens: string[] = []

    for await (const token of adapter.stream([{ role: 'user', content: 'Say hello' }])) {
      tokens.push(token)
    }

    expect(tokens.join('')).toBe('Hello world')
  })

  it('throws when Ollama returns non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    }))

    const adapter = new OllamaAdapter('llama3')

    await expect(async () => {
      for await (const _ of adapter.stream([{ role: 'user', content: 'hi' }])) {
        // drain
      }
    }).rejects.toThrow('Ollama error 500')
  })
})
