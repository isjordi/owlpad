import { useEffect, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import {
  HelpCircle,
  Layers,
  Lightbulb,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Trash2
} from 'lucide-react'
import { useOwlPadStore, MIN_FONT_SIZE, MAX_FONT_SIZE } from '../state/store'
import QuizDialog from './QuizDialog'
import FlashcardDialog from './FlashcardDialog'
import InsightPopups, { type InsightCard } from './InsightPopups'
import TimerWidget from './TimerWidget'
import type { Note } from '../../../shared/types'

const INSIGHT_IDLE_MS = 7000
const INSIGHT_MIN_NEW_CHARS = 60
const INSIGHT_COOLDOWN_MS = 2 * 60 * 1000
const MAX_INSIGHTS = 6

export default function NoteEditor({
  onSaved,
  onDeleted,
  owlyOpen,
  onToggleOwly
}: {
  onSaved: () => void
  onDeleted: () => void
  owlyOpen: boolean
  onToggleOwly: () => void
}) {
  const {
    activeNoteId,
    setActiveNoteId,
    editorFontSize,
    setEditorFontSize,
    theme,
    focusMode,
    toggleFocusMode,
    insightsEnabled,
    toggleInsightsEnabled
  } = useOwlPadStore()
  const [note, setNote] = useState<Note | null>(null)
  const [section, setSection] = useState('')
  const [body, setBody] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showQuiz, setShowQuiz] = useState(false)
  const [showRecall, setShowRecall] = useState(false)
  const [insights, setInsights] = useState<InsightCard[]>([])
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  const insightTimer = useRef<ReturnType<typeof setTimeout>>()
  const lastInsightBody = useRef('')
  const insightsEnabledRef = useRef(insightsEnabled)
  const lastInsightShownAt = useRef(0)

  useEffect(() => {
    insightsEnabledRef.current = insightsEnabled
    if (!insightsEnabled && insightTimer.current) clearTimeout(insightTimer.current)
  }, [insightsEnabled])

  useEffect(() => {
    if (!activeNoteId) return
    window.owlpad.readNote(activeNoteId).then((n) => {
      if (!n) return
      setNote(n)
      setSection(n.section)
      setBody(n.body)
      lastInsightBody.current = n.body
    })
    return () => {
      if (insightTimer.current) clearTimeout(insightTimer.current)
    }
  }, [activeNoteId])

  const fontSizeExtension = useMemo(
    () => EditorView.theme({ '&': { fontSize: `${editorFontSize}px` } }),
    [editorFontSize]
  )

  function scheduleSave(nextSection: string, nextBody: string) {
    setStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (!activeNoteId) return
      try {
        await window.owlpad.updateNote(activeNoteId, { section: nextSection, body: nextBody })
        setStatus('saved')
        onSaved()
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Failed to save.')
        setStatus('error')
      }
    }, 500)
  }

  async function fetchInsights(currentBody: string) {
    if (!note) return
    if (Date.now() - lastInsightShownAt.current < INSIGHT_COOLDOWN_MS) return
    if (currentBody.length - lastInsightBody.current.length < INSIGHT_MIN_NEW_CHARS) return
    lastInsightBody.current = currentBody
    try {
      const results = await window.owlpad.generateInsights({
        noteContext: { subject: note.subject, title: note.title, section, body: currentBody },
        existingFacts: insights.map((i) => i.fact)
      })
      if (results.length === 0) return
      lastInsightShownAt.current = Date.now()
      setInsights((prev) =>
        [...prev, ...results.map((r) => ({ id: crypto.randomUUID(), fact: r.fact }))].slice(
          -MAX_INSIGHTS
        )
      )
    } catch {
      // ambient/optional feature — fail silently (no model configured, Ollama down, etc.)
    }
  }

  function scheduleInsights(nextBody: string) {
    if (!insightsEnabledRef.current) return
    if (insightTimer.current) clearTimeout(insightTimer.current)
    insightTimer.current = setTimeout(() => fetchInsights(nextBody), INSIGHT_IDLE_MS)
  }

  async function handleDelete() {
    if (!activeNoteId) return
    if (!confirm('Delete this note? This cannot be undone.')) return
    try {
      await window.owlpad.deleteNote(activeNoteId)
      setActiveNoteId(null)
      onDeleted()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete.')
    }
  }

  if (!note) return <div className="flex-1" />

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-[var(--owl-border)] px-6 py-3">
        <input
          value={section}
          onChange={(e) => {
            setSection(e.target.value)
            scheduleSave(e.target.value, body)
          }}
          className="w-full bg-transparent text-lg font-semibold outline-none"
        />
        <div className="flex shrink-0 items-center gap-3 pl-4">
          <span
            className={`whitespace-nowrap text-xs ${
              status === 'error' ? 'text-red-500' : 'text-[var(--owl-text-muted)]'
            }`}
            title={status === 'error' ? (saveError ?? undefined) : undefined}
          >
            {status === 'saving'
              ? 'Saving…'
              : status === 'saved'
                ? 'Saved'
                : status === 'error'
                  ? (saveError ?? 'Failed to save')
                  : ''}
          </span>
          <button
            onClick={toggleFocusMode}
            className={`owl-hover p-1.5 ${
              focusMode ? 'text-[var(--owl-accent)]' : 'text-[var(--owl-text-muted)]'
            }`}
            aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
            title={focusMode ? 'Exit focus mode' : 'Focus mode'}
          >
            {focusMode ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
          <TimerWidget />
          <button
            onClick={() => setShowQuiz(true)}
            className="owl-hover p-1.5 text-[var(--owl-text-muted)]"
            aria-label="Quiz me on this note"
            title="Quiz me"
          >
            <HelpCircle size={16} />
          </button>
          <button
            onClick={() => setShowRecall(true)}
            className="owl-hover p-1.5 text-[var(--owl-text-muted)]"
            aria-label="Practice active recall on this note"
            title="Active recall"
          >
            <Layers size={16} />
          </button>
          <button
            onClick={toggleInsightsEnabled}
            className={`owl-hover p-1.5 ${
              insightsEnabled ? 'text-[var(--owl-accent)]' : 'text-[var(--owl-text-muted)]'
            }`}
            aria-label={insightsEnabled ? 'Turn off Owly insights' : 'Turn on Owly insights'}
            title={insightsEnabled ? 'Insights on' : 'Insights off'}
          >
            <Lightbulb size={16} />
          </button>
          <button
            onClick={onToggleOwly}
            className={`owl-hover p-1.5 ${owlyOpen ? 'text-[var(--owl-accent)]' : 'text-[var(--owl-text-muted)]'}`}
            aria-label="Ask Owly"
            title="Ask Owly"
          >
            <Sparkles size={16} />
          </button>
          <div className="flex items-center gap-1.5 border border-[var(--owl-border)] px-2 py-1">
            <input
              type="range"
              min={MIN_FONT_SIZE}
              max={MAX_FONT_SIZE}
              value={editorFontSize}
              onChange={(e) => setEditorFontSize(Number(e.target.value))}
              className="owl-range w-16"
              aria-label="Editor font size"
            />
            <span className="w-5 text-right text-xs text-[var(--owl-text-muted)]">{editorFontSize}</span>
          </div>
          <button
            onClick={handleDelete}
            className="p-1.5 text-[var(--owl-text-muted)] hover:text-red-500"
            aria-label="Delete note"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <CodeMirror
          value={body}
          theme={theme === 'white-black' ? 'light' : 'dark'}
          extensions={[markdown(), EditorView.lineWrapping, fontSizeExtension]}
          onChange={(value) => {
            setBody(value)
            scheduleSave(section, value)
            scheduleInsights(value)
          }}
          basicSetup={{ lineNumbers: false, foldGutter: false }}
        />
      </div>
      <InsightPopups
        insights={insights}
        onDismiss={(id) => setInsights((prev) => prev.filter((i) => i.id !== id))}
      />
      {showQuiz && (
        <QuizDialog
          label={note.section}
          getNoteContext={() => ({ subject: note.subject, title: note.title, section: note.section, body })}
          onClose={() => setShowQuiz(false)}
        />
      )}
      {showRecall && (
        <FlashcardDialog
          label={note.section}
          getNoteContext={() => ({ subject: note.subject, title: note.title, section: note.section, body })}
          onClose={() => setShowRecall(false)}
        />
      )}
    </div>
  )
}
