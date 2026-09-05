import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction
} from 'react'
import { FileText, Send, Sparkles, X } from 'lucide-react'
import { useOwlPadStore } from '../state/store'
import type { AINoteContext, AIRole } from '../../../shared/types'

interface ChatMessage {
  id: string
  role: AIRole
  content: string
  error?: boolean
}

type Mode = 'chat' | 'paraphrase'

function ChatPane({
  model,
  messages,
  setMessages,
  placeholder,
  emptyState,
  onOpenSettings,
  ask,
  onChunk
}: {
  model: string | null | undefined
  messages: ChatMessage[]
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>
  placeholder: string
  emptyState: string
  onOpenSettings: () => void
  ask: (requestId: string, history: { role: AIRole; content: string }[]) => Promise<string>
  onChunk: (callback: (requestId: string, delta: string) => void) => () => void
}) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || sending || !model) return

    const history = [
      ...messages.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: text }
    ]
    const requestId = crypto.randomUUID()
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: text },
      { id: requestId, role: 'assistant', content: '' }
    ])
    setInput('')
    setSending(true)

    const unsubscribe = onChunk((rid, delta) => {
      if (rid !== requestId) return
      setMessages((prev) =>
        prev.map((m) => (m.id === requestId ? { ...m, content: m.content + delta } : m))
      )
    })

    try {
      const full = await ask(requestId, history)
      setMessages((prev) => prev.map((m) => (m.id === requestId ? { ...m, content: full } : m)))
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Owly ran into an unexpected error.'
      setMessages((prev) =>
        prev.map((m) => (m.id === requestId ? { ...m, content: text, error: true } : m))
      )
    } finally {
      unsubscribe()
      setSending(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {model === null && (
          <p className="text-sm text-[var(--owl-text-muted)]">
            No Owly model selected yet.{' '}
            <button onClick={onOpenSettings} className="underline hover:text-[var(--owl-text)]">
              Pick one in Settings
            </button>{' '}
            — Owly runs locally via Ollama, so nothing about your notes ever leaves this machine.
          </p>
        )}
        {model === undefined && messages.length === 0 && (
          <p className="text-sm text-[var(--owl-text-muted)]">Loading…</p>
        )}
        {model && messages.length === 0 && (
          <p className="text-sm text-[var(--owl-text-muted)]">{emptyState}</p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-full whitespace-pre-wrap break-words px-3 py-2 text-sm ${
              m.role === 'user'
                ? 'ml-6 bg-[var(--owl-accent-soft)] text-[var(--owl-text)]'
                : m.error
                  ? 'mr-6 text-red-500'
                  : 'mr-6 text-[var(--owl-text)]'
            }`}
          >
            {m.content || (m.role === 'assistant' && sending ? '…' : '')}
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--owl-border)] p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={model ? placeholder : 'Select a model in Settings first'}
            disabled={!model}
            rows={2}
            className="owl-input w-full resize-none px-3 py-2 text-sm disabled:opacity-40"
          />
          <button
            onClick={send}
            disabled={!model || !input.trim() || sending}
            aria-label="Send"
            className="owl-btn-accent shrink-0 p-2 disabled:pointer-events-none disabled:opacity-30"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </>
  )
}

export default function OwlyPanel({
  width,
  onOpenSettings,
  onClose
}: {
  width: number
  onOpenSettings: () => void
  onClose: () => void
}) {
  const { activeNoteId } = useOwlPadStore()
  const [mode, setMode] = useState<Mode>('chat')
  const [model, setModel] = useState<string | null | undefined>(undefined)
  const [noteContext, setNoteContext] = useState<AINoteContext | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [paraphraseMessages, setParaphraseMessages] = useState<ChatMessage[]>([])

  useEffect(() => {
    window.owlpad.getAISettings().then((s) => setModel(s.model))
  }, [])

  useEffect(() => {
    if (!activeNoteId) {
      setNoteContext(null)
      return
    }
    window.owlpad.readNote(activeNoteId).then((note) => {
      if (!note) return
      setNoteContext({
        subject: note.subject,
        title: note.title,
        section: note.section,
        body: note.body
      })
    })
  }, [activeNoteId])

  return (
    <div style={{ width }} className="flex shrink-0 flex-col border-l border-[var(--owl-border)]">
      <div className="flex h-10 items-center gap-1 border-b border-[var(--owl-border)] pl-2 pr-2">
        <button onClick={onClose} className="owl-hover p-1.5" aria-label="Close Owly panel">
          <X size={15} />
        </button>
        <div className="flex flex-1 items-stretch gap-1">
          <button
            onClick={() => setMode('chat')}
            className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2 text-xs font-semibold uppercase tracking-wide ${
              mode === 'chat'
                ? 'border-[var(--owl-accent)] text-[var(--owl-text)]'
                : 'border-transparent text-[var(--owl-text-muted)] hover:text-[var(--owl-text)]'
            }`}
          >
            <Sparkles size={13} /> Chat
          </button>
          <button
            onClick={() => setMode('paraphrase')}
            className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2 text-xs font-semibold uppercase tracking-wide ${
              mode === 'paraphrase'
                ? 'border-[var(--owl-accent)] text-[var(--owl-text)]'
                : 'border-transparent text-[var(--owl-text-muted)] hover:text-[var(--owl-text)]'
            }`}
          >
            <FileText size={13} /> Paraphrase
          </button>
        </div>
      </div>

      {mode === 'chat' ? (
        <ChatPane
          model={model}
          messages={chatMessages}
          setMessages={setChatMessages}
          placeholder="Ask Owly…"
          emptyState={
            noteContext
              ? `Ask Owly about "${noteContext.section}".`
              : 'Open a note so Owly has something to talk about, or just ask a general question.'
          }
          onOpenSettings={onOpenSettings}
          ask={(requestId, history) => window.owlpad.askOwly(requestId, { noteContext, history })}
          onChunk={window.owlpad.onOwlyChunk}
        />
      ) : (
        <ChatPane
          model={model}
          messages={paraphraseMessages}
          setMessages={setParaphraseMessages}
          placeholder="Paste text to condense…"
          emptyState="Paste in a long piece of text and Owly will condense it into note-taking-style key points. This tab only paraphrases — it won't chat about anything else."
          onOpenSettings={onOpenSettings}
          ask={(requestId, history) => window.owlpad.askParaphrase(requestId, { history })}
          onChunk={window.owlpad.onParaphraseChunk}
        />
      )}
    </div>
  )
}
