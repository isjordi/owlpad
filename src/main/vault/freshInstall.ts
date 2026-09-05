import { app } from 'electron'
import { readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const RESET_FILES = ['owlpad-config.json', 'owlpad-pin.dat', 'owlpad-ai-config.json']

/**
 * Detects a genuine uninstall+reinstall (as opposed to an ordinary relaunch of the
 * same install) by fingerprinting the running executable's on-disk creation time —
 * uninstalling and reinstalling writes a brand new binary file, even to the same
 * path, so its creation time changes even though nothing else about the machine
 * does. When the fingerprint doesn't match the one recorded last run, wipes the
 * local PIN/vault-path/AI-settings files so onboarding (passcode + vault folder)
 * runs again instead of quietly resuming whatever was set up before — matches what
 * a genuinely fresh install should feel like on every platform, without relying on
 * an installer's own uninstall hooks (which a zip-distributed macOS build has no
 * way to run at all).
 */
export async function resetIfReinstalled(userData: string): Promise<void> {
  const fingerprintPath = path.join(userData, 'owlpad-install-fingerprint.json')

  // On Linux, a running AppImage executes out of a FUSE mount of its own squashfs
  // image (app.getPath('exe') resolves inside /tmp/.mount_*), whose reported
  // timestamps reflect when the image was *built*, not when this particular copy
  // was downloaded — every launch of the same build reports the same fingerprint
  // there, reinstall or not. The AppImage runtime sets $APPIMAGE to the real
  // on-disk .AppImage file for exactly this kind of case; stat that instead when
  // present, since a fresh `curl -o` reinstall does give it a real new inode.
  const exePath = process.env.APPIMAGE || app.getPath('exe')

  let currentFingerprint: string
  try {
    const exeStat = await stat(exePath)
    currentFingerprint = String(exeStat.birthtimeMs || exeStat.ctimeMs)
  } catch {
    return // can't determine the running binary's fingerprint — don't risk wiping real data
  }

  let previousFingerprint: string | null = null
  try {
    const raw = await readFile(fingerprintPath, 'utf-8')
    previousFingerprint = (JSON.parse(raw) as { fingerprint: string }).fingerprint
  } catch {
    previousFingerprint = null
  }

  if (previousFingerprint && previousFingerprint !== currentFingerprint) {
    await Promise.all(RESET_FILES.map((f) => rm(path.join(userData, f), { force: true })))
  }

  await writeFile(fingerprintPath, JSON.stringify({ fingerprint: currentFingerprint }))
}
