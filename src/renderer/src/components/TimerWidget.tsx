import { useState } from 'react'
import { Pause, Play, Plus, Timer as TimerIcon, TimerReset } from 'lucide-react'
import { useTimerStore } from '../state/timerStore'

const PRESETS_MIN = [5, 10, 15, 25, 50]
const ADD_MIN = 5

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export default function TimerWidget() {
  const [open, setOpen] = useState(false)
  const [customMinutes, setCustomMinutes] = useState('')
  const { running, done, remainingMs, start, pause, resume, restart, addMinutes, reset } =
    useTimerStore()

  const active = remainingMs !== null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Study timer"
        title="Study timer"
        className={`owl-hover flex items-center gap-1 p-1.5 ${
          done ? 'animate-pulse text-red-500' : active ? 'text-[var(--owl-accent)]' : 'text-[var(--owl-text-muted)]'
        }`}
      >
        <TimerIcon size={16} />
        {active && <span className="text-xs font-medium tabular-nums">{formatTime(remainingMs)}</span>}
      </button>

      {open && (
        <div className="absolute left-1/2 top-full z-50 mt-2 w-56 -translate-x-1/2 border border-[var(--owl-border)] bg-[var(--owl-bg)] p-3 shadow-lg">
          {active ? (
            <div className="space-y-3">
              <div
                className={`text-center text-3xl font-semibold tabular-nums ${
                  done ? 'text-red-500' : 'text-[var(--owl-text)]'
                }`}
              >
                {formatTime(remainingMs)}
              </div>
              {done && <p className="text-center text-xs text-red-500">Time&rsquo;s up!</p>}
              <div className="flex items-center justify-center gap-2">
                {running ? (
                  <button onClick={pause} className="owl-btn-accent flex items-center gap-1 px-3 py-1.5 text-xs">
                    <Pause size={13} /> Pause
                  </button>
                ) : (
                  <button
                    onClick={done ? restart : resume}
                    className="owl-btn-accent flex items-center gap-1 px-3 py-1.5 text-xs"
                  >
                    <Play size={13} /> {done ? 'Restart' : 'Resume'}
                  </button>
                )}
                <button
                  onClick={reset}
                  className="owl-hover flex items-center gap-1 px-3 py-1.5 text-xs text-[var(--owl-text-muted)]"
                >
                  <TimerReset size={13} /> Reset
                </button>
              </div>
              <button
                onClick={() => addMinutes(ADD_MIN)}
                className="owl-hover mx-auto flex items-center gap-1 px-2 py-1 text-xs text-[var(--owl-text-muted)]"
              >
                <Plus size={12} /> {ADD_MIN} min
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-1.5">
                {PRESETS_MIN.map((m) => (
                  <button
                    key={m}
                    onClick={() => start(m)}
                    className="owl-hover border border-[var(--owl-border)] py-1.5 text-xs"
                  >
                    {m}m
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customMinutes) start(Number(customMinutes))
                  }}
                  placeholder="Custom min"
                  className="owl-input w-full px-2 py-1.5 text-xs"
                />
                <button
                  onClick={() => customMinutes && start(Number(customMinutes))}
                  disabled={!customMinutes}
                  className="owl-btn-accent shrink-0 px-2 py-1.5 text-xs disabled:pointer-events-none disabled:opacity-30"
                >
                  Set
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
