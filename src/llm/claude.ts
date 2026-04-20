import Anthropic from '@anthropic-ai/sdk'
import type { LLMAdapter, Message } from './interface'

export class ClaudeAdapter implements LLMAdapter {
  private client: Anthropic

  constructor(
    private model: string,
    apiKey: string
  ) {
    this.client = new Anthropic({ apiKey })
  }

  async *stream(messages: Message[]): AsyncGenerator<string> {
    const streamIter = this.client.messages.stream({
      model: this.model,
      max_tokens: 2048,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    for await (const event of streamIter) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text
      }
    }
  }
}
