import { useState } from 'react'
import { Check, X } from 'lucide-react'
import type { AINoteContext, QuizQuestion } from '../../../shared/types'

type Phase = 'setup' | 'loading' | 'error' | 'active' | 'results'

const MIN_COUNT = 1
const MAX_COUNT = 20

export default function QuizDialog({
  label,
  defaultCount = 5,
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
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [score, setScore] = useState(0)

  async function start() {
    setPhase('loading')
    try {
      const noteContext = await getNoteContext()
      const qs = await window.owlpad.generateQuiz({ noteContext, count })
      setQuestions(qs)
      setPhase('active')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate quiz.')
      setPhase('error')
    }
  }

  const current = questions[index]

  function choose(optionIndex: number) {
    if (selected !== null) return
    setSelected(optionIndex)
    if (optionIndex === current.correctIndex) setScore((s) => s + 1)
  }

  function next() {
    if (index + 1 < questions.length) {
      setIndex((i) => i + 1)
      setSelected(null)
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
          <h2 className="text-base font-semibold">Quiz: {label}</h2>
          <button onClick={onClose} className="owl-hover p-1" aria-label="Close quiz">
            <X size={16} />
          </button>
        </div>

        {phase === 'setup' && (
          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="flex items-center justify-between text-xs text-[var(--owl-text-muted)]">
                <span>Number of questions</span>
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
              Start quiz
            </button>
          </div>
        )}

        {phase === 'loading' && (
          <p className="text-sm text-[var(--owl-text-muted)]">
            Owly is writing a quiz… this can take a moment on a local model, especially for more
            questions.
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
              Question {index + 1} of {questions.length}
            </p>
            <p className="text-sm font-medium">{current.question}</p>
            <div className="space-y-2">
              {current.options.map((option, i) => {
                const isCorrect = i === current.correctIndex
                const isChosen = i === selected
                const revealed = selected !== null
                return (
                  <button
                    key={i}
                    onClick={() => choose(i)}
                    disabled={revealed}
                    className={`flex w-full items-center justify-between border px-3 py-2 text-left text-sm ${
                      revealed && isCorrect
                        ? 'border-green-600 bg-green-600/10'
                        : revealed && isChosen && !isCorrect
                          ? 'border-red-500 bg-red-500/10'
                          : 'border-[var(--owl-border)] owl-hover'
                    }`}
                  >
                    <span>{option}</span>
                    {revealed && isCorrect && <Check size={15} className="shrink-0 text-green-600" />}
                    {revealed && isChosen && !isCorrect && (
                      <X size={15} className="shrink-0 text-red-500" />
                    )}
                  </button>
                )
              })}
            </div>
            {selected !== null && current.explanation && (
              <p className="text-xs text-[var(--owl-text-muted)]">{current.explanation}</p>
            )}
            {selected !== null && (
              <button onClick={next} className="owl-btn-accent w-full px-3 py-1.5 text-sm font-medium">
                {index + 1 < questions.length ? 'Next question' : 'See results'}
              </button>
            )}
          </div>
        )}

        {phase === 'results' && (
          <div className="space-y-4">
            <p className="text-sm">
              You scored <span className="font-semibold">{score}</span> out of{' '}
              <span className="font-semibold">{questions.length}</span>.
            </p>
            <button onClick={onClose} className="owl-btn-accent w-full px-3 py-1.5 text-sm font-medium">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
