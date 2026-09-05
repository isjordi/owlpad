import { useState } from 'react'
import { useOwlPadStore } from '../state/store'
import MacTitleBarGutter from '../components/MacTitleBarGutter'
import owlLogoWhite from '../assets/owl-logo-white.png'
import owlLogoBlack from '../assets/owl-logo-black.png'

export default function LockScreen() {
  const setUnlocked = useOwlPadStore((s) => s.setUnlocked)
  const theme = useOwlPadStore((s) => s.theme)
  const owlLogo = theme === 'white-black' ? owlLogoBlack : owlLogoWhite
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(value: string) {
    if (value.length !== 4) return
    setBusy(true)
    try {
      const result = await window.owlpad.verifyPin(value)
      setBusy(false)
      if (result.ok) {
        setUnlocked(true)
        return
      }
      setPin('')
      setError(
        result.lockedForMs
          ? `Too many attempts. Try again in ${Math.ceil(result.lockedForMs / 1000)}s.`
          : 'Incorrect PIN'
      )
    } catch (err) {
      setBusy(false)
      setPin('')
      setError(err instanceof Error ? err.message : 'Failed to verify PIN.')
    }
  }

  function onChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 4)
    setPin(digits)
    setError(null)
    if (digits.length === 4) submit(digits)
  }

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-[var(--owl-bg)] text-[var(--owl-text)]">
      <MacTitleBarGutter />
      <div className="text-center">
        <img src={owlLogo} alt="" className="mx-auto mb-4 h-12 w-auto" />
        <h1 className="text-xl font-semibold tracking-tight">OwlPAD is locked</h1>
        <p className="mt-1 text-sm text-[var(--owl-text-muted)]">Enter your 4-Pin Code</p>
      </div>
      <input
        autoFocus
        type="password"
        inputMode="numeric"
        value={pin}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        className="owl-input w-48 px-4 py-3 text-center text-2xl tracking-[0.6em]"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
