import type { AIChatInput, AIJSONInput, AIProvider } from './provider'

const OLLAMA_HOST = 'http://127.0.0.1:11434'

export type OllamaStatus = 'unreachable' | 'no-models' | 'ok'

interface OllamaChatChunk {
  message?: { content?: string }
  done?: boolean
  error?: string
}

/** Talks to a local Ollama daemon only (127.0.0.1) — nothing about note content leaves the machine. */
export class OllamaProvider implements AIProvider {
  async listModels(): Promise<{ status: OllamaStatus; models: string[] }> {
    try {
      const res = await fetch(`${OLLAMA_HOST}/api/tags`)
      if (!res.ok) return { status: 'unreachable', models: [] }
      const data = (await res.json()) as { models?: Array<{ name: string }> }
      const models = (data.models ?? []).map((m) => m.name)
      return { status: models.length > 0 ? 'ok' : 'no-models', models }
    } catch {
      return { status: 'unreachable', models: [] }
    }
  }

  async streamChat(input: AIChatInput, onDelta: (text: string) => void): Promise<string> {
    let response: Response
    try {
      response = await fetch(`${OLLAMA_HOST}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: input.model,
          stream: true,
          messages: [{ role: 'system', content: input.system }, ...input.messages]
        })
      })
    } catch {
      throw new Error('Ollama is not reachable. Make sure Ollama is installed and running.')
    }

    if (!response.ok || !response.body) {
      throw new Error(`Ollama request failed (status ${response.status}).`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let full = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        const chunk = JSON.parse(line) as OllamaChatChunk
        if (chunk.error) throw new Error(chunk.error)
        const delta = chunk.message?.content ?? ''
        if (delta) {
          full += delta
          onDelta(delta)
        }
      }
    }

    return full
  }

  /** Non-streaming request constrained to a JSON schema — used for structured data like quizzes. */
  async generateJSON(input: AIJSONInput): Promise<unknown> {
    let response: Response
    try {
      response = await fetch(`${OLLAMA_HOST}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: input.model,
          stream: false,
          format: input.schema,
          ...(input.temperature !== undefined ? { options: { temperature: input.temperature } } : {}),
          messages: [
            { role: 'system', content: input.system },
            { role: 'user', content: input.prompt }
          ]
        })
      })
    } catch {
      throw new Error('Ollama is not reachable. Make sure Ollama is installed and running.')
    }

    if (!response.ok) {
      throw new Error(`Ollama request failed (status ${response.status}).`)
    }

    const data = (await response.json()) as OllamaChatChunk
    if (data.error) throw new Error(data.error)
    const content = data.message?.content
    if (!content) throw new Error('Ollama returned an empty response.')

    try {
      return JSON.parse(content)
    } catch {
      throw new Error("Owly's response wasn't valid JSON.")
    }
  }
}
