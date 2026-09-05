export interface NoteMeta {
  id: string
  section: string
  subject: string
  title: string
  path: string
  createdAt: string
  updatedAt: string
}

export interface Note extends NoteMeta {
  body: string
}

export interface VaultTree {
  [subject: string]: {
    [title: string]: NoteMeta[]
  }
}

export interface AppConfig {
  vaultPath: string | null
  hasPin: boolean
}

export interface SearchResult {
  id: string
  section: string
  subject: string
  title: string
  snippet: string
}

export interface UnlockResult {
  ok: boolean
  error?: string
  lockedForMs?: number
}

export interface NewNoteInput {
  section: string
  subject: string
  title: string
  body?: string
}

export interface UpdateNoteInput {
  section?: string
  body?: string
}

export type AIRole = 'user' | 'assistant'

export interface AIMessage {
  role: AIRole
  content: string
}

export interface AISettings {
  model: string | null
}

export type AIModelsStatus = 'unreachable' | 'no-models' | 'ok'

export interface AIModelsResult {
  status: AIModelsStatus
  models: string[]
}

export interface AINoteContext {
  subject: string
  title: string
  section: string
  body: string
}

export interface AskOwlyInput {
  noteContext: AINoteContext | null
  history: AIMessage[]
}

export interface ParaphraseInput {
  history: AIMessage[]
}

export type AISetupStage = 'checking' | 'installing' | 'starting' | 'pulling' | 'done'

export interface AISetupProgress {
  stage: AISetupStage
  message: string
  percent?: number
}

export interface AISetupResult {
  ok: boolean
  error?: string
}

export interface QuizQuestion {
  question: string
  options: string[]
  correctIndex: number
  explanation?: string
}

export interface QuizGenerateInput {
  noteContext: AINoteContext
  count?: number
}

export interface FlashCard {
  question: string
  answer: string
}

export interface FlashcardsGenerateInput {
  noteContext: AINoteContext
  count?: number
}

export interface Insight {
  fact: string
}

export interface InsightsGenerateInput {
  noteContext: AINoteContext
  existingFacts?: string[]
}

export interface OwlPadAPI {
  platform: string
  getConfig(): Promise<AppConfig>
  chooseVaultFolder(): Promise<string | null>
  setVaultFolder(path: string): Promise<AppConfig>
  hasPin(): Promise<boolean>
  setPin(pin: string): Promise<void>
  verifyPin(pin: string): Promise<UnlockResult>
  changePin(currentPin: string, newPin: string): Promise<UnlockResult>
  listVault(): Promise<VaultTree>
  readNote(id: string): Promise<Note | null>
  createNote(input: NewNoteInput): Promise<Note>
  updateNote(id: string, patch: UpdateNoteInput): Promise<Note>
  deleteNote(id: string): Promise<void>
  deleteTitle(subject: string, title: string): Promise<void>
  renameTitle(subject: string, oldTitle: string, newTitle: string): Promise<void>
  deleteSubject(subject: string): Promise<void>
  searchNotes(query: string): Promise<SearchResult[]>
  getAISettings(): Promise<AISettings>
  setAIModel(model: string): Promise<AISettings>
  listAIModels(): Promise<AIModelsResult>
  askOwly(requestId: string, input: AskOwlyInput): Promise<string>
  onOwlyChunk(callback: (requestId: string, delta: string) => void): () => void
  askParaphrase(requestId: string, input: ParaphraseInput): Promise<string>
  onParaphraseChunk(callback: (requestId: string, delta: string) => void): () => void
  setupOwly(): Promise<AISetupResult>
  onOwlySetupProgress(callback: (progress: AISetupProgress) => void): () => void
  generateQuiz(input: QuizGenerateInput): Promise<QuizQuestion[]>
  generateFlashcards(input: FlashcardsGenerateInput): Promise<FlashCard[]>
  generateInsights(input: InsightsGenerateInput): Promise<Insight[]>
}
