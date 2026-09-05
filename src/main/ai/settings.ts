import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

interface StoredAISettings {
  model: string | null
}

/** Small local JSON config for Owly's chosen local model. No secrets — nothing to encrypt. */
export class AISettingsStore {
  private cache: StoredAISettings | null = null

  constructor(private filePath: string) {}

  async load(): Promise<StoredAISettings> {
    if (this.cache) return this.cache
    if (!existsSync(this.filePath)) {
      this.cache = { model: null }
      return this.cache
    }
    const raw = await readFile(this.filePath, 'utf-8')
    this.cache = JSON.parse(raw) as StoredAISettings
    return this.cache
  }

  async setModel(model: string): Promise<StoredAISettings> {
    const current = await this.load()
    const updated: StoredAISettings = { ...current, model }
    this.cache = updated
    await writeFile(this.filePath, JSON.stringify(updated, null, 2))
    return updated
  }
}
