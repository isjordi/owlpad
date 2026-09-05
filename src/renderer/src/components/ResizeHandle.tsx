import { useResizeHandle } from '../lib/useResizeHandle'

export default function ResizeHandle({
  width,
  onResize,
  invert
}: {
  width: number
  onResize: (width: number) => void
  invert?: boolean
}) {
  const onMouseDown = useResizeHandle(width, onResize, invert)
  return (
    <div
      onMouseDown={onMouseDown}
      className="group relative w-0 shrink-0 cursor-col-resize"
      role="separator"
      aria-orientation="vertical"
    >
      <div className="absolute inset-y-0 -left-1 w-2 group-hover:bg-[var(--owl-accent-soft)]" />
    </div>
  )
}
