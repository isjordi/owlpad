import { useState } from 'react'
import { Check, X } from 'lucide-react'
import type { AINoteContext, FlashCard } from '../../../shared/types'

type Phase = 'setup' | 'loading' | 'error' | 'active' | 'results'

const MIN_COUNT = 1
const MAX_COUNT = 20

export default function FlashcardDialog({
  label,
  defaultCount = 6,
  getNoteContext,
  onClose
}: {
  label: string
  defaultCount?: number
  getNoteContext: () => AINoteContext | Promise<AINoteContext>
  onClose: () => void
}) {
  const [phase, setPhase] = useState<Phase>('setup')
  const [count, setCount] = useState(defaultCount)
  const [error, setError] = useState<string | null>(null)
  const [cards, setCards] = useState<FlashCard[]>([])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [known, setKnown] = useState(0)
  const [missed, setMissed] = useState<FlashCard[]>([])

  async function start() {
    setPhase('loading')
    try {
      const noteContext = await getNoteContext()
      const cs = await window.owlpad.generateFlashcards({ noteContext, count })
      setCards(cs)
      setPhase('active')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate flashcards.')
      setPhase('error')
    }
  }

  const current = cards[index]

  function answer(gotIt: boolean) {
    if (gotIt) setKnown((k) => k + 1)
    else setMissed((m) => [...m, current])

    if (index + 1 < cards.length) {
      setIndex((i) => i + 1)
      setRevealed(false)
    } else {
      setPhase('results')
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md space-y-4 border border-[var(--owl-border)] bg-[var(--owl-panel)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Active recall: {label}</h2>
          <button onClick={onClose} className="owl-hover p-1" aria-label="Close active recall">
            <X size={16} />
          </button>
        </div>

        {phase === 'setup' && (
          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="flex items-center justify-between text-xs text-[var(--owl-text-muted)]">
                <span>Number of flashcards</span>
                <span className="text-[var(--owl-text)]">{count}</span>
              </span>
              <input
                type="range"
                min={MIN_COUNT}
                max={MAX_COUNT}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="owl-range w-full"
              />
            </label>
            <button onClick={start} className="owl-btn-accent w-full px-3 py-1.5 text-sm font-medium">
              Start
            </button>
          </div>
        )}

        {phase === 'loading' && (
          <p className="text-sm text-[var(--owl-text-muted)]">
            Owly is writing flashcards… this can take a moment on a local model, especially for more
            cards.
          </p>
        )}

        {phase === 'error' && (
          <div className="space-y-3">
            <p className="text-sm text-red-500">{error}</p>
            <button onClick={onClose} className="owl-hover w-full px-3 py-1.5 text-sm">
              Close
            </button>
          </div>
        )}

        {phase === 'active' && current && (
          <div className="space-y-4">
            <p className="text-xs text-[var(--owl-text-muted)]">
              Card {index + 1} of {cards.length}
            </p>
            <div className="min-h-[6rem] border border-[var(--owl-border)] p-4">
              <p className="text-sm font-medium">{current.question}</p>
              {revealed && (
                <p className="mt-3 border-t border-[var(--owl-border)] pt-3 text-sm text-[var(--owl-text-muted)]">
                  {current.answer}
                </p>
              )}
            </div>

            {!revealed && (
              <p className="text-xs text-[var(--owl-text-muted)]">
                Try to recall the answer before revealing it — that's what makes it stick.
              </p>
            )}

            {!revealed ? (
              <button
                onClick={() => setRevealed(true)}
                className="owl-btn-accent w-full px-3 py-1.5 text-sm font-medium"
              >
                Show answer
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => answer(false)}
                  className="flex flex-1 items-center justify-center gap-1.5 border border-red-500/40 px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/10"
                >
                  <X size={14} /> Still learning
                </button>
                <button
                  onClick={() => answer(true)}
                  className="flex flex-1 items-center justify-center gap-1.5 border border-green-600/40 px-3 py-1.5 text-sm text-green-600 hover:bg-green-600/10"
                >
                  <Check size={14} /> I knew it
                </button>
              </div>
            )}
          </div>
        )}

        {phase === 'results' && (
          <div className="space-y-4">
            <p className="text-sm">
              You knew <span className="font-semibold">{known}</span> out of{' '}
              <span className="font-semibold">{cards.length}</span>.
            </p>
            {missed.length > 0 && (
              <div className="max-h-64 space-y-3 overflow-y-auto">
                <p className="text-xs text-[var(--owl-text-muted)]">Worth reviewing:</p>
                {missed.map((card, i) => (
                  <div key={i} className="border border-[var(--owl-border)] p-3">
                    <p className="text-sm font-medium">{card.question}</p>
                    <p className="mt-1.5 text-xs text-[var(--owl-text-muted)]">{card.answer}</p>
                  </div>
                ))}
              </div>
            )}
            <button onClick={onClose} className="owl-btn-accent w-full px-3 py-1.5 text-sm font-medium">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
