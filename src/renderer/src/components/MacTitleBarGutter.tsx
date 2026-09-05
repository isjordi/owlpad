import type { CSSProperties } from 'react'

/**
 * On macOS the window uses titleBarStyle 'hiddenInset' (see src/main/index.ts), which
 * draws native traffic-light buttons over the content instead of reserving a title bar —
 * without this, the top-left ~16-32px of whatever's rendered there (the Sidebar logo,
 * a pane header) sits directly under those buttons, and the window has no drag region
 * at all since there's no native title bar. This is a no-op on Windows/Linux.
 */
export default function MacTitleBarGutter() {
  if (window.owlpad.platform !== 'darwin') return null
  return <div className="h-8 w-full shrink-0" style={{ WebkitAppRegion: 'drag' } as CSSProperties} />
}
