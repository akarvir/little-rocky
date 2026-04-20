export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface LLMAdapter {
  stream(messages: Message[]): AsyncGenerator<string>
}
