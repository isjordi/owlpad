import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useOwlPadStore } from '../state/store'
import ContextMenu from './ContextMenu'
import RenameDialog from './RenameDialog'
import NewTitleDialog from './NewTitleDialog'

export default function TitleList({
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
    setSelectedSubject,
    setSelectedTitle,
    setActiveNoteId
  } = useOwlPadStore()
  const [menu, setMenu] = useState<{ x: number; y: number; title: string } | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [showNewTitle, setShowNewTitle] = useState(false)

  // Insertion order from the main-process scan is already oldest-title-first — don't re-sort.
  const titles = selectedSubject ? Object.keys(vaultTree[selectedSubject] ?? {}) : []

  async function deleteTitle(title: string) {
    if (!selectedSubject) return
    if (!confirm(`Delete "${title}" and all its sections? This cannot be undone.`)) return
    try {
      await window.owlpad.deleteTitle(selectedSubject, title)
      if (selectedTitle === title) setSelectedSubject(selectedSubject)
      onRefresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete.')
    }
  }

  async function renameTitle(oldTitle: string, newTitle: string) {
    if (!selectedSubject) return
    try {
      await window.owlpad.renameTitle(selectedSubject, oldTitle, newTitle)
      if (selectedTitle === oldTitle) setSelectedTitle(selectedSubject, newTitle)
      onRefresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to rename.')
    }
  }

  return (
    <div style={{ width }} className="shrink-0 overflow-y-auto border-r border-[var(--owl-border)]">
      <div className="flex h-10 items-center justify-between border-b border-[var(--owl-border)] px-4 text-xs font-semibold uppercase tracking-wide text-[var(--owl-text-muted)]">
        <span className="truncate">{selectedSubject ?? 'Titles'}</span>
        <button
          onClick={() => setShowNewTitle(true)}
          disabled={!selectedSubject}
          className="owl-hover shrink-0 p-1 normal-case disabled:pointer-events-none disabled:opacity-30"
          aria-label="New title"
          title="New title"
        >
          <Plus size={14} />
        </button>
      </div>
      {!selectedSubject && (
        <p className="px-4 py-6 text-sm text-[var(--owl-text-muted)]">Select a subject</p>
      )}
      {selectedSubject && titles.length === 0 && (
        <p className="px-4 py-6 text-sm text-[var(--owl-text-muted)]">No titles in this subject yet</p>
      )}
      <ul>
        {titles.map((title) => {
          const active = selectedTitle === title
          const count = vaultTree[selectedSubject!][title].length
          return (
            <li key={title}>
              <button
                onClick={() => setSelectedTitle(selectedSubject, title)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setMenu({ x: e.clientX, y: e.clientY, title })
                }}
                className={`flex w-full items-center justify-between border-b border-[var(--owl-border)] px-4 py-3 text-left text-sm ${
                  active ? 'owl-selected' : 'owl-hover'
                }`}
              >
                <span className="truncate">{title}</span>
                <span className="text-xs text-[var(--owl-text-muted)]">{count}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: 'Rename', onClick: () => setRenaming(menu.title) },
            { label: 'Delete title', danger: true, onClick: () => deleteTitle(menu.title) }
          ]}
        />
      )}

      {renaming && (
        <RenameDialog
          label="title"
          initialValue={renaming}
          onClose={() => setRenaming(null)}
          onSave={(value) => renameTitle(renaming, value)}
        />
      )}

      {showNewTitle && selectedSubject && (
        <NewTitleDialog
          subject={selectedSubject}
          onClose={() => setShowNewTitle(false)}
          onCreated={async (noteId, title) => {
            setShowNewTitle(false)
            setSelectedTitle(selectedSubject, title)
            setActiveNoteId(noteId)
            await onRefresh()
          }}
        />
      )}
    </div>
  )
}
