import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

interface StoredConfig {
  vaultPath: string | null
}

/** Small local JSON config (vault folder location). Lives in userData, never in the vault. */
export class ConfigStore {
  private cache: StoredConfig | null = null

  constructor(private filePath: string) {}

  async load(): Promise<StoredConfig> {
    if (this.cache) return this.cache
    if (!existsSync(this.filePath)) {
      this.cache = { vaultPath: null }
      return this.cache
    }
    const raw = await readFile(this.filePath, 'utf-8')
    this.cache = JSON.parse(raw) as StoredConfig
    return this.cache
  }

  async setVaultPath(vaultPath: string): Promise<StoredConfig> {
    const current = await this.load()
    const updated: StoredConfig = { ...current, vaultPath }
    this.cache = updated
    await writeFile(this.filePath, JSON.stringify(updated, null, 2))
    return updated
  }
}
