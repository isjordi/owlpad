import { useCallback, useRef } from 'react'

/**
 * Returns a mousedown handler that drags a pane's width, calling onResize with the live value.
 * Pass invert for a pane whose handle sits on its left edge (width grows when dragging left).
 */
export function useResizeHandle(
  width: number,
  onResize: (width: number) => void,
  invert = false
): (e: React.MouseEvent) => void {
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      const delta = e.clientX - dragStartX.current
      onResize(dragStartWidth.current + (invert ? -delta : delta))
    },
    [onResize, invert]
  )

  const onMouseUp = useCallback(() => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [onMouseMove])

  return useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragStartX.current = e.clientX
      dragStartWidth.current = width
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [width, onMouseMove, onMouseUp]
  )
}
