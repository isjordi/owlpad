import { contextBridge, ipcRenderer } from 'electron'
import type {
  AISetupProgress,
  AskOwlyInput,
  FlashcardsGenerateInput,
  InsightsGenerateInput,
  NewNoteInput,
  OwlPadAPI,
  ParaphraseInput,
  QuizGenerateInput,
  UpdateNoteInput
} from '../shared/types'

const api: OwlPadAPI = {
  platform: process.platform,
  getConfig: () => ipcRenderer.invoke('config:get'),
  chooseVaultFolder: () => ipcRenderer.invoke('vault:choose-folder'),
  setVaultFolder: (p: string) => ipcRenderer.invoke('vault:set-folder', p),
  hasPin: () => ipcRenderer.invoke('pin:has'),
  setPin: (pin: string) => ipcRenderer.invoke('pin:set', pin),
  verifyPin: (pin: string) => ipcRenderer.invoke('pin:verify', pin),
  changePin: (currentPin: string, newPin: string) =>
    ipcRenderer.invoke('pin:change', currentPin, newPin),
  listVault: () => ipcRenderer.invoke('vault:list'),
  readNote: (id: string) => ipcRenderer.invoke('notes:read', id),
  createNote: (input: NewNoteInput) => ipcRenderer.invoke('notes:create', input),
  updateNote: (id: string, patch: UpdateNoteInput) => ipcRenderer.invoke('notes:update', id, patch),
  deleteNote: (id: string) => ipcRenderer.invoke('notes:delete', id),
  deleteTitle: (subject: string, title: string) => ipcRenderer.invoke('titles:delete', subject, title),
  renameTitle: (subject: string, oldTitle: string, newTitle: string) =>
    ipcRenderer.invoke('titles:rename', subject, oldTitle, newTitle),
  deleteSubject: (subject: string) => ipcRenderer.invoke('subjects:delete', subject),
  searchNotes: (query: string) => ipcRenderer.invoke('notes:search', query),
  getAISettings: () => ipcRenderer.invoke('ai:get-settings'),
  setAIModel: (model: string) => ipcRenderer.invoke('ai:set-model', model),
  listAIModels: () => ipcRenderer.invoke('ai:list-models'),
  askOwly: (requestId: string, input: AskOwlyInput) => ipcRenderer.invoke('owly:ask', requestId, input),
  onOwlyChunk: (callback: (requestId: string, delta: string) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, requestId: string, delta: string): void =>
      callback(requestId, delta)
    ipcRenderer.on('owly:chunk', listener)
    return () => ipcRenderer.removeListener('owly:chunk', listener)
  },
  askParaphrase: (requestId: string, input: ParaphraseInput) =>
    ipcRenderer.invoke('paraphrase:ask', requestId, input),
  onParaphraseChunk: (callback: (requestId: string, delta: string) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, requestId: string, delta: string): void =>
      callback(requestId, delta)
    ipcRenderer.on('paraphrase:chunk', listener)
    return () => ipcRenderer.removeListener('paraphrase:chunk', listener)
  },
  setupOwly: () => ipcRenderer.invoke('ai:setup'),
  onOwlySetupProgress: (callback: (progress: AISetupProgress) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, progress: AISetupProgress): void =>
      callback(progress)
    ipcRenderer.on('owly:setup-progress', listener)
    return () => ipcRenderer.removeListener('owly:setup-progress', listener)
  },
  generateQuiz: (input: QuizGenerateInput) => ipcRenderer.invoke('quiz:generate', input),
  generateFlashcards: (input: FlashcardsGenerateInput) =>
    ipcRenderer.invoke('flashcards:generate', input),
  generateInsights: (input: InsightsGenerateInput) => ipcRenderer.invoke('insights:generate', input)
}

contextBridge.exposeInMainWorld('owlpad', api)
