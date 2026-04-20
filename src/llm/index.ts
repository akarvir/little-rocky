import type { LLMAdapter } from './interface'
import { OllamaAdapter } from './ollama'

// Renderer runs in Vite context — use import.meta.env.VITE_* for env vars.
// Set VITE_LLM_PROVIDER, VITE_LLM_MODEL, VITE_ANTHROPIC_API_KEY in .env
// ClaudeAdapter import added in Task 4 once claude.ts exists.

export async function getLLMAdapter(): Promise<LLMAdapter> {
  const provider = import.meta.env.VITE_LLM_PROVIDER ?? 'ollama'
  const model = import.meta.env.VITE_LLM_MODEL ?? 'llama3'

  if (provider === 'ollama') {
    return new OllamaAdapter(model)
  }

  if (provider === 'claude') {
    const { ClaudeAdapter } = await import('./claude')
    return new ClaudeAdapter(model, import.meta.env.VITE_ANTHROPIC_API_KEY ?? '')
  }

  throw new Error(`Unknown VITE_LLM_PROVIDER: ${provider}. Use 'ollama' or 'claude'.`)
}

export type { LLMAdapter, Message } from './interface'
