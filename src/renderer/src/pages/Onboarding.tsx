import { useState } from 'react'
import { useOwlPadStore, THEMES, type ThemeId } from '../state/store'
import MacTitleBarGutter from '../components/MacTitleBarGutter'
import owlLogoWhite from '../assets/owl-logo-white.png'
import owlLogoBlack from '../assets/owl-logo-black.png'

type Step = 'folder' | 'pin' | 'theme'

export default function Onboarding() {
  const { setConfig, setUnlocked, theme, setTheme } = useOwlPadStore()
  const owlLogo = theme === 'white-black' ? owlLogoBlack : owlLogoWhite
  const [step, setStep] = useState<Step>('folder')
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function pickFolder() {
    try {
      const folder = await window.owlpad.chooseVaultFolder()
      if (!folder) return
      setVaultPath(folder)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to choose a folder.')
    }
  }

  async function confirmFolder() {
    if (!vaultPath) return
    try {
      await window.owlpad.setVaultFolder(vaultPath)
      setStep('pin')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set the vault folder.')
    }
  }

  async function finishPin() {
    if (!/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits')
      return
    }
    if (pin !== confirmPin) {
      setError('PINs do not match')
      return
    }
    try {
      await window.owlpad.setPin(pin)
      setError(null)
      setStep('theme')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set the PIN.')
    }
  }

  async function finishOnboarding() {
    try {
      const cfg = await window.owlpad.getConfig()
      setConfig(cfg)
      setUnlocked(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finish setup.')
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-[var(--owl-bg)] text-[var(--owl-text)]">
      <MacTitleBarGutter />
      <div className="w-full max-w-md space-y-6 border border-[var(--owl-border)] bg-[var(--owl-panel)] p-8">
        <div className="flex flex-col items-center text-center">
          <img src={owlLogo} alt="" className="h-12 w-auto" />
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">OwlPAD</h1>
          <p className="mt-1 text-sm text-[var(--owl-text-muted)]">Knowledge is Power</p>
        </div>

        {step === 'folder' && (
          <div className="space-y-4">
            <button
              onClick={pickFolder}
              className="w-full truncate border border-dashed border-[var(--owl-border)] px-4 py-3 text-left text-sm transition-colors hover:border-[var(--owl-accent)]"
            >
              {vaultPath ?? 'Choose folder…'}
            </button>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              onClick={confirmFolder}
              disabled={!vaultPath}
              className="owl-btn-accent w-full px-4 py-2.5 text-sm font-medium"
            >
              Continue
            </button>
          </div>
        )}

        {step === 'pin' && (
          <div className="space-y-4">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="4-Pin Code"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="owl-input w-full px-4 py-2.5 text-center text-lg tracking-[0.5em]"
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="Confirm 4-Pin Code"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              className="owl-input w-full px-4 py-2.5 text-center text-lg tracking-[0.5em]"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button onClick={finishPin} className="owl-btn-accent w-full px-4 py-2.5 text-sm font-medium">
              Continue
            </button>
          </div>
        )}

        {step === 'theme' && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--owl-text-muted)]">Pick a look for OwlPAD.</p>
            <div className="grid grid-cols-3 gap-3">
              {THEMES.map((t) => (
                <ThemeSwatch key={t.id} id={t.id} label={t.label} bg={t.bg} detail={t.detail} active={theme === t.id} onSelect={setTheme} />
              ))}
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button onClick={finishOnboarding} className="owl-btn-accent w-full px-4 py-2.5 text-sm font-medium">
              Finish setup
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ThemeSwatch({
  id,
  label,
  bg,
  detail,
  active,
  onSelect
}: {
  id: ThemeId
  label: string
  bg: string
  detail: string
  active: boolean
  onSelect: (id: ThemeId) => void
}) {
  return (
    <button
      onClick={() => onSelect(id)}
      className={`flex flex-col items-center gap-2 border p-3 text-xs transition-colors ${
        active ? 'border-[var(--owl-accent)]' : 'border-[var(--owl-border)] hover:border-[var(--owl-text-muted)]'
      }`}
    >
      <span className="flex h-10 w-10 items-center justify-center border border-black/10" style={{ background: bg }}>
        <span className="h-4 w-4" style={{ background: detail }} />
      </span>
      <span className="text-[var(--owl-text)]">{label}</span>
    </button>
  )
}
