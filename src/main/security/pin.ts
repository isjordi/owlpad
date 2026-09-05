import { safeStorage } from 'electron'
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'
import { readFile, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { UnlockResult } from '../../shared/types'

interface PinRecord {
  salt: string
  hash: string
  failedAttempts: number
  lockedUntil: number
}

const SCRYPT_KEYLEN = 64
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 }
const MAX_ATTEMPTS_BEFORE_BACKOFF = 5
const MAX_BACKOFF_MS = 30_000

function hashPin(pin: string, salt: Buffer): Buffer {
  return scryptSync(pin, salt, SCRYPT_KEYLEN, SCRYPT_OPTS)
}

/**
 * Stores a salted+hashed 4-digit PIN, encrypted at rest via Electron's OS-level
 * safeStorage when available. Tracks failed attempts with escalating backoff.
 */
export class PinStore {
  constructor(private filePath: string) {}

  async exists(): Promise<boolean> {
    return existsSync(this.filePath)
  }

  private async readRecord(): Promise<PinRecord | null> {
    if (!existsSync(this.filePath)) return null
    const raw = await readFile(this.filePath)

    let decrypted: string
    if (safeStorage.isEncryptionAvailable() && raw.length > 0) {
      try {
        decrypted = safeStorage.decryptString(raw)
      } catch {
        // Written while encryption was unavailable (or under a different OS-level
        // signing/keychain identity than now, e.g. after re-signing the app) —
        // fall back to the plain-JSON format instead of failing outright.
        decrypted = raw.toString('utf-8')
      }
    } else {
      decrypted = raw.toString('utf-8')
    }

    return JSON.parse(decrypted) as PinRecord
  }

  private async writeRecord(record: PinRecord): Promise<void> {
    const json = JSON.stringify(record)
    const out = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(json)
      : Buffer.from(json, 'utf-8')
    await writeFile(this.filePath, out)
  }

  async setPin(pin: string): Promise<void> {
    const salt = randomBytes(16)
    const hash = hashPin(pin, salt)
    await this.writeRecord({
      salt: salt.toString('hex'),
      hash: hash.toString('hex'),
      failedAttempts: 0,
      lockedUntil: 0
    })
  }

  async verify(pin: string): Promise<UnlockResult> {
    let record: PinRecord | null
    try {
      record = await this.readRecord()
    } catch {
      // The stored PIN can't be decrypted or parsed at all — most likely the OS-level
      // key it was encrypted under (macOS Keychain, tied to the app's signing
      // identity) no longer matches, e.g. after re-signing an unsigned build. There's
      // no way to recover the original PIN from here, so drop the unreadable record
      // rather than leaving the user permanently locked out — the next launch will
      // see no PIN set and prompt to set a new one.
      await rm(this.filePath, { force: true })
      return {
        ok: false,
        error: 'Your saved PIN could not be read and has been reset. Restart OwlPAD to set a new one.'
      }
    }
    if (!record) return { ok: false, error: 'No PIN set' }

    const now = Date.now()
    if (record.lockedUntil > now) {
      return { ok: false, error: 'Too many attempts', lockedForMs: record.lockedUntil - now }
    }

    const salt = Buffer.from(record.salt, 'hex')
    const expected = Buffer.from(record.hash, 'hex')
    const actual = hashPin(pin, salt)
    const match = expected.length === actual.length && timingSafeEqual(expected, actual)

    if (match) {
      record.failedAttempts = 0
      record.lockedUntil = 0
      await this.writeRecord(record)
      return { ok: true }
    }

    record.failedAttempts += 1
    if (record.failedAttempts >= MAX_ATTEMPTS_BEFORE_BACKOFF) {
      const backoffMs = Math.min(
        MAX_BACKOFF_MS,
        2 ** (record.failedAttempts - MAX_ATTEMPTS_BEFORE_BACKOFF) * 1000
      )
      record.lockedUntil = now + backoffMs
    }
    await this.writeRecord(record)

    return {
      ok: false,
      error: 'Incorrect PIN',
      lockedForMs: record.lockedUntil > now ? record.lockedUntil - now : undefined
    }
  }
}
