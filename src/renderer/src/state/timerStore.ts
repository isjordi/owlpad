import { create } from 'zustand'

function beep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const playTone = (startAt: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.15, ctx.currentTime + startAt)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + 0.35)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + startAt)
      osc.stop(ctx.currentTime + startAt + 0.35)
    }
    playTone(0)
    playTone(0.4)
    playTone(0.8)
  } catch {
    // Web Audio unavailable — silent fallback, the visual/notification alert still fires
  }
}

function notifyDone() {
  try {
    if (Notification.permission === 'granted') {
      new Notification('Time is up', { body: 'Your OwlPAD timer finished.' })
    }
  } catch {
    // Notification API unavailable in this environment — the beep/flash still alert
  }
}

interface TimerState {
  running: boolean
  done: boolean
  remainingMs: number | null
  endAt: number | null
  lastDurationMs: number
  start: (minutes: number) => void
  pause: () => void
  resume: () => void
  restart: () => void
  addMinutes: (minutes: number) => void
  reset: () => void
  tick: () => void
}

export const useTimerStore = create<TimerState>((set, get) => ({
  running: false,
  done: false,
  remainingMs: null,
  endAt: null,
  lastDurationMs: 0,

  start: (minutes) => {
    if (minutes <= 0) return
    try {
      if (Notification.permission === 'default') Notification.requestPermission()
    } catch {
      // ignore — notification is a nice-to-have, not required for the timer to work
    }
    const ms = minutes * 60_000
    set({ running: true, done: false, remainingMs: ms, endAt: Date.now() + ms, lastDurationMs: ms })
  },
  pause: () => {
    const { endAt } = get()
    set({
      running: false,
      remainingMs: endAt !== null ? Math.max(0, endAt - Date.now()) : null,
      endAt: null
    })
  },
  resume: () => {
    const { remainingMs } = get()
    if (remainingMs === null) return
    set({ running: true, done: false, endAt: Date.now() + remainingMs })
  },
  restart: () => {
    const { lastDurationMs } = get()
    if (lastDurationMs <= 0) return
    set({ running: true, done: false, remainingMs: lastDurationMs, endAt: Date.now() + lastDurationMs })
  },
  addMinutes: (minutes) => {
    const extraMs = minutes * 60_000
    const { running, endAt, remainingMs } = get()
    if (running && endAt !== null) {
      const nextEndAt = endAt + extraMs
      set({ endAt: nextEndAt, remainingMs: nextEndAt - Date.now(), done: false })
    } else {
      set({ remainingMs: (remainingMs ?? 0) + extraMs, done: false })
    }
  },
  reset: () => set({ running: false, done: false, remainingMs: null, endAt: null }),
  tick: () => {
    const { running, endAt } = get()
    if (!running || endAt === null) return
    const left = endAt - Date.now()
    if (left <= 0) {
      set({ remainingMs: 0, running: false, done: true, endAt: null })
      beep()
      notifyDone()
    } else {
      set({ remainingMs: left })
    }
  }
}))

// Module-level ticker: runs for the lifetime of the app once this module is first
// imported, independent of whether any component that renders the timer UI is
// currently mounted — a running countdown must survive switching notes, since
// NoteEditor (which hosts the Timer button) fully remounts per `key={activeNoteId}`.
setInterval(() => useTimerStore.getState().tick(), 250)
