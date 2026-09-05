import { useState, type FormEvent } from 'react'

export default function RenameDialog({
  label,
  initialValue,
  onClose,
  onSave
}: {
  label: string
  initialValue: string
  onClose: () => void
  onSave: (value: string) => void
}) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) {
      setError('Name cannot be empty')
      return
    }
    onSave(trimmed)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40" onClick={onClose}>
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 border border-[var(--owl-border)] bg-[var(--owl-panel)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold">Rename {label}</h2>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.target.select()}
          className="owl-input w-full px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="owl-hover px-3 py-1.5 text-sm text-[var(--owl-text-muted)]"
          >
            Cancel
          </button>
          <button type="submit" className="owl-btn-accent px-3 py-1.5 text-sm font-medium">
            Save
          </button>
        </div>
      </form>
    </div>
  )
}
