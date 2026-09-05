import { useState, type FormEvent } from 'react'
import { useOwlPadStore } from '../state/store'

export default function NewNoteDialog({
  onClose,
  onCreated
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const { vaultTree, setActiveNoteId } = useOwlPadStore()
  const [subject, setSubject] = useState('')
  const [title, setTitle] = useState('')
  const [section, setSection] = useState('')
  const [error, setError] = useState<string | null>(null)

  const subjects = Object.keys(vaultTree)
  const titles = subject ? Object.keys(vaultTree[subject] ?? {}) : []

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !title.trim() || !section.trim()) {
      setError('Subject, title and section are all required')
      return
    }
    try {
      const note = await window.owlpad.createNote({ subject, title, section })
      setActiveNoteId(note.id)
      onCreated()
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
        <h2 className="text-base font-semibold">New note</h2>
        <input
          autoFocus
          list="subjects"
          placeholder="Subject (e.g. Biology)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="owl-input w-full px-3 py-2 text-sm"
        />
        <datalist id="subjects">
          {subjects.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <input
          list="titles"
          placeholder="Title (e.g. Chapter 3)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="owl-input w-full px-3 py-2 text-sm"
        />
        <datalist id="titles">
          {titles.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <input
          placeholder="Section"
          value={section}
          onChange={(e) => setSection(e.target.value)}
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
