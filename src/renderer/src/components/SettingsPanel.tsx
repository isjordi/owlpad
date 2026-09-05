import { useEffect, useState } from 'react'
import { useOwlPadStore, FONTS, THEMES, type ThemeId } from '../state/store'
import type { AIModelsStatus, AISetupProgress } from '../../../shared/types'

export default function SettingsPanel({
  onClose,
  onVaultChanged
}: {
  onClose: () => void
  onVaultChanged: () => void
}) {
  const { config, theme, setTheme, font, setFont } = useOwlPadStore()
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [vaultMessage, setVaultMessage] = useState<string | null>(null)
  const [aiStatus, setAiStatus] = useState<AIModelsStatus | null>(null)
  const [aiModels, setAiModels] = useState<string[]>([])
  const [aiModel, setAiModel] = useState<string | null>(null)
  const [settingUp, setSettingUp] = useState(false)
  const [setupProgress, setSetupProgress] = useState<AISetupProgress | null>(null)
  const [setupError, setSetupError] = useState<string | null>(null)

  async function refreshAiStatus() {
    const [models, settings] = await Promise.all([
      window.owlpad.listAIModels(),
      window.owlpad.getAISettings()
    ])
    setAiStatus(models.status)
    setAiModels(models.models)
    setAiModel(settings.model)
  }

  useEffect(() => {
    refreshAiStatus()
  }, [])

  async function selectAiModel(model: string) {
    await window.owlpad.setAIModel(model)
    setAiModel(model)
  }

  async function runOwlySetup() {
    setSettingUp(true)
    setSetupError(null)
    setSetupProgress({ stage: 'checking', message: 'Checking for Ollama…' })
    const unsubscribe = window.owlpad.onOwlySetupProgress((p) => setSetupProgress(p))
    const result = await window.owlpad.setupOwly()
    unsubscribe()
    setSettingUp(false)
    setSetupProgress(null)
    if (result.ok) {
      await refreshAiStatus()
    } else {
      setSetupError(result.error ?? 'Setup failed.')
    }
  }

  async function changeVaultFolder() {
    const folder = await window.owlpad.chooseVaultFolder()
    if (!folder) return
    await window.owlpad.setVaultFolder(folder)
    setVaultMessage('Vault folder updated')
    onVaultChanged()
  }

  async function changePin() {
    if (!/^\d{4}$/.test(newPin)) {
      setMessage('New PIN must be 4 digits')
      return
    }
    const result = await window.owlpad.changePin(currentPin, newPin)
    if (result.ok) {
      setMessage('PIN updated')
      setCurrentPin('')
      setNewPin('')
    } else {
      setMessage(result.error ?? 'Failed to update PIN')
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-sm space-y-5 overflow-y-auto border border-[var(--owl-border)] bg-[var(--owl-panel)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold">Settings</h2>

        <div className="space-y-2">
          <p className="text-xs text-[var(--owl-text-muted)]">Owly AI</p>
          {aiStatus === null && <p className="text-sm text-[var(--owl-text-muted)]">Checking Ollama…</p>}
          {(aiStatus === 'unreachable' || aiStatus === 'no-models') && !settingUp && (
            <div className="space-y-2">
              <p className="text-sm text-[var(--owl-text-muted)]">
                {aiStatus === 'unreachable'
                  ? "Ollama isn't installed yet — Owly needs it to run locally."
                  : 'Ollama is running but has no models installed yet.'}
              </p>
              <button
                onClick={runOwlySetup}
                className="owl-btn-accent w-full px-3 py-1.5 text-sm font-medium"
              >
                Set up Owly automatically
              </button>
              {aiStatus === 'unreachable' && (
                <p className="text-xs text-[var(--owl-text-muted)]">
                  This installs Ollama (may ask for your password) and downloads a starter model
                  (~2GB). You can also install manually from ollama.com.
                </p>
              )}
              {setupError && <p className="text-sm text-red-500">{setupError}</p>}
            </div>
          )}
          {settingUp && setupProgress && (
            <div className="space-y-1.5">
              <p className="text-sm text-[var(--owl-text-muted)]">{setupProgress.message}</p>
              <div className="h-1.5 w-full border border-[var(--owl-border)]">
                <div
                  className="h-full bg-[var(--owl-accent)] transition-all"
                  style={{ width: `${setupProgress.percent ?? (setupProgress.stage === 'done' ? 100 : 10)}%` }}
                />
              </div>
            </div>
          )}
          {aiStatus === 'ok' && (
            <select
              value={aiModel ?? ''}
              onChange={(e) => selectAiModel(e.target.value)}
              className="owl-input w-full px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select a model…
              </option>
              {aiModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
          <p className="text-xs text-[var(--owl-text-muted)]">
            Owly runs locally on your device via Ollama — nothing about your notes ever leaves this
            machine.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-[var(--owl-text-muted)]">Vault folder</p>
          <p className="truncate text-sm">{config?.vaultPath}</p>
          <button
            onClick={changeVaultFolder}
            className="owl-hover w-full border border-[var(--owl-border)] px-3 py-1.5 text-sm"
          >
            Change vault folder…
          </button>
          {vaultMessage && <p className="text-xs text-[var(--owl-text-muted)]">{vaultMessage}</p>}
        </div>

        <div className="space-y-2">
          <p className="text-xs text-[var(--owl-text-muted)]">Theme</p>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((t) => (
              <ThemeSwatch
                key={t.id}
                id={t.id}
                label={t.label}
                bg={t.bg}
                detail={t.detail}
                active={theme === t.id}
                onSelect={setTheme}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-[var(--owl-text-muted)]">Font</p>
          <div className="grid grid-cols-2 gap-2">
            {FONTS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFont(f.id)}
                style={{ fontFamily: f.preview }}
                className={`border px-3 py-2 text-left text-sm transition-colors ${
                  font === f.id
                    ? 'border-[var(--owl-accent)] text-[var(--owl-text)]'
                    : 'border-[var(--owl-border)] text-[var(--owl-text-muted)] hover:border-[var(--owl-text-muted)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-[var(--owl-text-muted)]">Change passcode</p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="Current 4-Pin Code"
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
            className="owl-input w-full px-3 py-2 text-sm"
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="New 4-Pin Code"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
            className="owl-input w-full px-3 py-2 text-sm"
          />
          <button onClick={changePin} className="owl-btn-accent w-full px-3 py-1.5 text-sm font-medium">
            Update PIN
          </button>
          {message && <p className="text-xs text-[var(--owl-text-muted)]">{message}</p>}
        </div>

        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="owl-hover px-3 py-1.5 text-sm text-[var(--owl-text-muted)]">
            Close
          </button>
        </div>
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
      className={`flex flex-col items-center gap-1.5 border p-2 text-[10px] transition-colors ${
        active ? 'border-[var(--owl-accent)]' : 'border-[var(--owl-border)] hover:border-[var(--owl-text-muted)]'
      }`}
    >
      <span className="flex h-8 w-8 items-center justify-center border border-black/10" style={{ background: bg }}>
        <span className="h-3 w-3" style={{ background: detail }} />
      </span>
      <span className="text-[var(--owl-text)]">{label}</span>
    </button>
  )
}
