import { useEffect, useState } from 'react'
import { useOwlPadStore } from '../state/store'
import Sidebar from '../components/Sidebar'
import TitleList from '../components/TitleList'
import SectionList from '../components/SectionList'
import ResizeHandle from '../components/ResizeHandle'
import NoteEditor from '../components/NoteEditor'
import NewNoteDialog from '../components/NewNoteDialog'
import SettingsPanel from '../components/SettingsPanel'
import OwlyPanel from '../components/OwlyPanel'

export default function AppShell() {
  const {
    setVaultTree,
    setConfig,
    activeNoteId,
    setSelectedSubject,
    paneWidths,
    setPaneWidth,
    focusMode,
    toggleFocusMode
  } = useOwlPadStore()
  const [showNewNote, setShowNewNote] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showOwly, setShowOwly] = useState(false)

  // Focus mode's only exit control lives inside NoteEditor, which unmounts whenever
  // there's no active note (note deleted, or a fresh load — focusMode persists across
  // reloads but activeNoteId doesn't) — without an active note there'd be no way back
  // in. Treat focus mode as active only while there's a note open, and keep Escape as
  // a hard-coded exit hatch regardless of what's mounted.
  const focusModeActive = focusMode && activeNoteId !== null

  useEffect(() => {
    if (!focusMode) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') toggleFocusMode()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [focusMode, toggleFocusMode])

  async function refresh() {
    const tree = await window.owlpad.listVault()
    setVaultTree(tree)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleVaultChanged() {
    const cfg = await window.owlpad.getConfig()
    setConfig(cfg)
    setSelectedSubject(null)
    await refresh()
  }

  return (
    <div className="flex h-screen w-screen bg-[var(--owl-bg)] text-[var(--owl-text)]">
      {!focusModeActive && (
        <>
          <Sidebar
            width={paneWidths.sidebar}
            onNewNote={() => setShowNewNote(true)}
            onSettings={() => setShowSettings(true)}
            onRefresh={refresh}
          />
          <ResizeHandle width={paneWidths.sidebar} onResize={(w) => setPaneWidth('sidebar', w)} />
          <TitleList width={paneWidths.titles} onRefresh={refresh} />
          <ResizeHandle width={paneWidths.titles} onResize={(w) => setPaneWidth('titles', w)} />
        </>
      )}
      <SectionList width={paneWidths.sections} onRefresh={refresh} />
      <ResizeHandle width={paneWidths.sections} onResize={(w) => setPaneWidth('sections', w)} />
      {activeNoteId ? (
        <NoteEditor
          key={activeNoteId}
          onSaved={refresh}
          onDeleted={refresh}
          owlyOpen={showOwly}
          onToggleOwly={() => setShowOwly((v) => !v)}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-[var(--owl-text-muted)]">
          Select or create a note to get started
        </div>
      )}
      {showOwly && (
        <>
          <ResizeHandle width={paneWidths.owly} onResize={(w) => setPaneWidth('owly', w)} invert />
          <OwlyPanel
            width={paneWidths.owly}
            onOpenSettings={() => setShowSettings(true)}
            onClose={() => setShowOwly(false)}
          />
        </>
      )}
      {showNewNote && (
        <NewNoteDialog
          onClose={() => setShowNewNote(false)}
          onCreated={async () => {
            setShowNewNote(false)
            await refresh()
          }}
        />
      )}
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} onVaultChanged={handleVaultChanged} />
      )}
    </div>
  )
}
