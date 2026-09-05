import { create } from 'zustand'
import type { AppConfig, SearchResult, VaultTree } from '../../../shared/types'

export type ThemeId = 'black-white' | 'white-black' | 'black-purple'

export const THEMES: { id: ThemeId; label: string; bg: string; detail: string }[] = [
  { id: 'black-white', label: 'Black & White', bg: '#0a0a0a', detail: '#f5f5f5' },
  { id: 'white-black', label: 'White & Black', bg: '#ffffff', detail: '#0a0a0a' },
  { id: 'black-purple', label: 'Black & Purple', bg: '#0a0a0a', detail: '#a855f7' }
]

export type FontId = 'inter' | 'system'

export const FONTS: { id: FontId; label: string; preview: string }[] = [
  { id: 'inter', label: 'Inter', preview: 'Inter Variable, ui-sans-serif, system-ui, sans-serif' },
  { id: 'system', label: 'System default', preview: '-apple-system, Segoe UI, ui-sans-serif, sans-serif' }
]

export const MIN_FONT_SIZE = 12
export const MAX_FONT_SIZE = 28
const DEFAULT_FONT_SIZE = 15

export type PaneId = 'sidebar' | 'titles' | 'sections' | 'owly'
export const PANE_MIN_WIDTH = 180
export const PANE_MAX_WIDTH = 520
const DEFAULT_PANE_WIDTHS: Record<PaneId, number> = {
  sidebar: 224,
  titles: 224,
  sections: 288,
  owly: 340
}

function clampPaneWidth(width: number): number {
  return Math.min(PANE_MAX_WIDTH, Math.max(PANE_MIN_WIDTH, width))
}

function initialPaneWidths(): Record<PaneId, number> {
  try {
    const stored = JSON.parse(localStorage.getItem('owlpad-pane-widths') ?? 'null')
    if (stored && typeof stored === 'object') {
      return {
        sidebar: clampPaneWidth(Number(stored.sidebar) || DEFAULT_PANE_WIDTHS.sidebar),
        titles: clampPaneWidth(Number(stored.titles) || DEFAULT_PANE_WIDTHS.titles),
        sections: clampPaneWidth(Number(stored.sections) || DEFAULT_PANE_WIDTHS.sections),
        owly: clampPaneWidth(Number(stored.owly) || DEFAULT_PANE_WIDTHS.owly)
      }
    }
  } catch {
    // localStorage unavailable — fall back to defaults
  }
  return { ...DEFAULT_PANE_WIDTHS }
}

function initialTheme(): ThemeId {
  try {
    const stored = localStorage.getItem('owlpad-theme')
    if (stored === 'black-white' || stored === 'white-black' || stored === 'black-purple') return stored
  } catch {
    // localStorage unavailable — fall back to default
  }
  return 'black-white'
}

function initialFont(): FontId {
  try {
    const stored = localStorage.getItem('owlpad-font')
    if (stored === 'inter' || stored === 'system') return stored
  } catch {
    // localStorage unavailable — fall back to default
  }
  return 'inter'
}

function initialFocusMode(): boolean {
  try {
    return localStorage.getItem('owlpad-focus-mode') === '1'
  } catch {
    return false
  }
}

function initialFontSize(): number {
  try {
    const stored = Number(localStorage.getItem('owlpad-font-size'))
    if (stored >= MIN_FONT_SIZE && stored <= MAX_FONT_SIZE) return stored
  } catch {
    // localStorage unavailable — fall back to default
  }
  return DEFAULT_FONT_SIZE
}

function initialInsightsEnabled(): boolean {
  try {
    const stored = localStorage.getItem('owlpad-insights-enabled')
    if (stored === '0') return false
  } catch {
    // localStorage unavailable — fall back to default
  }
  return true
}

interface OwlPadState {
  config: AppConfig | null
  unlocked: boolean
  vaultTree: VaultTree
  activeNoteId: string | null
  selectedSubject: string | null
  selectedTitle: string | null
  searchQuery: string
  searchResults: SearchResult[]
  theme: ThemeId
  font: FontId
  editorFontSize: number
  paneWidths: Record<PaneId, number>
  focusMode: boolean
  insightsEnabled: boolean

  setConfig: (c: AppConfig) => void
  setUnlocked: (v: boolean) => void
  setVaultTree: (t: VaultTree) => void
  setActiveNoteId: (id: string | null) => void
  setSelectedSubject: (subject: string | null) => void
  setSelectedTitle: (subject: string | null, title: string | null) => void
  setSearchQuery: (q: string) => void
  setSearchResults: (r: SearchResult[]) => void
  setTheme: (theme: ThemeId) => void
  setFont: (font: FontId) => void
  setEditorFontSize: (size: number) => void
  setPaneWidth: (pane: PaneId, width: number) => void
  toggleFocusMode: () => void
  toggleInsightsEnabled: () => void
}

export const useOwlPadStore = create<OwlPadState>((set) => ({
  config: null,
  unlocked: false,
  vaultTree: {},
  activeNoteId: null,
  selectedSubject: null,
  selectedTitle: null,
  searchQuery: '',
  searchResults: [],
  theme: initialTheme(),
  font: initialFont(),
  editorFontSize: initialFontSize(),
  paneWidths: initialPaneWidths(),
  focusMode: initialFocusMode(),
  insightsEnabled: initialInsightsEnabled(),

  setConfig: (config) => set({ config }),
  setUnlocked: (unlocked) => set({ unlocked }),
  setVaultTree: (vaultTree) => set({ vaultTree }),
  setActiveNoteId: (activeNoteId) => set({ activeNoteId }),
  setSelectedSubject: (selectedSubject) =>
    set({ selectedSubject, selectedTitle: null, activeNoteId: null }),
  setSelectedTitle: (selectedSubject, selectedTitle) =>
    set({ selectedSubject, selectedTitle, activeNoteId: null }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSearchResults: (searchResults) => set({ searchResults }),
  setTheme: (theme) => {
    try {
      localStorage.setItem('owlpad-theme', theme)
    } catch {
      // ignore — per-viewer convenience only
    }
    set({ theme })
  },
  setFont: (font) => {
    try {
      localStorage.setItem('owlpad-font', font)
    } catch {
      // ignore — per-viewer convenience only
    }
    set({ font })
  },
  setEditorFontSize: (size) => {
    const editorFontSize = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size))
    try {
      localStorage.setItem('owlpad-font-size', String(editorFontSize))
    } catch {
      // ignore — per-viewer convenience only
    }
    set({ editorFontSize })
  },
  setPaneWidth: (pane, width) =>
    set((s) => {
      const paneWidths = { ...s.paneWidths, [pane]: clampPaneWidth(width) }
      try {
        localStorage.setItem('owlpad-pane-widths', JSON.stringify(paneWidths))
      } catch {
        // ignore — per-viewer convenience only
      }
      return { paneWidths }
    }),
  toggleFocusMode: () =>
    set((s) => {
      const focusMode = !s.focusMode
      try {
        localStorage.setItem('owlpad-focus-mode', focusMode ? '1' : '0')
      } catch {
        // ignore — per-viewer convenience only
      }
      return { focusMode }
    }),
  toggleInsightsEnabled: () =>
    set((s) => {
      const insightsEnabled = !s.insightsEnabled
      try {
        localStorage.setItem('owlpad-insights-enabled', insightsEnabled ? '1' : '0')
      } catch {
        // ignore — per-viewer convenience only
      }
      return { insightsEnabled }
    })
}))
