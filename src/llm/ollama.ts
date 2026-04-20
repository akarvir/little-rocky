import type { LLMAdapter, Message } from './interface'

export class OllamaAdapter implements LLMAdapter {
  constructor(
    private model: string,
    private baseUrl = 'http://localhost:11434'
  ) {}

  async *stream(messages: Message[]): AsyncGenerator<string> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages, stream: true }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Ollama error ${res.status}: ${body}`)
    }

    if (!res.body) throw new Error('Ollama response has no body')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          let obj: { message: { content: string }; done: boolean }
          try {
            obj = JSON.parse(line)
          } catch {
            throw new Error(`Ollama stream: failed to parse line: ${line}`)
          }
          if (obj.message?.content) yield obj.message.content
          if (obj.done) return
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}
