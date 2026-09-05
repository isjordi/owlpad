export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AIChatInput {
  system: string
  messages: AIMessage[]
  model: string
}

export interface AIJSONInput {
  system: string
  prompt: string
  model: string
  schema: object
  temperature?: number
}

export interface AIProvider {
  streamChat(input: AIChatInput, onDelta: (text: string) => void): Promise<string>
  generateJSON(input: AIJSONInput): Promise<unknown>
}
