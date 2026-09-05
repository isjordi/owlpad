import { useState } from 'react'
import { Plus, Search, Settings } from 'lucide-react'
import { useOwlPadStore } from '../state/store'
import { getSubjectEmoji } from '../lib/subjectEmoji'
import ContextMenu from './ContextMenu'
import MacTitleBarGutter from './MacTitleBarGutter'
import owlLogoWhite from '../assets/owl-logo-white.png'
import owlLogoBlack from '../assets/owl-logo-black.png'

export default function Sidebar({
  width,
  onNewNote,
  onSettings,
  onRefresh
}: {
  width: number
  onNewNote: () => void
  onSettings: () => void
  onRefresh: () => void
}) {
  const { vaultTree, selectedSubject, setSelectedSubject, searchQuery, setSearchQuery, theme } =
    useOwlPadStore()
  const [menu, setMenu] = useState<{ x: number; y: number; subject: string } | null>(null)

  const subjects = Object.keys(vaultTree).sort()
  const owlLogo = theme === 'white-black' ? owlLogoBlack : owlLogoWhite

  async function deleteSubject(subject: string) {
    if (!confirm(`Delete "${subject}" and everything inside it? This cannot be undone.`)) return
    try {
      await window.owlpad.deleteSubject(subject)
      if (selectedSubject === subject) setSelectedSubject(null)
      onRefresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete.')
    }
  }

  return (
    <aside
      style={{ width }}
      className="flex shrink-0 flex-col border-r border-[var(--owl-border)]"
    >
      <MacTitleBarGutter />
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <img src={owlLogo} alt="" className="h-5 w-auto shrink-0" />
          <span className="text-sm font-semibold tracking-wide">OwlPAD</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onSettings} className="owl-hover p-1.5" aria-label="Settings">
            <Settings size={16} />
          </button>
        </div>
      </div>

      <div className="px-4 pb-2">
        <div className="flex items-center gap-2 border border-[var(--owl-border)] px-2.5 py-1.5">
          <Search size={14} className="text-[var(--owl-text-muted)]" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
      </div>

      <button
        onClick={onNewNote}
        className="owl-btn-accent mx-4 mb-2 flex items-center justify-center gap-1.5 py-2 text-sm font-medium"
      >
        <Plus size={15} /> New note
      </button>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {subjects.length === 0 && (
          <p className="px-2 py-4 text-xs text-[var(--owl-text-muted)]">No notes yet. Create your first one.</p>
        )}
        {subjects.map((subject) => {
          const active = selectedSubject === subject
          const titleCount = Object.keys(vaultTree[subject]).length
          return (
            <button
              key={subject}
              onClick={() => setSelectedSubject(subject)}
              onContextMenu={(e) => {
                e.preventDefault()
                setMenu({ x: e.clientX, y: e.clientY, subject })
              }}
              className={`flex w-full items-center gap-1.5 px-2 py-1.5 text-sm ${
                active ? 'owl-selected' : 'owl-hover'
              }`}
            >
              <span aria-hidden>{getSubjectEmoji(subject)}</span>
              <span className="flex-1 truncate text-left">{subject}</span>
              <span className="text-xs text-[var(--owl-text-muted)]">{titleCount}</span>
            </button>
          )
        })}
      </nav>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[{ label: 'Delete subject', danger: true, onClick: () => deleteSubject(menu.subject) }]}
        />
      )}
    </aside>
  )
}
