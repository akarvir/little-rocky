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

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        const obj = JSON.parse(line) as { message: { content: string }; done: boolean }
        if (obj.message?.content) yield obj.message.content
        if (obj.done) return
      }
    }

    reader.releaseLock()
  }
}
