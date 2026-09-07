import { app, ipcMain, dialog, BrowserWindow } from 'electron'
import path from 'node:path'
import { ConfigStore } from '../vault/config'
import { resetIfReinstalled } from '../vault/freshInstall'
import { PinStore } from '../security/pin'
import { VaultManager } from '../vault/notes'
import { SearchIndex } from '../vault/search'
import { AISettingsStore } from '../ai/settings'
import { OllamaProvider } from '../ai/ollama'
import { setupOwly, DEFAULT_OLLAMA_MODEL } from '../ai/setup'
import { generateQuiz } from '../ai/quiz'
import { generateFlashcards } from '../ai/flashcards'
import { generateInsights } from '../ai/insights'
import type {
  NewNoteInput,
  UpdateNoteInput,
  AskOwlyInput,
  QuizGenerateInput,
  FlashcardsGenerateInput,
  InsightsGenerateInput,
  ParaphraseInput
} from '../../shared/types'

const OWLY_SYSTEM_PROMPT = `You are Owly, a friendly study assistant built into OwlPAD, a Markdown note-taking app for students. Help the student understand, review, and study their notes. Be concise, encouraging, and accurate — if you don't know something, say so rather than guessing.`

const PARAPHRASE_SYSTEM_PROMPT = `You are Owly's Paraphrase tool, built into OwlPAD. Your only job is to take text the student pastes in and rewrite it into clear, well-organized study notes — not a shortened restatement of every sentence.

First, identify the source's most important key points: core claims, definitions, cause-effect relationships, and any figures/names/dates that a fact would be incomplete without. Drop filler, repetition, tangents, and examples that don't add new information. Never invent information that isn't in the source text, and never add your own opinions or commentary.

Then output the result in this exact note-taking format:
- If the source clearly covers more than one distinct topic or section, add a short "## " heading before each group of points; skip headings entirely for a single-topic source.
- One key point per bullet ("- "), each a short, complete, standalone sentence or fragment — a reader should understand it without re-reading the original text.
- Bold (**term**) any key term, name, or definition the first time it appears.
- Nest closely-related supporting details as sub-bullets ("  - ") under the point they support, instead of running them into one long bullet.
- Order bullets to follow the logical flow of the source (e.g. cause before effect, general before specific), not necessarily the original sentence order if reordering makes it clearer.
- Keep it tight: prefer more short bullets over fewer long ones, and never pad with restated points.

Do not answer questions, chat, hold a conversation, or discuss anything unrelated to the text provided; if the message isn't text to condense, briefly ask them to paste the text they want turned into notes rather than doing anything else.`

/**
 * Registers all IPC handlers synchronously (so the renderer's very first calls never
 * race against setup).
 */
export async function registerIpcHandlers(): Promise<void> {
  const userData = app.getPath('userData')
  // Only meaningful for a real installed build — in dev, app.getPath('exe') resolves to
  // the shared Electron binary in node_modules, whose timestamp isn't tied to this app
  // at all, so the fingerprint check would falsely "detect" a reinstall on every launch.
  if (app.isPackaged) {
    await resetIfReinstalled(userData)
  }
  const configStore = new ConfigStore(path.join(userData, 'owlpad-config.json'))
  const pinStore = new PinStore(path.join(userData, 'owlpad-pin.dat'))
  const searchIndex = new SearchIndex()
  const aiSettingsStore = new AISettingsStore(path.join(userData, 'owlpad-ai-config.json'))
  const ollama = new OllamaProvider()
  let vault: VaultManager | null = null

  async function getVault(): Promise<VaultManager> {
    if (vault) return vault
    const cfg = await configStore.load()
    if (!cfg.vaultPath) throw new Error('Vault not configured')
    vault = new VaultManager(cfg.vaultPath)
    return vault
  }

  async function rebuildSearch() {
    const v = await getVault()
    const tree = await v.scan()
    await searchIndex.rebuild(tree, async (id) => (await v.readNote(id))?.body ?? '')
    return tree
  }

  ipcMain.handle('config:get', async () => {
    const cfg = await configStore.load()
    return { vaultPath: cfg.vaultPath, hasPin: await pinStore.exists() }
  })

  ipcMain.handle('vault:choose-folder', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('vault:set-folder', async (_e, folderPath: string) => {
    const cfg = await configStore.setVaultPath(folderPath)
    vault = new VaultManager(folderPath)
    return { vaultPath: cfg.vaultPath, hasPin: await pinStore.exists() }
  })

  ipcMain.handle('pin:has', () => pinStore.exists())
  ipcMain.handle('pin:set', (_e, pin: string) => pinStore.setPin(pin))
  ipcMain.handle('pin:verify', (_e, pin: string) => pinStore.verify(pin))
  ipcMain.handle('pin:change', async (_e, currentPin: string, newPin: string) => {
    const check = await pinStore.verify(currentPin)
    if (!check.ok) return check
    await pinStore.setPin(newPin)
    return { ok: true }
  })

  ipcMain.handle('vault:list', () => rebuildSearch())

  ipcMain.handle('notes:read', async (_e, id: string) => (await getVault()).readNote(id))

  ipcMain.handle('notes:create', async (_e, input: NewNoteInput) => {
    const v = await getVault()
    const note = await v.createNote(input)
    await rebuildSearch()
    return note
  })

  ipcMain.handle('notes:update', async (_e, id: string, patch: UpdateNoteInput) => {
    const v = await getVault()
    const note = await v.updateNote(id, patch)
    await rebuildSearch()
    return note
  })

  ipcMain.handle('notes:delete', async (_e, id: string) => {
    const v = await getVault()
    await v.deleteNote(id)
    await rebuildSearch()
  })

  ipcMain.handle('titles:delete', async (_e, subject: string, title: string) => {
    const v = await getVault()
    await v.deleteTitle(subject, title)
    await rebuildSearch()
  })

  ipcMain.handle('titles:rename', async (_e, subject: string, oldTitle: string, newTitle: string) => {
    const v = await getVault()
    await v.renameTitle(subject, oldTitle, newTitle)
    await rebuildSearch()
  })

  ipcMain.handle('subjects:delete', async (_e, subject: string) => {
    const v = await getVault()
    await v.deleteSubject(subject)
    await rebuildSearch()
  })

  ipcMain.handle('notes:search', (_e, query: string) => searchIndex.search(query))

  ipcMain.handle('ai:get-settings', () => aiSettingsStore.load())
  ipcMain.handle('ai:set-model', (_e, model: string) => aiSettingsStore.setModel(model))
  ipcMain.handle('ai:list-models', () => ollama.listModels())

  ipcMain.handle('ai:setup', async (event) => {
    try {
      await setupOwly((progress) => event.sender.send('owly:setup-progress', progress))
      const { models } = await ollama.listModels()
      const pulled =
        models.find((m) => m === DEFAULT_OLLAMA_MODEL || m.startsWith(`${DEFAULT_OLLAMA_MODEL}:`)) ??
        models[0] ??
        DEFAULT_OLLAMA_MODEL
      await aiSettingsStore.setModel(pulled)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Setup failed.' }
    }
  })

  ipcMain.handle('owly:ask', async (event, requestId: string, input: AskOwlyInput) => {
    const settings = await aiSettingsStore.load()
    if (!settings.model) {
      throw new Error('No Owly model selected yet. Pick one in Settings.')
    }

    const system = input.noteContext
      ? `${OWLY_SYSTEM_PROMPT}\n\nThe student is currently viewing this note:\n\nSubject: ${input.noteContext.subject}\nTitle: ${input.noteContext.title}\nSection: ${input.noteContext.section}\n\n${input.noteContext.body}`
      : `${OWLY_SYSTEM_PROMPT}\n\nNo note is currently open.`

    try {
      return await ollama.streamChat(
        { system, messages: input.history, model: settings.model },
        (delta) => event.sender.send('owly:chunk', requestId, delta)
      )
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Owly ran into an unexpected error.')
    }
  })

  ipcMain.handle('paraphrase:ask', async (event, requestId: string, input: ParaphraseInput) => {
    const settings = await aiSettingsStore.load()
    if (!settings.model) {
      throw new Error('No Owly model selected yet. Pick one in Settings.')
    }
    try {
      return await ollama.streamChat(
        { system: PARAPHRASE_SYSTEM_PROMPT, messages: input.history, model: settings.model },
        (delta) => event.sender.send('paraphrase:chunk', requestId, delta)
      )
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Owly ran into an unexpected error.')
    }
  })

  ipcMain.handle('quiz:generate', async (_e, input: QuizGenerateInput) => {
    const settings = await aiSettingsStore.load()
    if (!settings.model) {
      throw new Error('No Owly model selected yet. Pick one in Settings.')
    }
    try {
      return await generateQuiz(ollama, settings.model, input.noteContext, input.count)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to generate quiz.')
    }
  })

  ipcMain.handle('flashcards:generate', async (_e, input: FlashcardsGenerateInput) => {
    const settings = await aiSettingsStore.load()
    if (!settings.model) {
      throw new Error('No Owly model selected yet. Pick one in Settings.')
    }
    try {
      return await generateFlashcards(ollama, settings.model, input.noteContext, input.count)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to generate flashcards.')
    }
  })

  ipcMain.handle('insights:generate', async (_e, input: InsightsGenerateInput) => {
    const settings = await aiSettingsStore.load()
    if (!settings.model) {
      throw new Error('No Owly model selected yet. Pick one in Settings.')
    }
    try {
      return await generateInsights(ollama, settings.model, input.noteContext, input.existingFacts)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to generate insights.')
    }
  })
}
