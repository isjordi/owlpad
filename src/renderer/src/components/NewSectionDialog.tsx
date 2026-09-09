import { useState, type FormEvent } from 'react'

const MAX_NAME_LENGTH = 40

export default function NewSectionDialog({
  subject,
  title,
  onClose,
  onCreated
}: {
  subject: string
  title: string
  onClose: () => void
  onCreated: (noteId: string) => void
}) {
  const [section, setSection] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!section.trim()) {
      setError('Section name is required')
      return
    }
    try {
      const note = await window.owlpad.createNote({ subject, title, section })
      onCreated(note.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create note.')
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40" onClick={onClose}>
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 border border-[var(--owl-border)] bg-[var(--owl-panel)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-base font-semibold">New section</h2>
          <p className="mt-1 text-xs text-[var(--owl-text-muted)]">
            {subject} / {title}
          </p>
        </div>
        <input
          autoFocus
          placeholder="Section name"
          value={section}
          onChange={(e) => setSection(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
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
            Create
          </button>
        </div>
      </form>
    </div>
  )
}
