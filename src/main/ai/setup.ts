import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import os from 'node:os'
import { mkdtemp, rm } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { exec as sudoPromptExec } from '@vscode/sudo-prompt'

const execFileAsync = promisify(execFile)

export const DEFAULT_OLLAMA_MODEL = 'llama3.2'
const OLLAMA_HOST = 'http://127.0.0.1:11434'
const OLLAMA_LINUX_INSTALL_CMD = 'curl -fsSL https://ollama.com/install.sh | sh'

export type SetupStage = 'checking' | 'installing' | 'starting' | 'pulling' | 'done'

export interface SetupProgress {
  stage: SetupStage
  message: string
  percent?: number
}

async function isOllamaRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`)
    return res.ok
  } catch {
    return false
  }
}

async function waitForOllama(timeoutMs: number): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await isOllamaRunning()) return true
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }
  return false
}

function sudoExec(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sudoPromptExec(command, { name: 'OwlPAD' }, (error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`Download failed (status ${res.status}).`)
  await pipeline(res.body, createWriteStream(destPath))
}

async function installLinux(): Promise<void> {
  await sudoExec(OLLAMA_LINUX_INSTALL_CMD)
}

async function installMac(): Promise<void> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'owlpad-ollama-'))
  try {
    const zipPath = path.join(tmpDir, 'Ollama-darwin.zip')
    await downloadFile('https://ollama.com/download/Ollama-darwin.zip', zipPath)

    const destDir = path.join(os.homedir(), 'Applications')
    await execFileAsync('unzip', ['-o', zipPath, '-d', destDir])
    await execFileAsync('open', [path.join(destDir, 'Ollama.app')])
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}

/** Launches the official Windows installer UI — Ollama's installer has no documented silent flag. */
async function installWindows(): Promise<void> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'owlpad-ollama-'))
  const exePath = path.join(tmpDir, 'OllamaSetup.exe')
  await downloadFile('https://ollama.com/download/OllamaSetup.exe', exePath)
  spawn(exePath, [], { detached: true, stdio: 'ignore' }).unref()
}

async function pullModel(model: string, onProgress: (p: SetupProgress) => void): Promise<void> {
  const res = await fetch(`${OLLAMA_HOST}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: model, stream: true })
  })
  if (!res.ok || !res.body) throw new Error('Failed to start the model download.')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      const chunk = JSON.parse(line) as {
        status?: string
        completed?: number
        total?: number
        error?: string
      }
      if (chunk.error) throw new Error(chunk.error)
      const percent =
        chunk.total && chunk.completed !== undefined
          ? Math.round((chunk.completed / chunk.total) * 100)
          : undefined
      onProgress({ stage: 'pulling', message: chunk.status ?? 'Downloading model…', percent })
    }
  }
}

/**
 * Installs Ollama if missing (native OS elevation on Linux, a downloaded installer/app on
 * Windows/macOS), waits for it to come up, then pulls the default model. Every step reports
 * through onProgress so the UI can show what's happening.
 */
export async function setupOwly(
  onProgress: (p: SetupProgress) => void,
  model: string = DEFAULT_OLLAMA_MODEL
): Promise<void> {
  onProgress({ stage: 'checking', message: 'Checking for Ollama…' })
  let running = await isOllamaRunning()

  if (!running) {
    const platform = process.platform
    onProgress({
      stage: 'installing',
      message:
        platform === 'linux'
          ? 'Requesting permission to install Ollama…'
          : 'Downloading Ollama…'
    })

    try {
      if (platform === 'darwin') await installMac()
      else if (platform === 'win32') await installWindows()
      else if (platform === 'linux') await installLinux()
      else throw new Error("Automatic setup isn't supported on this platform yet.")
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      throw new Error(`Couldn't install Ollama automatically: ${reason}`)
    }

    onProgress({ stage: 'starting', message: 'Waiting for Ollama to start…' })
    running = await waitForOllama(process.platform === 'win32' ? 180_000 : 30_000)
    if (!running) {
      throw new Error(
        process.platform === 'win32'
          ? 'The Ollama installer is open — finish the setup wizard, then try again.'
          : "Ollama was installed but hasn't started yet. Try again in a moment."
      )
    }
  }

  onProgress({ stage: 'pulling', message: `Downloading ${model}…`, percent: 0 })
  await pullModel(model, onProgress)

  onProgress({ stage: 'done', message: 'Owly is ready.' })
}
