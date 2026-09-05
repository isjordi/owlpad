import { useEffect, useState } from 'react'
import { HelpCircle, Layers, Plus } from 'lucide-react'
import { useOwlPadStore } from '../state/store'
import NewSectionDialog from './NewSectionDialog'
import ContextMenu from './ContextMenu'
import RenameDialog from './RenameDialog'
import QuizDialog from './QuizDialog'
import FlashcardDialog from './FlashcardDialog'
import MacTitleBarGutter from './MacTitleBarGutter'
import type { AINoteContext, Note } from '../../../shared/types'

export default function SectionList({
  width,
  onRefresh
}: {
  width: number
  onRefresh: () => void
}) {
  const {
    vaultTree,
    selectedSubject,
    selectedTitle,
    activeNoteId,
    setActiveNoteId,
    searchQuery,
    searchResults,
    setSearchResults,
    focusMode
  } = useOwlPadStore()
  const [showNewSection, setShowNewSection] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number; id: string; section: string } | null>(
    null
  )
  const [renaming, setRenaming] = useState<{ id: string; section: string } | null>(null)
  const [showTitleQuiz, setShowTitleQuiz] = useState(false)
  const [showTitleRecall, setShowTitleRecall] = useState(false)

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([])
        return
      }
      const results = await window.owlpad.searchNotes(searchQuery)
      setSearchResults(results)
    }, 200)
    return () => clearTimeout(handle)
  }, [searchQuery, setSearchResults])

  const isSearching = searchQuery.trim().length > 0
  const notes = isSearching
    ? searchResults
    : selectedSubject && selectedTitle
      ? (vaultTree[selectedSubject]?.[selectedTitle] ?? [])
      : []
  const canAddSection = !!selectedSubject && !!selectedTitle
  const titleNotes = selectedSubject && selectedTitle ? (vaultTree[selectedSubject]?.[selectedTitle] ?? []) : []
  const canQuizTitle = canAddSection && titleNotes.length > 0

  async function buildTitleContext(): Promise<AINoteContext> {
    const notes = await Promise.all(titleNotes.map((m) => window.owlpad.readNote(m.id)))
    const body = notes
      .filter((n): n is Note => !!n)
      .map((n) => `## ${n.section}\n\n${n.body}`)
      .join('\n\n---\n\n')
    return {
      subject: selectedSubject!,
      title: selectedTitle!,
      section: `All ${titleNotes.length} sections`,
      body
    }
  }

  async function deleteSection(id: string, section: string) {
    if (!confirm(`Delete "${section}"? This cannot be undone.`)) return
    try {
      await window.owlpad.deleteNote(id)
      if (activeNoteId === id) setActiveNoteId(null)
      onRefresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete.')
    }
  }

  async function renameSection(id: string, newSection: string) {
    try {
      await window.owlpad.updateNote(id, { section: newSection })
      onRefresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to rename.')
    }
  }

  return (
    <div style={{ width }} className="shrink-0 overflow-y-auto border-r border-[var(--owl-border)]">
      {focusMode && <MacTitleBarGutter />}
      <div className="flex h-10 items-center justify-between border-b border-[var(--owl-border)] px-4">
        <span className="truncate text-xs font-semibold uppercase tracking-wide text-[var(--owl-text-muted)]">
          {isSearching
            ? `Results for "${searchQuery}"`
            : selectedTitle
              ? `${selectedSubject} / ${selectedTitle}`
              : 'Sections'}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setShowTitleQuiz(true)}
            disabled={!canQuizTitle}
            aria-label="Quiz me on this whole title"
            title="Quiz me on this title"
            className="owl-hover p-1 text-[var(--owl-text-muted)] disabled:pointer-events-none disabled:opacity-30"
          >
            <HelpCircle size={15} />
          </button>
          <button
            onClick={() => setShowTitleRecall(true)}
            disabled={!canQuizTitle}
            aria-label="Practice active recall on this whole title"
            title="Active recall on this title"
            className="owl-hover p-1 text-[var(--owl-text-muted)] disabled:pointer-events-none disabled:opacity-30"
          >
            <Layers size={15} />
          </button>
          <button
            onClick={() => setShowNewSection(true)}
            disabled={!canAddSection}
            aria-label="New section"
            className="owl-hover p-1 text-[var(--owl-text-muted)] disabled:pointer-events-none disabled:opacity-30"
          >
            <Plus size={15} />
          </button>
        </span>
      </div>
      {notes.length === 0 && (
        <p className="px-4 py-6 text-sm text-[var(--owl-text-muted)]">
          {isSearching ? 'No matches' : 'No sections in this title yet'}
        </p>
      )}
      <ul>
        {notes.map((note) => (
          <li key={note.id}>
            <button
              onClick={() => setActiveNoteId(note.id)}
              onContextMenu={(e) => {
                e.preventDefault()
                setMenu({ x: e.clientX, y: e.clientY, id: note.id, section: note.section })
              }}
              className={`w-full border-b border-[var(--owl-border)] px-4 py-3 text-left ${
                activeNoteId === note.id ? 'owl-selected' : 'owl-hover'
              }`}
            >
              <div className="truncate text-sm font-medium">{note.section}</div>
              <div className="mt-0.5 truncate text-xs text-[var(--owl-text-muted)]">
                {note.subject} / {note.title}
              </div>
            </button>
          </li>
        ))}
      </ul>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: 'Rename', onClick: () => setRenaming({ id: menu.id, section: menu.section }) },
            {
              label: 'Delete section',
              danger: true,
              onClick: () => deleteSection(menu.id, menu.section)
            }
          ]}
        />
      )}

      {renaming && (
        <RenameDialog
          label="section"
          initialValue={renaming.section}
          onClose={() => setRenaming(null)}
          onSave={(value) => renameSection(renaming.id, value)}
        />
      )}

      {showNewSection && selectedSubject && selectedTitle && (
        <NewSectionDialog
          subject={selectedSubject}
          title={selectedTitle}
          onClose={() => setShowNewSection(false)}
          onCreated={async (noteId) => {
            setShowNewSection(false)
            setActiveNoteId(noteId)
            await onRefresh()
          }}
        />
      )}

      {showTitleQuiz && selectedTitle && (
        <QuizDialog
          label={selectedTitle}
          defaultCount={10}
          getNoteContext={buildTitleContext}
          onClose={() => setShowTitleQuiz(false)}
        />
      )}
      {showTitleRecall && selectedTitle && (
        <FlashcardDialog
          label={selectedTitle}
          defaultCount={10}
          getNoteContext={buildTitleContext}
          onClose={() => setShowTitleRecall(false)}
        />
      )}
    </div>
  )
}
